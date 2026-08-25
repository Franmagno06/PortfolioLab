import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// A B3 fica de fora: o provider é trocado por um preço fixo, para o teste ser
// determinístico e rodar sem rede. O ticker abaixo não existe no mundo real.
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
}));

const TICKER = "TXDL1"; // exclusivo deste arquivo de teste
const email = `vitest-transactions-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];
let compraId: string;
let vendaId: string;

beforeAll(async () => {
  await request(app)
    .post("/auth/register")
    .send({ name: "Testadora de Transações", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });
  await prisma.$disconnect();
});

describe("POST /transactions", () => {
  it("bloqueia sem login", async () => {
    const res = await request(app).post("/transactions").send({ ticker: TICKER });
    expect(res.status).toBe(401);
  });

  it("registra a compra e cadastra o ativo automaticamente", async () => {
    const res = await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({
        ticker: TICKER,
        kind: "COMPRA",
        quantity: 100,
        unitPrice: 10,
        fee: 0,
        executedAt: "2026-01-01",
      });

    expect(res.status).toBe(201);
    compraId = res.body.id;

    const ativo = await prisma.asset.findUnique({ where: { ticker: TICKER } });
    expect(ativo).not.toBeNull();
  });

  it("recusa venda maior do que a posição", async () => {
    const res = await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({
        ticker: TICKER,
        kind: "VENDA",
        quantity: 500,
        unitPrice: 12,
        fee: 0,
        executedAt: "2026-02-01",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("insuficiente");
  });

  it("registra a venda que zera a posição", async () => {
    const res = await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({
        ticker: TICKER,
        kind: "VENDA",
        quantity: 100,
        unitPrice: 12,
        fee: 0,
        executedAt: "2026-02-01",
      });

    expect(res.status).toBe(201);
    vendaId = res.body.id;
  });
});

// Achado 4 da auditoria: hoje o DELETE responde 204 e deixa a posição em −100.
describe("DELETE /transactions/:id — não pode corromper a posição", () => {
  it("recusa apagar a compra que cobre uma venda posterior", async () => {
    const res = await request(app)
      .delete(`/transactions/${compraId}`)
      .set("Cookie", cookies);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain(TICKER);
  });

  it("a posição continua intacta depois da recusa", async () => {
    const res = await request(app).get("/transactions").set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const asset = await prisma.asset.findUniqueOrThrow({ where: { ticker: TICKER } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const compras = await prisma.transaction.count({
      where: { userId: user.id, assetId: asset.id, kind: "COMPRA" },
    });
    expect(compras).toBe(1);
  });

  it("404 para transação de outro usuário (ou inexistente)", async () => {
    const res = await request(app)
      .delete(`/transactions/${randomUUID()}`)
      .set("Cookie", cookies);
    expect(res.status).toBe(404);
  });

  it("apagar a venda é sempre permitido — só aumenta a quantidade", async () => {
    const res = await request(app).delete(`/transactions/${vendaId}`).set("Cookie", cookies);
    expect(res.status).toBe(204);
  });

  it("sem a venda, a compra pode ser apagada", async () => {
    const res = await request(app).delete(`/transactions/${compraId}`).set("Cookie", cookies);
    expect(res.status).toBe(204);

    const lista = await request(app).get("/transactions").set("Cookie", cookies);
    expect(lista.body).toHaveLength(0);
  });
});

// A posição de hoje pode ser suficiente e a venda mesmo assim ficar descoberta:
// basta datá-la antes da compra que a cobre. Sem esta guarda, o histórico entra
// negativo no meio da sequência, o preço médio sai errado — e o DELETE passa a
// recusar as duas compras, deixando o usuário preso.
describe("POST /transactions — venda com data retroativa", () => {
  let primeira: string;
  let segunda: string;

  it("registra duas compras em datas diferentes", async () => {
    const um = await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({ ticker: TICKER, kind: "COMPRA", quantity: 10, unitPrice: 10, fee: 0, executedAt: "2026-03-01" });
    const dois = await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({ ticker: TICKER, kind: "COMPRA", quantity: 10, unitPrice: 20, fee: 0, executedAt: "2026-05-01" });

    expect(um.status).toBe(201);
    expect(dois.status).toBe(201);
    primeira = um.body.id;
    segunda = dois.body.id;
  });

  it("recusa a venda datada entre as duas compras", async () => {
    // possui 20 hoje, mas só possuía 10 em abril
    const res = await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({ ticker: TICKER, kind: "VENDA", quantity: 15, unitPrice: 25, fee: 0, executedAt: "2026-04-01" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(TICKER);
  });

  it("o preço médio continua correto e as compras seguem apagáveis", async () => {
    const carteira = await request(app).get("/portfolio").set("Cookie", cookies);
    const posicao = carteira.body.find((a: { ticker: string }) => a.ticker === TICKER);
    expect(posicao.quantidade).toBe(20);
    expect(posicao.precoMedio).toBe(15);

    for (const id of [segunda, primeira]) {
      const res = await request(app).delete(`/transactions/${id}`).set("Cookie", cookies);
      expect(res.status).toBe(204);
    }
  });

  it("aceita a mesma venda na data em que a posição já existe", async () => {
    await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({ ticker: TICKER, kind: "COMPRA", quantity: 20, unitPrice: 10, fee: 0, executedAt: "2026-03-01" });

    const res = await request(app)
      .post("/transactions")
      .set("Cookie", cookies)
      .send({ ticker: TICKER, kind: "VENDA", quantity: 15, unitPrice: 25, fee: 0, executedAt: "2026-04-01" });

    expect(res.status).toBe(201);
  });
});
