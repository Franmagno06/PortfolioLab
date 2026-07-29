import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";
import { classificar } from "./quotes.provider.js";

// A classificação é função pura — dá para cobrir todos os casos difíceis
// sem tocar na rede.
describe("classificar — a que classe o ativo pertence", () => {
  it("reconhece FII pelo nome, mesmo terminando em 11", () => {
    expect(classificar("MXRF11", "Maxi Renda Fundo De Investimento Imobiliaro - FII")).toBe("FII");
    expect(classificar("HGLG11", "CSHG Logistica FII")).toBe("FII");
  });

  it("reconhece ETF pelo nome, mesmo terminando em 11", () => {
    expect(classificar("BOVA11", "iShares Ibovespa Index Fund")).toBe("ETF");
    expect(classificar("IVVB11", "iShares S&P 500 ETF")).toBe("ETF");
  });

  it("trata ação ordinária e preferencial como ACAO", () => {
    expect(classificar("PETR4", "Petroleo Brasileiro SA Pfd")).toBe("ACAO");
    expect(classificar("VALE3", "Vale S.A.")).toBe("ACAO");
    expect(classificar("WEGE3", "WEG S.A.")).toBe("ACAO");
  });

  it("sem pista no nome, unit terminando em 11 cai como ACAO", () => {
    // ENGI11 é unit de empresa, não fundo — o sufixo 11 sozinho engana
    expect(classificar("ENGI11", "Energisa S.A.")).toBe("ACAO");
  });

  it("o nome tem prioridade sobre o número do ticker", () => {
    // ticker de ação, mas o nome diz que é fundo imobiliário
    expect(classificar("XPML3", "XP Malls Fundo Imobiliario")).toBe("FII");
  });
});

// Integração do endpoint de consulta. Depende do Yahoo Finance, então os
// testes toleram indisponibilidade da fonte externa.
const email = `vitest-quotes-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];

beforeAll(async () => {
  await request(app).post("/auth/register").send({ name: "Testadora Quotes", email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  cookies = login.headers["set-cookie"] as unknown as string[];
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

describe("GET /quotes/:ticker", () => {
  it("exige login", async () => {
    const res = await request(app).get("/quotes/PETR4");
    expect(res.status).toBe(401);
  });

  it("recusa ticker fora do formato da B3", async () => {
    for (const invalido of ["ABC", "PETR", "12345", "PETR456"]) {
      const res = await request(app).get(`/quotes/${invalido}`).set("Cookie", cookies);
      expect(res.status).toBe(400);
    }
  });

  it("devolve 404 para ticker inexistente", async () => {
    const res = await request(app).get("/quotes/ZZZZ9").set("Cookie", cookies);
    expect(res.status).toBe(404);
  });

  it("devolve cotação com preço positivo", async () => {
    const res = await request(app).get("/quotes/PETR4").set("Cookie", cookies);

    // fonte externa fora do ar não deve reprovar o teste
    if (res.status === 404) return;

    expect(res.status).toBe(200);
    expect(res.body.ticker).toBe("PETR4");
    expect(typeof res.body.nome).toBe("string");
    expect(res.body.preco).toBeGreaterThan(0);
    expect(["ACAO", "FII", "ETF", "RENDA_FIXA"]).toContain(res.body.tipo);
  });

  it("aceita o ticker em minúsculas e normaliza", async () => {
    const res = await request(app).get("/quotes/petr4").set("Cookie", cookies);
    if (res.status === 404) return;
    expect(res.body.ticker).toBe("PETR4");
  });
});
