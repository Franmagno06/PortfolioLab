import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// O provedor é trocado por um calendário fixo: a suíte não pode depender do
// Yahoo nem do que a empresa realmente pagou este mês.
// Ticker só desta suíte: o vitest roda os arquivos em paralelo no mesmo banco, e dividends.api.test.ts
// apaga o ativo "TXDV1" no começo e no fim; compartilhá-lo derrubava as transações daqui (FK) no CI.
const TICKER = "TXDS1";
// ativo da pessoa que NÃO tem transação nenhuma (ela apagou o lançamento errado): só desta suíte também
const TICKER_SEM_POSICAO = "TXDS2";
const DATA_EX_1 = new Date("2026-03-10");
const DATA_EX_2 = new Date("2026-06-10");

// null simula o Yahoo fora do ar (buscarProventosOuNulo); [] é uma resposta sem nenhum evento;
// fora disso, a lista é o calendário de sempre
const fonte = vi.hoisted(() => ({ fora: false, vazia: false }));

vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => ({
    ticker: ticker.toUpperCase(),
    nome: "Ativo de Teste S.A.",
    preco: 20,
    tipo: "ACAO",
  }),
  buscarCotacoes: async (tickers: string[]) =>
    new Map(
      tickers.map((t) => [
        t.toUpperCase(),
        { ticker: t.toUpperCase(), nome: "Ativo de Teste S.A.", preco: 20, tipo: "ACAO" },
      ]),
    ),
  classificar: () => "ACAO",
  buscarProventosOuNulo: async () =>
    fonte.fora
      ? null
      : fonte.vazia
        ? []
        : [
            { dataEx: DATA_EX_1, valorPorCota: 0.5 },
            { dataEx: DATA_EX_2, valorPorCota: 0.25 },
          ],
}));

const email = `vitest-sync-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];
let userId: string;

beforeAll(async () => {
  await request(app).post("/auth/register").send({ name: "Sincronizadora", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];
  userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

  // 200 cotas antes da primeira data-ex; mais 100 depois dela
  await request(app).post("/transactions").set("Cookie", cookies).send({
    ticker: TICKER,
    kind: "COMPRA",
    quantity: 200,
    unitPrice: 20,
    executedAt: "2026-01-15",
  });
  await request(app).post("/transactions").set("Cookie", cookies).send({
    ticker: TICKER,
    kind: "COMPRA",
    quantity: 100,
    unitPrice: 20,
    executedAt: "2026-04-20",
  });
});

afterAll(async () => {
  await prisma.dividend.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.asset.deleteMany({ where: { ticker: { in: [TICKER, TICKER_SEM_POSICAO] } } });
  await prisma.$disconnect();
});

describe("POST /dividends/sync", () => {
  it("bloqueia sem login", async () => {
    const res = await request(app).post("/dividends/sync");
    expect(res.status).toBe(401);
  });

  it("importa cada provento sobre a posição da data-ex", async () => {
    const res = await request(app).post("/dividends/sync").set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ativosConsultados: 1, proventos: 2 });

    const lista = await request(app).get("/dividends").set("Cookie", cookies);
    const proventos = lista.body.itens as { amount: string; paidAt: string; source: string }[];

    expect(proventos).toHaveLength(2);
    expect(proventos.every((p) => p.source === "PROVEDOR")).toBe(true);

    // março: 200 cotas × R$ 0,50. Junho: 300 cotas × R$ 0,25 — a compra de
    // abril entrou a tempo do segundo, mas não do primeiro.
    const porData = Object.fromEntries(proventos.map((p) => [p.paidAt.slice(0, 7), Number(p.amount)]));
    expect(porData["2026-03"]).toBe(100);
    expect(porData["2026-06"]).toBe(75);
  });

  it("rodar de novo não duplica nem soma em cima", async () => {
    await request(app).post("/dividends/sync").set("Cookie", cookies);
    await request(app).post("/dividends/sync").set("Cookie", cookies);

    const lista = await request(app).get("/dividends").set("Cookie", cookies);
    const proventos = lista.body.itens as { amount: string }[];

    expect(proventos).toHaveLength(2);
    expect(proventos.map((p) => Number(p.amount)).sort((a, b) => a - b)).toEqual([75, 100]);
  });

  it("preserva o provento lançado à mão", async () => {
    const manual = await request(app).post("/dividends").set("Cookie", cookies).send({
      ticker: TICKER,
      amount: 42,
      paidAt: "2026-03-10", // mesma data-ex do importado, de propósito
    });
    expect(manual.status).toBe(201);

    await request(app).post("/dividends/sync").set("Cookie", cookies);

    const lista = await request(app).get("/dividends").set("Cookie", cookies);
    const proventos = lista.body.itens as { amount: string; source: string }[];

    // o manual convive com o do provedor na mesma data: origens diferentes
    expect(proventos).toHaveLength(3);
    expect(proventos.filter((p) => p.source === "MANUAL")).toHaveLength(1);
    expect(proventos.filter((p) => p.source === "PROVEDOR")).toHaveLength(2);
  });

  it("apaga o provento do provedor que deixou de ser devido, e só ele", async () => {
    // Linha que a regra antiga podia ter gravado (ou que a pessoa deixou de ter direito
    // ao corrigir uma transação): data-ex que o provedor não confirma como devida.
    const asset = await prisma.asset.findUniqueOrThrow({ where: { ticker: TICKER } });
    const antiga = new Date("2026-04-20T13:00:00Z");
    await prisma.dividend.create({
      data: { userId, assetId: asset.id, paidAt: antiga, amount: 99, unitAmount: 1, source: "PROVEDOR" },
    });

    await request(app).post("/dividends/sync").set("Cookie", cookies);

    const restantes = await prisma.dividend.findMany({ where: { userId } });
    expect(restantes.some((d) => d.paidAt.getTime() === antiga.getTime())).toBe(false);
    expect(restantes.filter((d) => d.source === "PROVEDOR")).toHaveLength(2);
    expect(restantes.filter((d) => d.source === "MANUAL")).toHaveLength(1);
  });

  it("lista vazia do provedor não apaga nada: não dá para distinguir 'não pagou' de resposta degradada", async () => {
    const antes = await prisma.dividend.count({ where: { userId } });
    expect(antes).toBeGreaterThan(0);
    fonte.vazia = true;
    try {
      const res = await request(app).post("/dividends/sync").set("Cookie", cookies);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ proventos: 0 });
    } finally {
      fonte.vazia = false;
    }
    expect(await prisma.dividend.count({ where: { userId } })).toBe(antes);
  });

  it("ativo que ficou sem transações perde os proventos importados e mantém os lançados à mão", async () => {
    const semPosicao = await prisma.asset.create({
      data: { ticker: TICKER_SEM_POSICAO, name: "Sem Posição S.A.", type: "ACAO", currentPrice: 10 },
    });
    const data = new Date("2026-03-10T13:00:00Z");
    await prisma.dividend.createMany({
      data: [
        { userId, assetId: semPosicao.id, paidAt: data, amount: 120, unitAmount: 1.2, source: "PROVEDOR" },
        { userId, assetId: semPosicao.id, paidAt: new Date("2026-03-11T13:00:00Z"), amount: 30, unitAmount: null, source: "MANUAL" },
      ],
    });

    const res = await request(app).post("/dividends/sync").set("Cookie", cookies);
    expect(res.status).toBe(200);

    const doAtivo = await prisma.dividend.findMany({ where: { userId, assetId: semPosicao.id } });
    expect(doAtivo.map((d) => d.source)).toEqual(["MANUAL"]);
    // o ativo que ainda tem posição não foi tocado
    expect(await prisma.dividend.count({ where: { userId, source: "PROVEDOR" } })).toBe(2);
  });

  it("com o provedor fora do ar, não apaga nada", async () => {
    const antes = await prisma.dividend.count({ where: { userId } });
    fonte.fora = true;
    try {
      const res = await request(app).post("/dividends/sync").set("Cookie", cookies);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ proventos: 0 });
    } finally {
      fonte.fora = false;
    }
    expect(await prisma.dividend.count({ where: { userId } })).toBe(antes);
  });
});
