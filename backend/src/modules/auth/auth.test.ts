import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";

// Testes de INTEGRAÇÃO: batem nas rotas reais e no banco real.
// Graças à separação app.ts/server.ts, o supertest testa a aplicação
// sem precisar subir um servidor de verdade.

// E-mail único por execução — os dados criados são removidos no afterAll
const email = `vitest-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";

afterAll(async () => {
  // apaga apenas o usuário DESTE arquivo de teste: os arquivos rodam em
  // paralelo, e um deleteMany amplo poderia colidir com os outros testes
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("POST /auth/register", () => {
  it("cria usuário e devolve 201 sem expor a senha", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Usuária Vitest", email, password });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("recusa e-mail duplicado com 409", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Duplicada", email, password });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("E-mail já cadastrado");
  });

  it("recusa dados inválidos com 400 e lista os campos", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "X", email: "nao-e-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("issues");
  });
});

describe("POST /auth/login", () => {
  it("loga com credenciais corretas e grava cookie HttpOnly", async () => {
    const res = await request(app).post("/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);

    const cookie = (res.headers["set-cookie"] as unknown as string[])?.[0] ?? "";
    expect(cookie).toContain("token=");
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("recusa senha errada com 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "senha-errada" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("E-mail ou senha incorretos");
  });

  it("recusa e-mail inexistente com a MESMA mensagem (anti-enumeração)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "ninguem@portfoliolab.dev", password });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("E-mail ou senha incorretos");
  });
});

describe("GET /auth/me", () => {
  it("devolve o perfil quando autenticado", async () => {
    const login = await request(app).post("/auth/login").send({ email, password });
    const cookies = login.headers["set-cookie"] as unknown as string[];

    const res = await request(app).get("/auth/me").set("Cookie", cookies);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it("bloqueia sem cookie com 401", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("bloqueia token expirado com 401", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    // Token assinado com o segredo certo, mas já vencido
    const expirado = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "-1s" });

    const res = await request(app).get("/auth/me").set("Cookie", `token=${expirado}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Sessão inválida ou expirada");
  });
});
