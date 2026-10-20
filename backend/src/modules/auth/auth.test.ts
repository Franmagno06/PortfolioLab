import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { EMAIL_DA_DEMO } from "../../shared/conta-demo.js";
import { authRepository } from "./auth.repository.js";

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
  // rede de segurança do teste "não deixa cadastrar o e-mail da demo": se o
  // bloqueio quebrar, a variação de caixa seria criada. Só ela é apagada; a
  // carteira@portfoliolab.dev do seed-demo nunca é tocada.
  await prisma.user.deleteMany({ where: { email: "Carteira@PortfolioLab.dev" } });
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

// ── Conta de demonstração ──────────────────────────────────────────────────
// O banco de testes é o mesmo Docker do dia a dia, onde o seed-demo já criou a
// conta carteira@portfoliolab.dev. Estes testes NÃO usam nem alteram essa conta:
// o usuário é o deste arquivo, e só o e-mail que o repository devolve é trocado
// pelo da demo (spy), para o service tratá-lo como a demonstração.
describe("conta de demonstração", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function usuarioDoTesteComEmailDaDemo() {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { ...user, email: EMAIL_DA_DEMO };
  }

  it("não deixa cadastrar o e-mail da demo, nem com maiúsculas (409, sem 500)", async () => {
    for (const emailDaDemo of [EMAIL_DA_DEMO, "Carteira@PortfolioLab.dev"]) {
      const res = await request(app)
        .post("/auth/register")
        .send({ name: "Impostora", email: emailDaDemo, password });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("E-mail já cadastrado");
    }
    // nada foi criado com a variação de caixa
    expect(await prisma.user.findUnique({ where: { email: "Carteira@PortfolioLab.dev" } })).toBeNull();
  });

  it("login da demo gera token com demo: true", async () => {
    const demo = await usuarioDoTesteComEmailDaDemo();
    vi.spyOn(authRepository, "findByEmail").mockResolvedValueOnce(demo);

    const res = await request(app).post("/auth/login").send({ email: EMAIL_DA_DEMO, password });

    expect(res.status).toBe(200);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0] ?? "";
    const token = /token=([^;]+)/.exec(cookie)?.[1] ?? "";
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe(demo.id);
    expect(payload.demo).toBe(true);
  });

  it("login de outra conta gera token sem a claim demo", async () => {
    const res = await request(app).post("/auth/login").send({ email, password });

    const cookie = (res.headers["set-cookie"] as unknown as string[])[0] ?? "";
    const token = /token=([^;]+)/.exec(cookie)?.[1] ?? "";
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(payload).not.toHaveProperty("demo");
  });

  it("/auth/me diz demo: true para a demo, mesmo com token antigo sem a claim", async () => {
    const demo = await usuarioDoTesteComEmailDaDemo();
    vi.spyOn(authRepository, "findById").mockResolvedValueOnce(demo);
    const tokenAntigo = jwt.sign({ sub: demo.id }, env.JWT_SECRET, { expiresIn: "1h" });

    const res = await request(app).get("/auth/me").set("Cookie", `token=${tokenAntigo}`);

    expect(res.status).toBe(200);
    expect(res.body.demo).toBe(true);
  });

  it("/auth/me diz demo: false para as outras contas", async () => {
    const login = await request(app).post("/auth/login").send({ email, password });
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", login.headers["set-cookie"] as unknown as string[]);

    expect(res.status).toBe(200);
    expect(res.body.demo).toBe(false);
  });
});
