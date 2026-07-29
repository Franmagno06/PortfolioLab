import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Integração: metas de alocação + simulação de aporte de ponta a ponta

const email = `vitest-rebalance-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];

beforeAll(async () => {
  await request(app)
    .post("/auth/register")
    .send({ name: "Testadora do Rebalance", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.assetGoal.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

describe("Metas de alocação (/goals)", () => {
  it("cadastra meta para MXRF11", async () => {
    const res = await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: "MXRF11", targetWeight: 60 });
    expect(res.status).toBe(200);
    expect(res.body.somaTotal).toBe(60);
  });

  it("recusa meta que estoura 100% no total", async () => {
    const res = await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: "BOVA11", targetWeight: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("100%");
  });

  it("aceita meta que fecha exatamente em 100%", async () => {
    const res = await request(app)
      .put("/goals")
      .set("Cookie", cookies)
      .send({ ticker: "BOVA11", targetWeight: 40 });
    expect(res.status).toBe(200);
    expect(res.body.somaTotal).toBe(100);
  });
});

describe("Simulação de aporte (/rebalance/simulate)", () => {
  it("bloqueia sem login", async () => {
    const res = await request(app).post("/rebalance/simulate").send({ amount: 100 });
    expect(res.status).toBe(401);
  });

  it("simula aporte de R$200 com carteira vazia", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: 200 });

    expect(res.status).toBe(200);
    expect(res.body.patrimonioAtual).toBe(0);
    expect(res.body.patrimonioFinal).toBe(200);

    // Os preços vêm da cotação ao vivo, então as quantidades exatas mudam
    // a cada pregão. O que precisa valer SEMPRE são as regras do algoritmo:
    type Compra = {
      ticker: string;
      quantidade: number;
      precoUnitario: number;
      total: number;
      deficit: number;
    };
    const compras: Compra[] = res.body.compras;

    for (const c of compras) {
      // só compra unidade inteira — não existe meia cota
      expect(Number.isInteger(c.quantidade)).toBe(true);
      expect(c.quantidade).toBeGreaterThan(0);
      // o total bate com quantidade × preço
      expect(c.total).toBeCloseTo(c.quantidade * c.precoUnitario, 2);
      // nunca compra além do déficit do ativo
      expect(c.total).toBeLessThanOrEqual(c.deficit + 0.01);
    }

    // não gasta mais do que o aporte, e o troco fecha a conta
    expect(res.body.totalGasto).toBeLessThanOrEqual(200);
    expect(res.body.totalGasto + res.body.restante).toBeCloseTo(200, 2);

    // MXRF11 tem a maior meta (60%), então é o primeiro a ser atendido
    if (compras.length > 0) {
      expect(compras[0]?.ticker).toBe("MXRF11");
    }
  });

  it("valor de aporte inválido → 400", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookies)
      .send({ amount: -50 });
    expect(res.status).toBe(400);
  });
});
