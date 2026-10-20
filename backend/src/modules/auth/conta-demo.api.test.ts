import { randomUUID } from "node:crypto";
import { AssetType } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { EMAIL_DA_DEMO, MENSAGEM_DA_DEMO } from "../../shared/conta-demo.js";
import { authRepository } from "./auth.repository.js";

// Integração da conta de demonstração somente leitura, de ponta a ponta.
//
// O usuário é DESTE arquivo, não a carteira@portfoliolab.dev do seed-demo (que
// mora no mesmo Docker e não pode ser tocada). O "cookie da demo" é o token que
// o login emite para ela, { sub, demo: true }, assinado aqui para o usuário do
// teste. O corpo das escritas recusadas é vazio: se o bloqueio falhasse, o Zod
// responderia 400 antes de qualquer gravação.

// Cotação fixa, sem rede: a simulação resolve preço pelo provedor.
vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: async (ticker: string) => ({
    ticker: ticker.toUpperCase(),
    nome: "Ativo de Teste",
    preco: 10,
    tipo: "FII",
  }),
  buscarCotacoes: async (tickers: string[]) =>
    new Map(
      tickers.map((t) => [
        t.toUpperCase(),
        { ticker: t.toUpperCase(), nome: "Ativo de Teste", preco: 10, tipo: "FII" },
      ]),
    ),
  classificar: () => "FII",
}));

const email = `vitest-demo-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let userId: string;
let cookiesNormais: string[];
let cookieDaDemo: string;

beforeAll(async () => {
  // dado de referência global, como em rebalance.api.test.ts: upsert, sem remoção
  await prisma.asset.upsert({
    where: { ticker: "MXRF11" },
    update: {},
    create: { ticker: "MXRF11", name: "Maxi Renda FII", type: AssetType.FII, currentPrice: 10.85 },
  });

  await request(app).post("/auth/register").send({ name: "Testadora da Demo", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookiesNormais = login.headers["set-cookie"] as unknown as string[];
  userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

  // meta cadastrada com a sessão normal, para a simulação ter o que calcular
  const meta = await request(app)
    .put("/goals")
    .set("Cookie", cookiesNormais)
    .send({ ticker: "MXRF11", targetWeight: 100 });
  expect(meta.status).toBe(200);

  cookieDaDemo = `token=${jwt.sign({ sub: userId, demo: true }, env.JWT_SECRET, { expiresIn: "1h" })}`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.dividend.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.assetGoal.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("conta de demonstração com o cookie da demo", () => {
  it("POST /transactions → 403 com a mensagem da demo", async () => {
    const res = await request(app).post("/transactions").set("Cookie", cookieDaDemo).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(MENSAGEM_DA_DEMO);
  });

  it("recusa as outras escritas: metas, proventos manuais, relatórios e IA", async () => {
    const tentativas = [
      request(app).delete(`/transactions/${randomUUID()}`),
      request(app).put("/goals").send({}),
      request(app).put("/goals/batch").send({}),
      request(app).delete("/goals/MXRF11"),
      request(app).post("/dividends").send({}),
      request(app).delete(`/dividends/${randomUUID()}`),
      request(app).post("/reports"),
      request(app).post(`/reports/${randomUUID()}/ask`).send({}),
      request(app).delete(`/reports/${randomUUID()}`),
      request(app).post("/assets").send({}),
    ];
    for (const tentativa of tentativas) {
      const res = await tentativa.set("Cookie", cookieDaDemo);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe(MENSAGEM_DA_DEMO);
    }
    // a meta cadastrada antes continua lá
    expect(await prisma.assetGoal.count({ where: { userId } })).toBe(1);
  });

  it("POST /rebalance/simulate → 200 (simular é só conta)", async () => {
    const res = await request(app)
      .post("/rebalance/simulate")
      .set("Cookie", cookieDaDemo)
      .send({ amount: 1000 });
    expect(res.status).toBe(200);
  });

  it("POST /dividends/sync passa (só copia do provedor)", async () => {
    const res = await request(app).post("/dividends/sync").set("Cookie", cookieDaDemo);
    expect(res.status).toBe(200);
  });

  it("leitura continua liberada", async () => {
    for (const rota of ["/transactions", "/goals", "/dividends", "/reports", "/portfolio"]) {
      const res = await request(app).get(rota).set("Cookie", cookieDaDemo);
      expect(res.status, rota).toBe(200);
    }
  });

  it("/auth/logout continua funcionando", async () => {
    const res = await request(app).post("/auth/logout").set("Cookie", cookieDaDemo);
    expect(res.status).toBe(204);
  });
});

describe("token antigo da demo, emitido antes da claim", () => {
  it("é bloqueado na escrita: o e-mail da conta é conferido no banco", async () => {
    const tokenAntigo = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "1h" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    vi.spyOn(authRepository, "findById").mockResolvedValue({ ...user, email: EMAIL_DA_DEMO });

    const res = await request(app)
      .post("/transactions")
      .set("Cookie", `token=${tokenAntigo}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(MENSAGEM_DA_DEMO);
  });

  it("a conta normal, com o mesmo tipo de token, segue gravando", async () => {
    const res = await request(app).post("/transactions").set("Cookie", cookiesNormais).send({});
    // chega ao controller: o Zod recusa o corpo vazio, não a demo
    expect(res.status).toBe(400);
  });
});
