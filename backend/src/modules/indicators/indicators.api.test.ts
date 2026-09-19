import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Mesmo molde de portfolio.api.test.ts: fixa o provedor para não bater na B3 real.
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
  buscarIndicadoresFundamentalistas: async () => null,
}));

const email = `vitest-indicadores-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];

beforeAll(async () => {
  // IDCT3 e BNCT3 são tickers fictícios só deste arquivo — mas a tabela
  // assets é global e persiste entre execuções da suíte. Sem esta limpeza,
  // rodar `npm test` duas vezes reaproveita o AssetIndicator da rodada
  // anterior (unique constraint em assetId) e o teste "ainda sem indicador"
  // vê dado velho em vez de null. Cascade apaga o indicator junto.
  await prisma.asset.deleteMany({ where: { ticker: { in: ["IDCT3", "BNCT3"] } } });

  await request(app)
    .post("/auth/register")
    .send({ name: "Testadora de Indicadores", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

describe("GET /indicators (proteção)", () => {
  it("bloqueia sem login com 401", async () => {
    const res = await request(app).get("/indicators");
    expect(res.status).toBe(401);
  });
});

describe("GET /indicators", () => {
  it("carteira sem ações devolve lista vazia", async () => {
    const res = await request(app).get("/indicators").set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("ação na carteira sem indicador calculado ainda aparece, com campos null", async () => {
    const compra = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "IDCT3",
      kind: "COMPRA",
      quantity: 10,
      unitPrice: 20,
      executedAt: "2026-01-01",
    });
    expect(compra.status).toBe(201);

    const res = await request(app).get("/indicators").set("Cookie", cookies);
    expect(res.status).toBe(200);

    const ativo = res.body.find((i: { ticker: string }) => i.ticker === "IDCT3");
    expect(ativo).toEqual({
      ticker: "IDCT3",
      name: "Ativo de Teste S.A.",
      pl: null,
      pvp: null,
      dividendYield: null,
      roe: null,
      roa: null,
      margemLiquida: null,
      setorBancario: false,
      atualizadoEm: null,
    });
  });

  it("job grava indicadores e a rota passa a devolvê-los", async () => {
    const asset = await prisma.asset.findUniqueOrThrow({ where: { ticker: "IDCT3" } });
    const dados = {
      pl: 15.5,
      pvp: 2.1,
      dividendYield: 3.4,
      roe: 18,
      roa: 4.2,
      margemLiquida: 9.9,
      industria: "Electrical Equipment & Parts",
    };
    await prisma.assetIndicator.upsert({
      where: { assetId: asset.id },
      create: { assetId: asset.id, ...dados },
      update: dados,
    });

    const res = await request(app).get("/indicators").set("Cookie", cookies);
    const ativo = res.body.find((i: { ticker: string }) => i.ticker === "IDCT3");

    expect(ativo.pl).toBe(15.5);
    expect(ativo.pvp).toBe(2.1);
    expect(ativo.dividendYield).toBe(3.4);
    expect(ativo.roe).toBe(18);
    expect(ativo.roa).toBe(4.2);
    expect(ativo.margemLiquida).toBe(9.9);
    expect(ativo.setorBancario).toBe(false);
    expect(typeof ativo.atualizadoEm).toBe("string");
  });

  it("ativo do setor bancário: setorBancario true na resposta", async () => {
    const compra = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "BNCT3",
      kind: "COMPRA",
      quantity: 10,
      unitPrice: 20,
      executedAt: "2026-01-01",
    });
    expect(compra.status).toBe(201);

    const asset = await prisma.asset.findUniqueOrThrow({ where: { ticker: "BNCT3" } });
    const dados = { roe: 30, roa: 8, industria: "Banks - Regional" };
    await prisma.assetIndicator.upsert({
      where: { assetId: asset.id },
      create: { assetId: asset.id, ...dados },
      update: dados,
    });

    const res = await request(app).get("/indicators").set("Cookie", cookies);
    const ativo = res.body.find((i: { ticker: string }) => i.ticker === "BNCT3");

    expect(ativo.setorBancario).toBe(true);
    expect(ativo.roa).toBe(8);
  });

  it("FII na carteira não entra na lista de indicadores fundamentalistas", async () => {
    const compra = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "MXRF11",
      kind: "COMPRA",
      quantity: 10,
      unitPrice: 10,
      executedAt: "2026-01-01",
    });
    expect(compra.status).toBe(201);
    // O provider mockado sempre classifica como ACAO — força o tipo do
    // ativo já cadastrado para FII, simulando o caso real de um fundo.
    await prisma.asset.update({ where: { ticker: "MXRF11" }, data: { type: "FII" } });

    const res = await request(app).get("/indicators").set("Cookie", cookies);
    expect(res.body.some((i: { ticker: string }) => i.ticker === "MXRF11")).toBe(false);
  });
});
