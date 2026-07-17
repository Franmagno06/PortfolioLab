import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

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
    expect(petr.quantidade).toBe(20);
    expect(petr.precoMedio).toBe(35); // (10×30 + 10×40) / 20
    expect(petr.valorAplicado).toBe(700);
    expect(petr.valorAtual).toBe(764); // 20 × preço atual (38,20)
    expect(petr.lucro).toBe(64);
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

    expect(res.body.patrimonioTotal).toBe(764);
    expect(res.body.totalAplicado).toBe(700);
    expect(res.body.lucroTotal).toBe(64);
    expect(res.body.quantidadeAtivos).toBe(1);

    // este usuário só tem ações → 100% em ACAO
    expect(res.body.alocacaoPorClasse).toHaveLength(1);
    expect(res.body.alocacaoPorClasse[0].classe).toBe("ACAO");
    expect(res.body.alocacaoPorClasse[0].percentual).toBe(100);
  });
});
