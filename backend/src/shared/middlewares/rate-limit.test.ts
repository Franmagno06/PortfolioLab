import express, { type Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ativosRoutes } from "../../modules/ativos/ativos.routes.js";
import { authRoutes } from "../../modules/auth/auth.routes.js";
import { dividendsRoutes } from "../../modules/dividends/dividends.routes.js";
import { reportsRoutes } from "../../modules/reports/reports.routes.js";
import { errorHandler } from "./error-handler.js";
import {
  criarLimitador,
  limitadorAtivos,
  limitadorAuth,
  limitadorRelatorios,
  limitadorSyncDeProventos,
} from "./rate-limit.js";

// Achado 8: sem teto de requisições, /auth/login aceita força bruta e
// /reports queima cota paga do Gemini. O limitador é testado aqui isolado,
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

describe("fiação dos limitadores nas rotas", () => {
  it("POST /auth/login passa pelo limitador de autenticação", () => {
    expect(middlewaresDa(authRoutes, "post", "/login")).toContain(limitadorAuth);
  });

  it("POST /auth/register passa pelo limitador de autenticação", () => {
    expect(middlewaresDa(authRoutes, "post", "/register")).toContain(limitadorAuth);
  });

  // Asserção negativa: prova que a checagem acima discrimina de verdade, em vez
  // de passar à toa. /logout não é alvo de força bruta e fica só com o teto global.
  it("POST /auth/logout NÃO leva o limitador rígido", () => {
    expect(middlewaresDa(authRoutes, "post", "/logout")).not.toContain(limitadorAuth);
  });

  it("as rotas que gastam cota do Gemini levam o limitador de relatórios", () => {
    expect(middlewaresDa(reportsRoutes, "post", "/")).toContain(limitadorRelatorios);
    expect(middlewaresDa(reportsRoutes, "post", "/:id/ask")).toContain(limitadorRelatorios);
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
