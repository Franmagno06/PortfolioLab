import { randomUUID } from "node:crypto";
import { AssetType } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Cotação viva fixa em R$ 32,00 — enquanto o banco guarda R$ 38,20.
// É a divergência que o achado 1 escondia.
const PRECO_VIVO = 32;
const PRECO_NO_BANCO = 38.2;

vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => ({
    ticker: ticker.toUpperCase(),
    nome: "Ativo de Teste S.A.",
    preco: 32,
    tipo: "ACAO",
  }),
  buscarCotacoes: async (tickers: string[]) =>
    new Map(
      tickers.map((t) => [
        t.toUpperCase(),
        { ticker: t.toUpperCase(), nome: "Ativo de Teste S.A.", preco: 32, tipo: "ACAO" },
      ]),
    ),
  classificar: () => "ACAO",
}));

const TICKER = "TXRB1";
const HA_DUAS_HORAS = new Date(Date.now() - 2 * 60 * 60 * 1000);

const email = `vitest-simulate-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];

/** Devolve o ativo ao estado do defeito: preço velho no banco, cotação vencida. */
async function precoDefasadoNoBanco() {
  await prisma.asset.updateMany({
    where: { ticker: TICKER },
    data: { currentPrice: PRECO_NO_BANCO, priceUpdatedAt: HA_DUAS_HORAS },
  });
}

beforeAll(async () => {
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });
  await prisma.asset.create({
    data: {
      ticker: TICKER,
      name: "Ativo de Teste S.A.",
      type: AssetType.ACAO,
      currentPrice: PRECO_NO_BANCO,
      priceUpdatedAt: HA_DUAS_HORAS,
    },
  });

  await request(app).post("/auth/register").send({ name: "Testadora Simulate", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];

  await request(app)
    .put("/goals")
    .set("Cookie", cookies)
    .send({ ticker: TICKER, targetWeight: 100 });
});

beforeEach(precoDefasadoNoBanco);

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.assetGoal.deleteMany({ where: { userId: user.id } });
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });
  await prisma.$disconnect();
});

// Achado 1: valorAtual vinha da cotação viva e precoAtual da coluna antiga.
// Com o preço do banco (38,20), a divisão manda comprar 26 unidades; com o
// preço vivo (32,00), 31. O aporte paga 31.
describe("POST /rebalance/simulate — um preço só por ativo", () => {
  it("divide o aporte pelo preço vivo, não pelo preço guardado no banco", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 1000 });

    expect(res.status).toBe(200);
    const compra = res.body.compras[0];

    expect(compra.ticker).toBe(TICKER);
    expect(compra.precoUnitario).toBe(PRECO_VIVO);
    expect(compra.quantidade).toBe(Math.floor(1000 / PRECO_VIVO));
    expect(compra.total).toBeCloseTo(Math.floor(1000 / PRECO_VIVO) * PRECO_VIVO, 2);
  });

  it("o patrimônio da posição existente também usa o preço vivo", async () => {
    await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({
        ticker: TICKER,
        kind: "COMPRA",
        quantity: 10,
        unitPrice: PRECO_NO_BANCO,
        fee: 0,
        executedAt: "2026-01-01",
      });
    await precoDefasadoNoBanco();

    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 1000 });

    expect(res.status).toBe(200);
    // 10 unidades × R$ 32,00 = R$ 320,00 (e não 10 × 38,20 = 382,00)
    expect(res.body.patrimonioAtual).toBe(10 * PRECO_VIVO);
    expect(res.body.patrimonioFinal).toBe(10 * PRECO_VIVO + 1000);

    // meta de 100%: o déficit é o aporte inteiro
    const compra = res.body.compras[0];
    expect(compra.precoUnitario).toBe(PRECO_VIVO);
    expect(compra.quantidade).toBe(Math.floor(1000 / PRECO_VIVO));
  });

  it("o preço da simulação é o mesmo que a carteira mostra", async () => {
    const [simulacao, carteira] = await Promise.all([
      request(app).post("/rebalance/simulate").set("Cookie", cookies).send({ amount: 1000 }),
      request(app).get("/portfolio").set("Cookie", cookies),
    ]);

    const naSimulacao = simulacao.body.compras[0].precoUnitario;
    const naCarteira = carteira.body.find((a: { ticker: string }) => a.ticker === TICKER);
    expect(naSimulacao).toBe(naCarteira.precoAtual);
  });
});
