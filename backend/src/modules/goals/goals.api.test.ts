import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Provider fixo: o teste precisa de um ticker que NÃO esteja na tabela assets,
// e isso só é possível com a busca na B3 sob controle.
vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => {
    const simbolo = ticker.toUpperCase();
    if (simbolo === "ZZZZ9") return null; // ticker que não existe na B3
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

// Tickers exclusivos deste arquivo: nenhum deles existe em assets no começo
const NUNCA_NEGOCIADO = "TXGL1";
const SEGUNDO = "TXGL2";
const TERCEIRO = "TXGL3";
const QUARTO = "TXGL4";

const email = `vitest-goals-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];

beforeAll(async () => {
  await prisma.asset.deleteMany({ where: { ticker: { in: [NUNCA_NEGOCIADO, SEGUNDO, TERCEIRO, QUARTO] } } });

  await request(app).post("/auth/register").send({ name: "Testadora Goals", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.assetGoal.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.asset.deleteMany({ where: { ticker: { in: [NUNCA_NEGOCIADO, SEGUNDO, TERCEIRO, QUARTO] } } });
  await prisma.$disconnect();
});

// Achado 2 da auditoria: hoje isto responde 404, porque goalsService resolve o
// ticker com assetsRepository.findByTicker, que só consulta o catálogo local.
describe("PUT /goals — meta de ativo ainda não comprado", () => {
  it("aceita ticker que o usuário nunca negociou e cadastra o ativo", async () => {
    const antes = await prisma.asset.findUnique({ where: { ticker: NUNCA_NEGOCIADO } });
    expect(antes).toBeNull();

    const res = await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: NUNCA_NEGOCIADO, targetWeight: 20 });

    expect(res.status).toBe(200);
    expect(res.body.somaTotal).toBe(20);
    expect(res.body.metas.map((m: { ticker: string }) => m.ticker)).toContain(NUNCA_NEGOCIADO);

    const depois = await prisma.asset.findUnique({ where: { ticker: NUNCA_NEGOCIADO } });
    expect(depois).not.toBeNull();
    expect(depois?.currentPrice.toNumber()).toBe(20);
  });

  it("uma conta sem nenhuma transação monta a carteira-alvo inteira", async () => {
    const res = await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: SEGUNDO, targetWeight: 80 });

    expect(res.status).toBe(200);
    expect(res.body.somaTotal).toBe(100);
  });

  it("ticker inexistente na B3 → 404 com a mesma linguagem de transações", async () => {
    const res = await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: "ZZZZ9", targetWeight: 5 });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("B3");
  });

  it("apagar meta de ticker desconhecido continua 404, sem cadastrar nada", async () => {
    const res = await request(app).delete("/goals/ZZZZ9").set("Cookie", cookies);
    expect(res.status).toBe(404);
    expect(await prisma.asset.findUnique({ where: { ticker: "ZZZZ9" } })).toBeNull();
  });

  it("a soma das metas continua limitada a 100%", async () => {
    const res = await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: NUNCA_NEGOCIADO, targetWeight: 40 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("100%");
  });
});

// Achado 3: o catálogo passa a ser o do usuário — e a meta é um dos vínculos
describe("GET /assets — o ativo com meta entra no catálogo do usuário", () => {
  it("lista os ativos que o usuário só tem como meta", async () => {
    const res = await request(app).get("/assets").set("Cookie", cookies);
    expect(res.status).toBe(200);

    const tickers = res.body.map((a: { ticker: string }) => a.ticker);
    expect(tickers).toContain(NUNCA_NEGOCIADO);
    expect(tickers).toContain(SEGUNDO);
  });
});

// Achado 11 da auditoria: trocar A de 60% para 10% e B de 10% para 60% numa
// única chamada. Pela rota unitária, item a item, o estado intermediário
// (A ainda em 60% + B já em 60% = 120%) seria recusado.
describe("PUT /goals/batch — troca de alocação numa chamada só", () => {
  it("grava o conjunto completo dentro de uma transação", async () => {
    const inicial = await request(app)
      .put("/goals/batch")
      .set("Cookie", cookies)
      .send({
        metas: [
          { ticker: TERCEIRO, targetWeight: 60 },
          { ticker: QUARTO, targetWeight: 10 },
        ],
      });
    expect(inicial.status).toBe(200);
    expect(inicial.body.somaTotal).toBe(70);

    const troca = await request(app)
      .put("/goals/batch")
      .set("Cookie", cookies)
      .send({
        metas: [
          { ticker: TERCEIRO, targetWeight: 10 },
          { ticker: QUARTO, targetWeight: 60 },
        ],
      });

    expect(troca.status).toBe(200);
    expect(troca.body.somaTotal).toBe(70);
    const porTicker = Object.fromEntries(
      troca.body.metas.map((m: { ticker: string; targetWeight: number }) => [
        m.ticker,
        m.targetWeight,
      ]),
    );
    expect(porTicker[TERCEIRO]).toBe(10);
    expect(porTicker[QUARTO]).toBe(60);
  });

  it("recusa lote cuja soma passa de 100%, sem gravar nada", async () => {
    const antes = await request(app).get("/goals").set("Cookie", cookies);

    const res = await request(app)
      .put("/goals/batch")
      .set("Cookie", cookies)
      .send({
        metas: [
          { ticker: TERCEIRO, targetWeight: 90 },
          { ticker: QUARTO, targetWeight: 30 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("100%");

    const depois = await request(app).get("/goals").set("Cookie", cookies);
    expect(depois.body.metas).toEqual(antes.body.metas);
  });

  it("ticker inexistente na B3 recusa o lote inteiro, sem estado meio salvo", async () => {
    const antes = await request(app).get("/goals").set("Cookie", cookies);

    const res = await request(app)
      .put("/goals/batch")
      .set("Cookie", cookies)
      .send({
        metas: [
          { ticker: TERCEIRO, targetWeight: 20 },
          { ticker: "ZZZZ9", targetWeight: 5 },
        ],
      });

    expect(res.status).toBe(404);

    const depois = await request(app).get("/goals").set("Cookie", cookies);
    expect(depois.body.metas).toEqual(antes.body.metas);
  });

  it("recusa ticker repetido no mesmo lote", async () => {
    const res = await request(app)
      .put("/goals/batch")
      .set("Cookie", cookies)
      .send({
        metas: [
          { ticker: TERCEIRO, targetWeight: 20 },
          { ticker: TERCEIRO, targetWeight: 30 },
        ],
      });

    expect(res.status).toBe(400);
  });
});
