import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../database/prisma.js";

// Integração do feed de notícias. As fontes são externas (RSS de terceiros),
// então os testes verificam o CONTRATO da resposta e a classificação por
// carteira — não o conteúdo das manchetes, que muda o tempo todo.

const email = `vitest-news-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";
let cookies: string[];

beforeAll(async () => {
  await request(app).post("/auth/register").send({ name: "Testadora News", email, password });
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

describe("GET /news", () => {
  it("exige login", async () => {
    const res = await request(app).get("/news");
    expect(res.status).toBe(401);
  });

  it("devolve as duas listas e a data de atualização", async () => {
    const res = await request(app).get("/news").set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.daSuaCarteira)).toBe(true);
    expect(Array.isArray(res.body.mercado)).toBe(true);
    expect(new Date(res.body.atualizadoEm).toString()).not.toBe("Invalid Date");
  });

  it("carteira vazia não classifica nada como 'da sua carteira'", async () => {
    const res = await request(app).get("/news").set("Cookie", cookies);
    // este usuário foi criado agora e não tem transações
    expect(res.body.daSuaCarteira).toHaveLength(0);
  });

  it("cada notícia traz título, link, fonte e data", async () => {
    const res = await request(app).get("/news").set("Cookie", cookies);
    const todas = [...res.body.daSuaCarteira, ...res.body.mercado];

    // se todas as fontes externas estiverem fora do ar, não há o que checar
    if (todas.length === 0) return;

    for (const n of todas) {
      expect(typeof n.titulo).toBe("string");
      expect(n.titulo.length).toBeGreaterThan(0);
      expect(n.link).toMatch(/^https?:\/\//);
      expect(typeof n.fonte).toBe("string");
      expect(new Date(n.publicadoEm).toString()).not.toBe("Invalid Date");
      expect(Array.isArray(n.tickers)).toBe(true);
    }
  });

  it("títulos não contêm entidades HTML cruas", async () => {
    const res = await request(app).get("/news").set("Cookie", cookies);
    const todas = [...res.body.daSuaCarteira, ...res.body.mercado];
    if (todas.length === 0) return;

    for (const n of todas) {
      // &#8220; &amp; &quot; etc. precisam ter virado o caractere real
      expect(n.titulo).not.toMatch(/&#\d+;|&[a-z]+;/i);
    }
  });

  it("vem ordenado da notícia mais recente para a mais antiga", async () => {
    const res = await request(app).get("/news").set("Cookie", cookies);
    const datas = res.body.mercado.map((n: { publicadoEm: string }) => n.publicadoEm);
    if (datas.length < 2) return;

    const ordenado = [...datas].sort((a, b) => b.localeCompare(a));
    expect(datas).toEqual(ordenado);
  });

  it("uma notícia nunca aparece nas duas listas", async () => {
    const res = await request(app).get("/news").set("Cookie", cookies);
    const linksCarteira = new Set(
      res.body.daSuaCarteira.map((n: { link: string }) => n.link),
    );
    const repetidos = res.body.mercado.filter((n: { link: string }) =>
      linksCarteira.has(n.link),
    );
    expect(repetidos).toHaveLength(0);
  });
});
