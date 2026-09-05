import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Provider fixo: mesmo molde de goals.api.test.ts/dividends.api.test.ts — evita bater na B3 real.
vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => {
    const simbolo = ticker.toUpperCase();
    if (simbolo === "NAOEXISTE11") return null; // ticker que não existe na B3
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

// Testes de INTEGRAÇÃO da carteira: fluxo completo
// registrar → logar → comprar → consultar posição → resumo

const email = `vitest-carteira-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];

beforeAll(async () => {
  await request(app)
    .post("/auth/register")
    .send({ name: "Testadora da Carteira", email, password });
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

describe("GET /portfolio (proteção)", () => {
  it("bloqueia sem login com 401", async () => {
    const res = await request(app).get("/portfolio");
    expect(res.status).toBe(401);
  });
});

describe("Fluxo: comprar → posição → resumo", () => {
  it("registra duas compras de PETR4", async () => {
    const r1 = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "PETR4",
      kind: "COMPRA",
      quantity: 10,
      unitPrice: 30,
      executedAt: "2026-02-01",
    });
    expect(r1.status).toBe(201);

    const r2 = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "petr4", // minúsculo de propósito: o schema normaliza
      kind: "COMPRA",
      quantity: 10,
      unitPrice: 40,
      executedAt: "2026-03-01",
    });
    expect(r2.status).toBe(201);
  });

  it("carteira mostra a posição com preço médio ponderado", async () => {
    const res = await request(app).get("/portfolio").set("Cookie", cookies);
    expect(res.status).toBe(200);

    const petr = res.body.find((a: { ticker: string }) => a.ticker === "PETR4");
    expect(petr).toBeDefined();

    // Derivados só das transações — independem do mercado
    expect(petr.quantidade).toBe(20);
    expect(petr.precoMedio).toBe(35); // (10×30 + 10×40) / 20
    expect(petr.valorAplicado).toBe(700);

    // O preço atual vem da cotação ao vivo, então o teste verifica a
    // INVARIANTE do cálculo, e não um valor de mercado fixo (que mudaria
    // a cada pregão e deixaria o teste intermitente).
    expect(petr.precoAtual).toBeGreaterThan(0);
    expect(petr.valorAtual).toBeCloseTo(petr.quantidade * petr.precoAtual, 2);
    expect(petr.lucro).toBeCloseTo(petr.valorAtual - petr.valorAplicado, 2);
    expect(petr.lucroPct).toBeCloseTo((petr.lucro / petr.valorAplicado) * 100, 1);
  });

  it("impede vender mais do que possui (400)", async () => {
    const res = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "PETR4",
      kind: "VENDA",
      quantity: 999,
      unitPrice: 40,
      executedAt: "2026-04-01",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Quantidade insuficiente");
  });

  it("recusa transação de ativo inexistente (404)", async () => {
    const res = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "NAOEXISTE11",
      kind: "COMPRA",
      quantity: 1,
      unitPrice: 10,
      executedAt: "2026-04-01",
    });
    expect(res.status).toBe(404);
  });

  it("summary consolida patrimônio e alocação por classe", async () => {
    const res = await request(app).get("/portfolio/summary").set("Cookie", cookies);
    expect(res.status).toBe(200);

    // totalAplicado vem das transações (fixo); o patrimônio depende da
    // cotação do dia, então checamos a coerência entre os três números
    expect(res.body.totalAplicado).toBe(700);
    expect(res.body.quantidadeAtivos).toBe(1);
    expect(res.body.patrimonioTotal).toBeGreaterThan(0);
    expect(res.body.lucroTotal).toBeCloseTo(
      res.body.patrimonioTotal - res.body.totalAplicado,
      2,
    );

    // este usuário só tem ações → 100% em ACAO
    expect(res.body.alocacaoPorClasse).toHaveLength(1);
    expect(res.body.alocacaoPorClasse[0].classe).toBe("ACAO");
    expect(res.body.alocacaoPorClasse[0].percentual).toBe(100);
  });

  it("totalTaxas soma as taxas de compra e venda de todo o histórico", async () => {
    // As duas compras do início do arquivo usam fee padrão (0). Esta compra e
    // esta venda somam R$4,00 em taxa — a venda especialmente, porque hoje o
    // service descarta a taxa da venda (achado 10 da auditoria).
    await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "PETR4",
      kind: "COMPRA",
      quantity: 5,
      unitPrice: 30,
      fee: 2.5,
      executedAt: "2026-05-01",
    });
    await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "PETR4",
      kind: "VENDA",
      quantity: 5,
      unitPrice: 32,
      fee: 1.5,
      executedAt: "2026-06-01",
    });

    const res = await request(app).get("/portfolio/summary").set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.totalTaxas).toBe(4);
  });

  it("totalTaxas conta a taxa mesmo de um ativo já totalmente vendido", async () => {
    const compra = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "VALE3",
      kind: "COMPRA",
      quantity: 10,
      unitPrice: 60,
      fee: 3,
      executedAt: "2026-07-01",
    });
    expect(compra.status).toBe(201);

    const venda = await request(app).post("/transactions").set("Cookie", cookies).send({
      ticker: "VALE3",
      kind: "VENDA",
      quantity: 10,
      unitPrice: 62,
      fee: 2,
      executedAt: "2026-07-02",
    });
    expect(venda.status).toBe(201);

    const carteira = await request(app).get("/portfolio").set("Cookie", cookies);
    expect(carteira.body.some((a: { ticker: string }) => a.ticker === "VALE3")).toBe(false);

    const res = await request(app).get("/portfolio/summary").set("Cookie", cookies);
    expect(res.status).toBe(200);
    // 4 (do teste anterior) + 3 + 2 = 9 — a taxa da VALE3 conta mesmo o
    // ativo tendo sumido da carteira (posição zerada)
    expect(res.body.totalTaxas).toBe(9);
  });
});
