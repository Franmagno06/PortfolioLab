import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";
import { buscarDadosAcao } from "./cvm.provider.js";
import { ITR_DE_INDUSTRIA } from "./dados-de-teste.js";

// Rota de ponta a ponta no Postgres local, com a CVM simulada: o que interessa aqui é o HTTP, o banco
// e o isolamento entre contas. As regras da consulta estão em reports.service.test.ts.
vi.mock("./cvm.provider.js", () => ({ buscarDadosAcao: vi.fn(), buscarDadosFii: vi.fn() }));

// Ticker que não existe na B3: o ativo é criado pelo teste, com preço recém-atualizado para a rota
// não ir ao Yahoo, e apagado no fim (os cvm_summaries dele saem junto, em cascata).
const TICKER = "VTSR3";
const emailA = `vitest-reports-a-${randomUUID()}@portfoliolab.dev`;
const emailB = `vitest-reports-b-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookiesA: string[];
let cookiesB: string[];

async function entrar(nome: string, email: string): Promise<string[]> {
  await request(app).post("/auth/register").send({ name: nome, email, password });
  const login = await request(app).post("/auth/login").send({ email, password });
  return login.headers["set-cookie"] as unknown as string[];
}

const consultar = (cookies: string[], corpo: object) => request(app).post("/reports").set("Cookie", cookies).send(corpo);

async function limpar() {
  await prisma.report.deleteMany({ where: { user: { email: { in: [emailA, emailB] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });
}

beforeAll(async () => {
  await limpar();
  await prisma.asset.create({
    data: {
      ticker: TICKER,
      name: "Vitest Relatórios S.A.",
      type: "ACAO",
      currentPrice: 10,
      priceUpdatedAt: new Date(),
      cnpj: "00.000.000/0001-00",
    },
  });
  cookiesA = await entrar("Testadora A", emailA);
  cookiesB = await entrar("Testadora B", emailB);
  // a CVM "tem" o 1T26 e o 2T26 desse ativo
  vi.mocked(buscarDadosAcao).mockImplementation(async (_cnpj, p) =>
    p.ano === 2026 && p.trimestre <= 2 ? ITR_DE_INDUSTRIA : null,
  );
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("POST /reports", () => {
  it("sem login: 401", async () => {
    const res = await request(app).post("/reports").send({ ticker: TICKER });

    expect(res.status).toBe(401);
  });

  it("cria o relatório do período pedido: 201 com a análise da CVM", async () => {
    const res = await consultar(cookiesA, { ticker: TICKER.toLowerCase(), periodo: "1T26" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fileName: `${TICKER} 1T26`,
      source: "CVM",
      period: "2026-T1",
      asset: { ticker: TICKER, type: "ACAO" },
    });
    expect(res.body.analysis.tipoDocumento).toBe("Informações Trimestrais (ITR)");
    expect(res.body.analysis.indicadores).toContainEqual({
      nome: "Margem líquida",
      valor: "20,0%",
      definicao: "Lucro ÷ receita, no mesmo período.",
    });
    expect(res.body.analysis.versao).toBe(3);
    expect(res.body.analysis.destaques.map((d: { titulo: string }) => d.titulo)).toContain("Lucro no período");
    expect(res.body.analysis.blocos[0].titulo).toBe("O documento");
  });

  it("pedir de novo o mesmo período devolve o mesmo relatório com 200, sem duplicar", async () => {
    const primeira = await consultar(cookiesA, { ticker: TICKER, periodo: "2026-T2" });
    const segunda = await consultar(cookiesA, { ticker: TICKER, periodo: "2T26" });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect(segunda.body.id).toBe(primeira.body.id);
    expect(await prisma.report.count({ where: { user: { email: emailA }, period: "2026-T2" } })).toBe(1);
  });

  it("a segunda conta reaproveita o cache: a CVM não é lida de novo para o mesmo ativo e período", async () => {
    const leiturasAntes = vi.mocked(buscarDadosAcao).mock.calls.length;

    const res = await consultar(cookiesB, { ticker: TICKER, periodo: "1T26" });

    expect(res.status).toBe(201);
    expect(vi.mocked(buscarDadosAcao).mock.calls.length).toBe(leiturasAntes);
  });

  it("o caminho antigo POST /reports/cvm continua valendo", async () => {
    const res = await request(app).post("/reports/cvm").set("Cookie", cookiesA).send({ ticker: TICKER, periodo: "1T26" });

    expect(res.status).toBe(200); // A já tem o 1T26
  });

  it("período que a CVM não tem: 404 com mensagem", async () => {
    const res = await consultar(cookiesA, { ticker: TICKER, periodo: "4T25" });

    expect(res.status).toBe(404);
    expect(res.body.message ?? res.body.error).toContain(TICKER);
  });

  it.each([
    ["sem ticker", {}],
    ["ticker com símbolo", { ticker: "VT$R3" }],
    ["período comprido demais", { ticker: TICKER, periodo: "2026-T1-extra" }],
  ])("corpo inválido (%s): 400", async (_nome, corpo) => {
    expect((await consultar(cookiesA, corpo)).status).toBe(400);
  });

  it("upload de PDF não é mais aceito: multipart sem ticker dá 400, e nada é guardado", async () => {
    const antes = await prisma.report.count({ where: { user: { email: emailA } } });

    const res = await request(app)
      .post("/reports")
      .set("Cookie", cookiesA)
      .attach("file", Buffer.from("%PDF-1.4"), { filename: "relatorio.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(400);
    expect(await prisma.report.count({ where: { user: { email: emailA } } })).toBe(antes);
  });
});

describe("GET /reports", () => {
  it("lista só os relatórios da própria conta, com ativo e análise, sem o texto extraído", async () => {
    const deA = await request(app).get("/reports").set("Cookie", cookiesA);
    const deB = await request(app).get("/reports").set("Cookie", cookiesB);

    expect(deA.status).toBe(200);
    expect(deA.body.itens.map((r: { period: string }) => r.period).sort()).toEqual(["2026-T1", "2026-T2"]);
    expect(deB.body.itens).toHaveLength(1);
    expect(deA.body.itens[0]).toMatchObject({ source: "CVM", asset: { ticker: TICKER, type: "ACAO" } });
    expect(deA.body.itens[0]).not.toHaveProperty("extractedText");
    expect(deA.body.itens[0].analysis.versao).toBeTypeOf("number");
  });
});

describe("rotas que deixaram de existir", () => {
  it("POST /reports/:id/ask (chat sobre o PDF): 404", async () => {
    const lista = await request(app).get("/reports").set("Cookie", cookiesA);
    const id = lista.body.itens[0].id as string;

    const res = await request(app).post(`/reports/${id}/ask`).set("Cookie", cookiesA).send({ question: "qual a vacância?" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /reports/:id — isolamento por usuário", () => {
  it("B não apaga relatório de A: 404, e o relatório continua lá", async () => {
    const lista = await request(app).get("/reports").set("Cookie", cookiesA);
    const id = lista.body.itens[0].id as string;

    const res = await request(app).delete(`/reports/${id}`).set("Cookie", cookiesB);

    expect(res.status).toBe(404);
    expect(await prisma.report.count({ where: { id } })).toBe(1);
  });

  it("A apaga o próprio: 204, some da lista, e o cache do ativo fica", async () => {
    const lista = await request(app).get("/reports").set("Cookie", cookiesA);
    const alvo = lista.body.itens.find((r: { period: string }) => r.period === "2026-T2") as { id: string };

    const res = await request(app).delete(`/reports/${alvo.id}`).set("Cookie", cookiesA);

    expect(res.status).toBe(204);
    expect(await prisma.report.count({ where: { id: alvo.id } })).toBe(0);
    expect(await prisma.cvmSummary.count({ where: { asset: { ticker: TICKER }, period: "2026-T2" } })).toBe(1);
  });
});
