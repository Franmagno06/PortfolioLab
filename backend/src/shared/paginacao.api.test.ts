import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { prisma } from "../database/prisma.js";

// A B3 fica de fora: preço fixo, sem rede. O ticker não existe no mundo real.
vi.mock("../modules/quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => ({
    ticker: ticker.toUpperCase(),
    nome: "Ativo de Teste S.A.",
    preco: 10,
    tipo: "ACAO",
  }),
  buscarCotacoes: async (tickers: string[]) =>
    new Map(
      tickers.map((t) => [
        t.toUpperCase(),
        { ticker: t.toUpperCase(), nome: "Ativo de Teste S.A.", preco: 10, tipo: "ACAO" },
      ]),
    ),
  classificar: () => "ACAO",
}));

const TICKER = "TXPG1"; // exclusivo deste arquivo de teste
const email = `vitest-paginacao-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];
let userId: string;
let assetId: string;

// Cinco de cada, para caber duas páginas de dois e uma última página de um.
const TOTAL = 5;

type Pagina<T> = { itens: T[]; proximoCursor: string | null };

// Percorre a rota inteira de duas em duas e devolve os ids na ordem em que
// apareceram. Uma paginação correta não repete nem pula nenhum registro.
async function percorrer(rota: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  let paginas = 0;

  do {
    const url = cursor ? `${rota}?limite=2&cursor=${cursor}` : `${rota}?limite=2`;
    const res = await request(app).get(url).set("Cookie", cookies);
    expect(res.status).toBe(200);

    const pagina = res.body as Pagina<{ id: string }>;
    ids.push(...pagina.itens.map((i) => i.id));
    cursor = pagina.proximoCursor;
    paginas += 1;
    expect(paginas).toBeLessThanOrEqual(TOTAL + 1); // trava contra laço infinito
  } while (cursor);

  return ids;
}

beforeAll(async () => {
  await request(app).post("/auth/register").send({ name: "Paginadora", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];

  const user = await prisma.user.findUnique({ where: { email } });
  userId = user!.id;

  for (let i = 0; i < TOTAL; i += 1) {
    await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({
        ticker: TICKER,
        kind: "COMPRA",
        quantity: 10,
        unitPrice: 10,
        fee: 0,
        executedAt: `2026-0${i + 1}-10`,
      });
  }

  const asset = await prisma.asset.findUnique({ where: { ticker: TICKER } });
  assetId = asset!.id;

  for (let i = 0; i < TOTAL; i += 1) {
    await request(app)
      .post("/dividends")
      .set("Cookie", cookies)
      .send({ ticker: TICKER, amount: 5 + i, paidAt: `2026-0${i + 1}-15` });
  }

  // Relatórios entram direto pelo Prisma: passar pelo POST exigiria PDF e IA,
  // e o que está sob teste aqui é a paginação, não a análise.
  for (let i = 0; i < TOTAL; i += 1) {
    await prisma.report.create({
      data: {
        userId,
        fileName: `relatorio-${i}.pdf`,
        extractedText: "texto de teste",
        analysis: { resumoExecutivo: [`ponto ${i}`] },
      },
    });
  }
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { userId } });
  await prisma.dividend.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.$disconnect();
});

describe.each([
  ["/transactions", "transações"],
  ["/dividends", "proventos"],
  ["/reports", "relatórios"],
])("paginação por cursor em %s", (rota) => {
  it("devolve a primeira página com o cursor da próxima", async () => {
    const res = await request(app).get(`${rota}?limite=2`).set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body.itens).toHaveLength(2);
    expect(typeof res.body.proximoCursor).toBe("string");
  });

  it("percorre tudo sem repetir nem pular registro", async () => {
    const ids = await percorrer(rota);

    expect(ids).toHaveLength(TOTAL);
    expect(new Set(ids).size).toBe(TOTAL);
  });

  it("fecha a última página com proximoCursor nulo", async () => {
    const res = await request(app).get(`${rota}?limite=100`).set("Cookie", cookies);

    expect(res.body.itens).toHaveLength(TOTAL);
    expect(res.body.proximoCursor).toBeNull();
  });

  it("recusa limite fora da faixa", async () => {
    const zero = await request(app).get(`${rota}?limite=0`).set("Cookie", cookies);
    const demais = await request(app).get(`${rota}?limite=101`).set("Cookie", cookies);

    expect(zero.status).toBe(400);
    expect(demais.status).toBe(400);
  });
});
