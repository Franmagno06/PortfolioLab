import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MENSAGEM_DA_DEMO } from "../conta-demo.js";
import { AppError } from "../errors/AppError.js";

// Teste de unidade, sem banco: o service que consulta o e-mail no banco é
// substituído aqui, então o repository (e o Prisma) nem chega a carregar.
const ehContaDemo = vi.fn<(userId: string) => Promise<boolean>>();
vi.mock("../../modules/auth/auth.service.js", () => ({
  authService: { ehContaDemo: (userId: string) => ehContaDemo(userId) },
}));

const { somenteLeituraNaDemo } = await import("./somente-leitura-na-demo.js");

type Opcoes = { method: string; baseUrl: string; path: string; ehDemo?: boolean };

function requisicao({ method, baseUrl, path, ehDemo }: Opcoes): Request {
  return { method, baseUrl, path, ehDemo, userId: "usuario-1" } as unknown as Request;
}

async function rodar(opcoes: Opcoes) {
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  let erro: unknown;
  try {
    await somenteLeituraNaDemo(requisicao(opcoes), {} as Response, next);
  } catch (e) {
    erro = e;
  }
  return { next, erro };
}

function esperarBloqueio(r: { next: ReturnType<typeof vi.fn>; erro: unknown }) {
  expect(r.next).not.toHaveBeenCalled();
  expect(r.erro).toBeInstanceOf(AppError);
  expect((r.erro as AppError).statusCode).toBe(403);
  expect((r.erro as AppError).message).toBe(MENSAGEM_DA_DEMO);
}

beforeEach(() => {
  ehContaDemo.mockReset();
  ehContaDemo.mockResolvedValue(false);
});

describe("somenteLeituraNaDemo — token com a claim demo", () => {
  it("recusa POST com 403 e a mensagem da demo", async () => {
    esperarBloqueio(await rodar({ method: "POST", baseUrl: "/transactions", path: "/", ehDemo: true }));
  });

  it("recusa DELETE, PUT e PATCH", async () => {
    esperarBloqueio(await rodar({ method: "DELETE", baseUrl: "/transactions", path: "/abc", ehDemo: true }));
    esperarBloqueio(await rodar({ method: "PUT", baseUrl: "/goals", path: "/", ehDemo: true }));
    esperarBloqueio(await rodar({ method: "PATCH", baseUrl: "/goals", path: "/", ehDemo: true }));
  });

  it("deixa passar GET, HEAD e OPTIONS sem consultar o banco", async () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const r = await rodar({ method, baseUrl: "/transactions", path: "/", ehDemo: true });
      expect(r.erro).toBeUndefined();
      expect(r.next).toHaveBeenCalledOnce();
    }
    expect(ehContaDemo).not.toHaveBeenCalled();
  });

  it("deixa passar POST /sync montado sob /dividends", async () => {
    const r = await rodar({ method: "POST", baseUrl: "/dividends", path: "/sync", ehDemo: true });
    expect(r.erro).toBeUndefined();
    expect(r.next).toHaveBeenCalledOnce();
  });

  it("aceita a exceção com barra no fim e com maiúsculas, como o roteador do Express", async () => {
    for (const path of ["/sync/", "/SYNC", "/Sync/"]) {
      const r = await rodar({ method: "POST", baseUrl: "/dividends", path, ehDemo: true });
      expect(r.next).toHaveBeenCalledOnce();
    }
  });

  it("não deixa a exceção do sync abrir outra escrita", async () => {
    // outro método no mesmo caminho
    esperarBloqueio(await rodar({ method: "DELETE", baseUrl: "/dividends", path: "/sync", ehDemo: true }));
    esperarBloqueio(await rodar({ method: "PUT", baseUrl: "/dividends", path: "/sync", ehDemo: true }));
    // caminhos parecidos
    for (const path of ["/syncX", "/sync/x", "/sync/../x", "/sync//", "/", "/abc"]) {
      esperarBloqueio(await rodar({ method: "POST", baseUrl: "/dividends", path, ehDemo: true }));
    }
    // /sync sob outro prefixo
    esperarBloqueio(await rodar({ method: "POST", baseUrl: "/transactions", path: "/sync", ehDemo: true }));
    esperarBloqueio(await rodar({ method: "POST", baseUrl: "/reports", path: "/sync", ehDemo: true }));
  });
});

describe("somenteLeituraNaDemo — token sem a claim", () => {
  it("conta normal faz POST normalmente", async () => {
    const r = await rodar({ method: "POST", baseUrl: "/transactions", path: "/", ehDemo: false });
    expect(r.erro).toBeUndefined();
    expect(r.next).toHaveBeenCalledOnce();
    expect(ehContaDemo).toHaveBeenCalledWith("usuario-1");
  });

  it("token antigo da demo (sem a claim) continua bloqueado na escrita", async () => {
    ehContaDemo.mockResolvedValue(true);
    esperarBloqueio(await rodar({ method: "POST", baseUrl: "/transactions", path: "/" }));
    esperarBloqueio(await rodar({ method: "DELETE", baseUrl: "/reports", path: "/abc" }));
  });

  it("token antigo da demo ainda pode sincronizar proventos e ler", async () => {
    ehContaDemo.mockResolvedValue(true);
    const sync = await rodar({ method: "POST", baseUrl: "/dividends", path: "/sync" });
    expect(sync.next).toHaveBeenCalledOnce();
    const leitura = await rodar({ method: "GET", baseUrl: "/transactions", path: "/" });
    expect(leitura.next).toHaveBeenCalledOnce();
  });
});
