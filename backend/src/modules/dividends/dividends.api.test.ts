import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Provider fixo: mesmo molde de goals.api.test.ts — evita bater na B3 real.
vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => {
    const simbolo = ticker.toUpperCase();
    if (simbolo === "ZZZZ9") return null;
    return { ticker: simbolo, nome: "Ativo de Teste S.A.", preco: 20, tipo: "ACAO" };
  },
  buscarCotacoes: async (tickers: string[]) =>
    new Map(
      tickers.map((t) => [
        t.toUpperCase(),
        { ticker: t.toUpperCase(), nome: "Ativo de Teste S.A.", preco: 20, tipo: "ACAO" },
      ]),
    ),
  classificar: () => "ACAO",
}));

const TICKER = "TXDV1";
const emailA = `vitest-dividends-a-${randomUUID()}@portfoliolab.dev`;
const emailB = `vitest-dividends-b-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookiesA: string[];
let cookiesB: string[];

beforeAll(async () => {
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });

  await request(app).post("/auth/register").send({ name: "Testadora A", email: emailA, password });
  const loginA = await request(app).post("/auth/login").send({ email: emailA, password });
  cookiesA = loginA.headers["set-cookie"] as unknown as string[];

  await request(app).post("/auth/register").send({ name: "Testadora B", email: emailB, password });
  const loginB = await request(app).post("/auth/login").send({ email: emailB, password });
  cookiesB = loginB.headers["set-cookie"] as unknown as string[];
});

afterAll(async () => {
  await prisma.dividend.deleteMany({ where: { user: { email: { in: [emailA, emailB] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });
  await prisma.$disconnect();
});

describe("GET /dividends (proteção)", () => {
  it("bloqueia sem login com 401", async () => {
    const res = await request(app).get("/dividends");
    expect(res.status).toBe(401);
  });
});

describe("POST /dividends", () => {
  it("cadastra o ativo pelo ticker (mesma porta de goals/transactions) e registra o provento", async () => {
    const res = await request(app).post("/dividends").set("Cookie", cookiesA).send({
      ticker: TICKER,
      amount: 12.5,
      paidAt: "2026-04-10",
    });

    expect(res.status).toBe(201);
    // Decimal chega como string no JSON (mesmo contrato documentado no frontend)
    expect(res.body.amount).toBe("12.5");

    const ativo = await prisma.asset.findUnique({ where: { ticker: TICKER } });
    expect(ativo).not.toBeNull();
  });

  it("ticker inexistente na B3 → 404 com a mesma linguagem de goals/transactions", async () => {
    const res = await request(app).post("/dividends").set("Cookie", cookiesA).send({
      ticker: "ZZZZ9",
      amount: 5,
      paidAt: "2026-04-10",
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("B3");
  });
});

describe("GET /dividends — isolamento por usuário", () => {
  it("cada usuário só vê os próprios proventos", async () => {
    const deA = await request(app).get("/dividends").set("Cookie", cookiesA);
    expect(deA.status).toBe(200);
    expect(deA.body.some((p: { asset: { ticker: string } }) => p.asset.ticker === TICKER)).toBe(
      true,
    );

    const deB = await request(app).get("/dividends").set("Cookie", cookiesB);
    expect(deB.status).toBe(200);
    expect(deB.body).toHaveLength(0);
  });
});

describe("DELETE /dividends/:id — isolamento por usuário", () => {
  it("outro usuário não consegue apagar (404), e o provento continua existindo", async () => {
    const lista = await request(app).get("/dividends").set("Cookie", cookiesA);
    const id = lista.body[0].id as string;

    const tentativa = await request(app).delete(`/dividends/${id}`).set("Cookie", cookiesB);
    expect(tentativa.status).toBe(404);

    const aindaExiste = await prisma.dividend.findUnique({ where: { id } });
    expect(aindaExiste).not.toBeNull();
  });

  it("o dono consegue apagar o próprio provento", async () => {
    const lista = await request(app).get("/dividends").set("Cookie", cookiesA);
    const id = lista.body[0].id as string;

    const res = await request(app).delete(`/dividends/${id}`).set("Cookie", cookiesA);
    expect(res.status).toBe(204);

    const depois = await request(app).get("/dividends").set("Cookie", cookiesA);
    expect(depois.body).toHaveLength(0);
  });
});
