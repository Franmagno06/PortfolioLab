import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// O provedor é trocado por um calendário fixo: a suíte não pode depender do
// Yahoo nem do que a empresa realmente pagou este mês.
const TICKER = "TXDV1";
const DATA_EX_1 = new Date("2026-03-10");
const DATA_EX_2 = new Date("2026-06-10");

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
  buscarProventos: async () => [
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
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });
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
});
