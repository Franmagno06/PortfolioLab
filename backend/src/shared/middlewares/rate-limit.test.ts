import express, { type Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ativosRoutes } from "../../modules/ativos/ativos.routes.js";
import { authRoutes } from "../../modules/auth/auth.routes.js";
import { dividendsRoutes } from "../../modules/dividends/dividends.routes.js";
import { reportsRoutes } from "../../modules/reports/reports.routes.js";
import { errorHandler } from "./error-handler.js";
import { EMAIL_DA_DEMO } from "../conta-demo.js";
import {
  chaveDaConta,
  criarLimitador,
  ehLoginDaDemo,
  limitadorAtivos,
  limitadorAuth,
  limitadorFalhasPorConta,
  limitadorLoginDaDemo,
  limitadorRelatorios,
  limitadorSyncDeProventos,
} from "./rate-limit.js";

// Achado 8: sem teto de requisições, /auth/login aceita força bruta e
// /reports baixa e interpreta arquivos grandes da CVM a cada consulta. O limitador é testado aqui isolado,
// num app descartável: o app real neutraliza o limite sob NODE_ENV=test,
// senão as 25 chamadas de auth da suíte (todas do mesmo IP) se atrapalhariam.

function appComLimite(max: number) {
  const app = express();
  app.use(criarLimitador({ janelaMs: 60_000, max, mensagem: "Devagar aí." }));
  app.get("/", (_req, res) => {
    res.json({ ok: true });
  });
  // o mesmo errorHandler do app real: o 429 precisa sair no formato { error }
  app.use(errorHandler);
  return app;
}

describe("limitador de requisições", () => {
  it("deixa passar até o limite", async () => {
    const app = appComLimite(3);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
    }
  });

  it("responde 429 na requisição seguinte ao limite", async () => {
    const app = appComLimite(2);

    await request(app).get("/");
    await request(app).get("/");
    const estourou = await request(app).get("/");

    expect(estourou.status).toBe(429);
  });

  it("o 429 explica o motivo em vez de devolver corpo vazio", async () => {
    const app = appComLimite(1);

    await request(app).get("/");
    const estourou = await request(app).get("/");

    expect(estourou.body.error).toBe("Devagar aí.");
  });

  it("anuncia o limite nos cabeçalhos padrão", async () => {
    const app = appComLimite(5);

    const res = await request(app).get("/");

    expect(res.headers["ratelimit-limit"]).toBe("5");
  });
});

// Os limitadores nascem desligados sob NODE_ENV=test (senão as 25 chamadas de
// auth da suíte, todas do mesmo IP e em arquivos paralelos, se atrapalhariam).
// O efeito colateral é que apagar um limitador de uma rota não quebraria teste
// nenhum. Estes testes fecham essa lacuna olhando a fiação em vez do
// comportamento: conferem que a instância certa está montada na rota certa.
type CamadaDeRota = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } };

function middlewaresDa(router: Router, metodo: string, caminho: string) {
  const camadas = (router as unknown as { stack: CamadaDeRota[] }).stack;
  const rota = camadas.find((c) => c.route?.path === caminho && c.route.methods[metodo]);
  if (!rota?.route) throw new Error(`rota ${metodo.toUpperCase()} ${caminho} não encontrada`);
  return rota.route.stack.map((s) => s.handle);
}

describe("limitador por usuário", () => {
  // O mesmo molde do limitador do sync de proventos: chave = req.userId (o authGuard o põe antes).
  function appPorUsuario(max: number) {
    const app = express();
    app.use((req, _res, next) => {
      req.userId = req.header("x-usuario") ?? undefined;
      next();
    });
    app.use(criarLimitador({ janelaMs: 60_000, max, mensagem: "Espere.", porUsuario: true }));
    app.post("/sync", (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);
    return app;
  }

  it("conta cada usuário à parte: o teto de um não trava o outro", async () => {
    const app = appPorUsuario(3);
    for (let i = 0; i < 3; i++) expect((await request(app).post("/sync").set("x-usuario", "a")).status).toBe(200);

    const estourou = await request(app).post("/sync").set("x-usuario", "a");
    expect(estourou.status).toBe(429);
    expect(estourou.body.error).toBe("Espere.");
    expect((await request(app).post("/sync").set("x-usuario", "b")).status).toBe(200);
  });
});

describe("login: a demo à parte e as falhas por conta", () => {
  // As mesmas regras dos limitadores exportados (que nascem desligados sob NODE_ENV=test), num app
  // descartável: senha certa só para "certa", como um login de verdade.
  function appDeLogin() {
    const app = express();
    app.use(express.json());
    const login = express.Router();
    login.post(
      "/login",
      criarLimitador({ janelaMs: 60_000, max: 2, mensagem: "ip", pular: ehLoginDaDemo }),
      criarLimitador({ janelaMs: 60_000, max: 4, mensagem: "demo", pular: (req) => !ehLoginDaDemo(req) }),
      criarLimitador({
        janelaMs: 60_000,
        max: 3,
        mensagem: "conta",
        chave: chaveDaConta,
        contarSoFalhas: true,
        pular: ehLoginDaDemo,
      }),
      (req, res) => {
        const corpo = req.body as { password?: string };
        res.status(corpo.password === "certa" ? 200 : 401).json({});
      },
    );
    login.post(
      "/register",
      criarLimitador({ janelaMs: 60_000, max: 2, mensagem: "ip", pular: ehLoginDaDemo }),
      (_req, res) => {
        res.status(201).json({});
      },
    );
    app.use("/auth", login);
    app.use(errorHandler);
    return app;
  }
  const entrar = (app: express.Express, email: string, password = "certa", ip = "1.1.1.1") =>
    request(app).post("/auth/login").set("x-forwarded-for", ip).send({ email, password });

  it("logins da demo não gastam o teto por IP das contas de verdade", async () => {
    const app = appDeLogin();
    for (let i = 0; i < 4; i++) expect((await entrar(app, EMAIL_DA_DEMO, "demo123456")).status).toBe(401);

    expect((await entrar(app, "ana@exemplo.dev")).status).toBe(200);
    expect((await entrar(app, "ana@exemplo.dev")).status).toBe(200);
  });

  it("a demo tem o teto dela, por IP", async () => {
    const app = appDeLogin();
    for (let i = 0; i < 4; i++) await entrar(app, EMAIL_DA_DEMO);
    const estourou = await entrar(app, ` ${EMAIL_DA_DEMO.toUpperCase()} `);

    expect(estourou.status).toBe(429);
    expect(estourou.body.error).toBe("demo");
  });

  it("falhas contam por conta: o mesmo e-mail é barrado ainda que cada tentativa venha de outro IP", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/auth/login",
      criarLimitador({ janelaMs: 60_000, max: 3, mensagem: "conta", chave: chaveDaConta, contarSoFalhas: true }),
      (req, res) => {
        res.status((req.body as { password?: string }).password === "certa" ? 200 : 401).json({});
      },
    );
    app.use(errorHandler);
    for (let i = 0; i < 3; i++) await entrar(app, "Ana@Exemplo.dev", "errada", `9.9.9.${i}`);

    const estourou = await entrar(app, "ana@exemplo.dev", "certa", "8.8.8.8");
    expect(estourou.status).toBe(429);
    expect(estourou.body.error).toBe("conta");
    expect((await entrar(app, "bia@exemplo.dev", "errada", "8.8.8.8")).status).toBe(401);
  });

  it("login certo não gasta o teto da conta", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/auth/login",
      criarLimitador({ janelaMs: 60_000, max: 2, mensagem: "conta", chave: chaveDaConta, contarSoFalhas: true }),
      (_req, res) => {
        res.json({});
      },
    );
    app.use(errorHandler);
    for (let i = 0; i < 5; i++) expect((await entrar(app, "ana@exemplo.dev")).status).toBe(200);
  });

  it("cadastro com o e-mail da demo continua no teto rígido", async () => {
    const app = appDeLogin();
    const cadastrar = () =>
      request(app).post("/auth/register").send({ email: EMAIL_DA_DEMO, name: "x", password: "123456" });
    await cadastrar();
    await cadastrar();

    expect((await cadastrar()).status).toBe(429);
  });
});

describe("fiação dos limitadores nas rotas", () => {
  it("POST /auth/login passa pelo limitador de autenticação, pelo da demo e pelo de falhas por conta", () => {
    const pilha = middlewaresDa(authRoutes, "post", "/login");
    expect(pilha).toContain(limitadorAuth);
    expect(pilha).toContain(limitadorLoginDaDemo);
    expect(pilha).toContain(limitadorFalhasPorConta);
  });

  it("POST /auth/register passa pelo limitador de autenticação", () => {
    expect(middlewaresDa(authRoutes, "post", "/register")).toContain(limitadorAuth);
  });

  // Asserção negativa: prova que a checagem acima discrimina de verdade, em vez
  // de passar à toa. /logout não é alvo de força bruta e fica só com o teto global.
  it("POST /auth/logout NÃO leva o limitador rígido", () => {
    expect(middlewaresDa(authRoutes, "post", "/logout")).not.toContain(limitadorAuth);
  });

  it("as rotas que consultam a CVM levam o limitador de relatórios", () => {
    expect(middlewaresDa(reportsRoutes, "post", "/")).toContain(limitadorRelatorios);
    expect(middlewaresDa(reportsRoutes, "post", "/cvm")).toContain(limitadorRelatorios);
  });

  it("GET /reports é leitura barata e não leva o limitador de relatórios", () => {
    expect(middlewaresDa(reportsRoutes, "get", "/")).not.toContain(limitadorRelatorios);
  });

  it("POST /dividends/sync (até um Yahoo por ativo) leva o limitador por usuário", () => {
    expect(middlewaresDa(dividendsRoutes, "post", "/sync")).toContain(limitadorSyncDeProventos);
  });

  it("as outras rotas de proventos não levam o limitador do sync", () => {
    expect(middlewaresDa(dividendsRoutes, "post", "/")).not.toContain(limitadorSyncDeProventos);
    expect(middlewaresDa(dividendsRoutes, "get", "/")).not.toContain(limitadorSyncDeProventos);
  });
});

describe("fiação do limitador das páginas públicas de ativos", () => {
  // Rota aberta, sem login: o limitador é a única proteção contra quem a martela. Ele está no
  // roteador (router.use), então vem ANTES de qualquer rota na pilha.
  const pilha = (ativosRoutes as unknown as { stack: (CamadaDeRota & { handle: unknown })[] }).stack;

  it("o limitador de ativos é a primeira camada do roteador, antes de qualquer rota", () => {
    expect(pilha[0]?.handle).toBe(limitadorAtivos);
    expect(pilha[0]?.route).toBeUndefined();
  });

  it("as seis rotas públicas estão no roteador, depois do limitador", () => {
    const rotas = pilha.filter((c) => c.route).map((c) => c.route?.path);

    expect(rotas).toEqual(["/acoes", "/acoes/:ticker", "/fiis", "/fiis/:ticker", "/etfs", "/etfs/:ticker"]);
  });
});
