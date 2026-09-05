import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../../shared/errors/AppError.js";
import { analisarRelatorio } from "./gemini.js";

// vi.mock é IÇADO para o topo do módulo pelo transform do Vitest — a ordem
// em relação aos imports acima não importa (mesmo comportamento do Jest).
vi.mock("../../config/env.js", () => ({
  env: { GEMINI_API_KEY: "chave-de-teste", GEMINI_MODEL: "gemini-3.6-flash" },
}));

const interactionsCreate = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { interactions: { create: interactionsCreate } };
  }),
}));

afterEach(() => {
  interactionsCreate.mockReset();
});

async function erroLancado(texto: string): Promise<AppError> {
  try {
    await analisarRelatorio(texto);
    throw new Error("deveria ter lançado AppError");
  } catch (e) {
    return e as AppError;
  }
}

describe("tradução de erro da IA (gemini.ts)", () => {
  it("chave inválida vira 502 com instrução para checar GEMINI_API_KEY", async () => {
    interactionsCreate.mockRejectedValueOnce(new Error("401 API key not valid"));

    const erro = await erroLancado("texto");
    expect(erro.statusCode).toBe(502);
    expect(erro.message).toMatch(/chave da IA é inválida/i);
  });

  it("cota estourada vira 502 pedindo para aguardar", async () => {
    interactionsCreate.mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED: quota"));

    const erro = await erroLancado("texto");
    expect(erro.statusCode).toBe(502);
    expect(erro.message).toMatch(/limite de uso da ia/i);
  });

  it("chave sem permissão para o modelo vira 502 apontando GEMINI_MODEL", async () => {
    interactionsCreate.mockRejectedValueOnce(new Error("403 PERMISSION_DENIED"));

    const erro = await erroLancado("texto");
    expect(erro.statusCode).toBe(502);
    expect(erro.message).toMatch(/não tem permissão/i);
  });

  it("erro sem padrão conhecido ainda vira 502, não um 500 genérico", async () => {
    interactionsCreate.mockRejectedValueOnce(new Error("timeout de rede"));

    const erro = await erroLancado("texto");
    expect(erro.statusCode).toBe(502);
  });
});
