import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn().mockResolvedValue({}),
  extractText: vi.fn().mockResolvedValue({ text: "conteúdo de teste do relatório" }),
}));

vi.mock("./gemini.js", () => ({
  analisarRelatorio: vi.fn().mockResolvedValue({
    tipoDocumento: "Relatório de teste",
    resumoExecutivo: ["ponto 1"],
    alertas: [],
    indicadores: [],
  }),
  perguntarAoRelatorio: vi.fn().mockResolvedValue("resposta de teste"),
}));

const emailA = `vitest-reports-a-${randomUUID()}@portfoliolab.dev`;
const emailB = `vitest-reports-b-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookiesA: string[];
let cookiesB: string[];
let reportIdDeA: string;

beforeAll(async () => {
  await request(app).post("/auth/register").send({ name: "Testadora A", email: emailA, password });
  const loginA = await request(app).post("/auth/login").send({ email: emailA, password });
  cookiesA = loginA.headers["set-cookie"] as unknown as string[];

  await request(app).post("/auth/register").send({ name: "Testadora B", email: emailB, password });
  const loginB = await request(app).post("/auth/login").send({ email: emailB, password });
  cookiesB = loginB.headers["set-cookie"] as unknown as string[];

  const upload = await request(app)
    .post("/reports")
    .set("Cookie", cookiesA)
    .attach("file", Buffer.from("%PDF-1.4 conteúdo irrelevante — unpdf está mockado"), {
      filename: "relatorio.pdf",
      contentType: "application/pdf",
    });
  reportIdDeA = upload.body.id as string;
});

afterAll(async () => {
  await prisma.report.deleteMany({ where: { user: { email: { in: [emailA, emailB] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.$disconnect();
});

describe("upload", () => {
  it("cria o relatório de A com sucesso", () => {
    expect(reportIdDeA).toBeDefined();
  });
});

describe("POST /reports/:id/ask — isolamento por usuário", () => {
  it("B não consegue perguntar sobre o relatório de A (404)", async () => {
    const res = await request(app)
      .post(`/reports/${reportIdDeA}/ask`)
      .set("Cookie", cookiesB)
      .send({ question: "qual o resumo deste relatório?" });

    expect(res.status).toBe(404);
  });

  it("A consegue perguntar sobre o próprio relatório", async () => {
    const res = await request(app)
      .post(`/reports/${reportIdDeA}/ask`)
      .set("Cookie", cookiesA)
      .send({ question: "qual o resumo deste relatório?" });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe("resposta de teste");
  });
});

describe("DELETE /reports/:id — isolamento por usuário", () => {
  it("B não consegue apagar o relatório de A (404), e ele continua existindo", async () => {
    const res = await request(app).delete(`/reports/${reportIdDeA}`).set("Cookie", cookiesB);
    expect(res.status).toBe(404);

    const aindaExiste = await prisma.report.findUnique({ where: { id: reportIdDeA } });
    expect(aindaExiste).not.toBeNull();
  });

  it("A consegue apagar o próprio relatório", async () => {
    const res = await request(app).delete(`/reports/${reportIdDeA}`).set("Cookie", cookiesA);
    expect(res.status).toBe(204);
  });
});
