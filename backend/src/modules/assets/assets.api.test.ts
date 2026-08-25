import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => ({
    ticker: ticker.toUpperCase(),
    nome: "Ativo de Teste S.A.",
    preco: 30,
    tipo: "ACAO",
  }),
  buscarCotacoes: async (tickers: string[]) =>
    new Map(
      tickers.map((t) => [
        t.toUpperCase(),
        { ticker: t.toUpperCase(), nome: "Ativo de Teste S.A.", preco: 30, tipo: "ACAO" },
      ]),
    ),
  classificar: () => "ACAO",
}));

// Ticker que só a usuária A vai negociar
const TICKER_DE_A = "TXAS1";

const emailA = `vitest-assets-a-${randomUUID()}@portfoliolab.dev`;
const emailB = `vitest-assets-b-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookiesA: string[];
let cookiesB: string[];

async function registrarELogar(nome: string, email: string) {
  await request(app).post("/auth/register").send({ name: nome, email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  return login.headers["set-cookie"] as unknown as string[];
}

beforeAll(async () => {
  await prisma.asset.deleteMany({ where: { ticker: TICKER_DE_A } });

  cookiesA = await registrarELogar("Usuária A", emailA);
  cookiesB = await registrarELogar("Usuário B", emailB);

  await request(app)
    .post("/transactions")
    .set("Cookie", cookiesA)
    .send({
      ticker: TICKER_DE_A,
      kind: "COMPRA",
      quantity: 10,
      unitPrice: 30,
      fee: 0,
      executedAt: "2026-01-01",
    });
});

afterAll(async () => {
  for (const email of [emailA, emailB]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.assetGoal.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
  await prisma.asset.deleteMany({ where: { ticker: TICKER_DE_A } });
  await prisma.$disconnect();
});

// Achado 3 da auditoria: findAll() é um findMany sem where — a rota devolve a
// união de tudo que a base inteira já negociou.
describe("GET /assets — catálogo por usuário", () => {
  it("exige login", async () => {
    const res = await request(app).get("/assets");
    expect(res.status).toBe(401);
  });

  it("a usuária A vê o ativo que negociou", async () => {
    const res = await request(app).get("/assets").set("Cookie", cookiesA);
    expect(res.status).toBe(200);
    expect(res.body.map((a: { ticker: string }) => a.ticker)).toContain(TICKER_DE_A);
  });

  it("o usuário B NÃO vê o ticker que só a usuária A negociou", async () => {
    const res = await request(app).get("/assets").set("Cookie", cookiesB);
    expect(res.status).toBe(200);
    expect(res.body.map((a: { ticker: string }) => a.ticker)).not.toContain(TICKER_DE_A);
  });

  it("conta nova começa com o catálogo vazio", async () => {
    const res = await request(app).get("/assets").set("Cookie", cookiesB);
    expect(res.body).toHaveLength(0);
  });
});
