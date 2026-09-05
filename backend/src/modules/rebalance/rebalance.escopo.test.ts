import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Preço fixo de R$ 10 em qualquer ticker: com isso a conta de cabeça fecha e
// os números do teste dizem o que está sendo verificado.
const PRECO = 10;

vi.mock("../quotes/quotes.provider.js", () => ({
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
  buscarProventos: async () => [],
}));

const COM_META = "TXES1";
const SEM_META = "TXES2";
const email = `vitest-escopo-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];
let userId: string;

beforeAll(async () => {
  await request(app).post("/auth/register").send({ name: "Escopo", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];
  userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

  // R$ 1.000 em cada ativo — patrimônio total de R$ 2.000
  for (const ticker of [COM_META, SEM_META]) {
    await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker,
      kind: "COMPRA",
      quantity: 100,
      unitPrice: PRECO,
      executedAt: "2026-01-10",
    });
  }

  // meta de 100% em UM dos dois: o outro fica fora da simulação
  await request(app)
    .put("/goals")
    .set("Cookie", cookies)
    .send({ ticker: COM_META, targetWeight: 100 });
});

afterAll(async () => {
  await prisma.assetGoal.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.asset.deleteMany({ where: { ticker: { in: [COM_META, SEM_META] } } });
  await prisma.$disconnect();
});

describe("POST /rebalance/simulate — ativo sem meta fica fora da conta", () => {
  it("o denominador considera só o que tem meta", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 500 });

    expect(res.status).toBe(200);

    // Só COM_META entra: R$ 1.000 de posição + R$ 500 de aporte = R$ 1.500.
    // Se SEM_META entrasse no denominador, o total viraria R$ 2.500 e o
    // déficit de COM_META saltaria para R$ 1.500 — a distorção do defeito.
    expect(res.body.patrimonioConsiderado).toBe(1000);
    expect(res.body.patrimonioFinal).toBe(1500);
    expect(res.body.compras[0].deficit).toBe(500);
  });

  it("declara o que ficou de fora, com valor", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 500 });

    expect(res.body.foraDaSimulacao).toEqual({
      valor: 1000,
      ativos: [{ ticker: SEM_META, valor: 1000 }],
    });
  });

  it("informa a soma das metas, para a tela avisar quando não fecha 100%", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 500 });

    expect(res.body.somaMetas).toBe(100);
  });

  it("gasta o aporte todo quando as metas fecham 100%", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 500 });

    // R$ 500 a R$ 10 a unidade: 50 unidades, sem sobra
    expect(res.body.compras[0].quantidade).toBe(50);
    expect(res.body.totalGasto).toBe(500);
    expect(res.body.restante).toBe(0);
  });

  it("com metas somando menos de 100%, o resto do aporte sobra e é declarado", async () => {
    await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: COM_META, targetWeight: 60 });

    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 500 });

    expect(res.body.somaMetas).toBe(60);
    // 60% de R$ 1.500 = R$ 900, e a posição já é R$ 1.000: não há déficit.
    expect(res.body.compras).toHaveLength(0);
    expect(res.body.restante).toBe(500);

    // devolve a meta ao que era, para não vazar estado entre casos
    await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: COM_META, targetWeight: 100 });
  });
});
