import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../../shared/errors/AppError.js";
import {
  analisarRelatorio,
  CONTEXTO_CHAT,
  enxugarHistorico,
  HISTORICO_MAX_CHARS,
  HISTORICO_MAX_MENSAGENS,
  perguntarAoRelatorio,
} from "./gemini.js";

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

  it("modelo sobrecarregado no Google vira 503 em português, sem confundir com cota", async () => {
    interactionsCreate.mockRejectedValueOnce(
      new Error("503 gemini-3.6-flash is currently experiencing high demand"),
    );

    const erro = await erroLancado("texto");
    expect(erro.statusCode).toBe(503);
    expect(erro.message).toMatch(/sobrecarregado/i);
    expect(erro.message).not.toMatch(/limite de uso/i);
  });

  it("erro sem padrão conhecido ainda vira 502, não um 500 genérico", async () => {
    interactionsCreate.mockRejectedValueOnce(new Error("timeout de rede"));

    const erro = await erroLancado("texto");
    expect(erro.statusCode).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// Economia de tokens: o que vai em cada chamada
// ---------------------------------------------------------------------------

const respostaOk = { output_text: '{"tipoDocumento":"x","resumoExecutivo":[],"alertas":[],"indicadores":[]}' };

describe("configuração de geração", () => {
  it("a análise pede raciocínio baixo e tem teto de saída", async () => {
    interactionsCreate.mockResolvedValueOnce(respostaOk);

    await analisarRelatorio("texto");

    const pedido = interactionsCreate.mock.calls[0]?.[0];
    expect(pedido.generation_config.thinking_level).toBe("low");
    expect(pedido.generation_config.max_output_tokens).toBeGreaterThan(0);
  });

  it("o chat pede raciocínio mínimo e tem teto de saída", async () => {
    interactionsCreate.mockResolvedValueOnce({ output_text: "resposta" });

    await perguntarAoRelatorio("r.pdf", "texto", "qual o lucro?", []);

    const pedido = interactionsCreate.mock.calls[0]?.[0];
    expect(pedido.generation_config.thinking_level).toBe("minimal");
    expect(pedido.generation_config.max_output_tokens).toBeGreaterThan(0);
  });

  it("o chat manda no máximo CONTEXTO_CHAT caracteres de relatório", async () => {
    interactionsCreate.mockResolvedValueOnce({ output_text: "resposta" });
    const gigante = "O lucro liquido somou R$ 3,4 bilhoes. ".repeat(30_000);

    await perguntarAoRelatorio("r.pdf", gigante, "qual o lucro liquido?", []);

    const instrucao: string = interactionsCreate.mock.calls[0]?.[0].system_instruction;
    const relatorio = instrucao.slice(instrucao.indexOf("<relatorio"));
    // folga para as tags e o separador [...] entre blocos
    expect(relatorio.length).toBeLessThan(CONTEXTO_CHAT + 200);
  });
});

describe("enxugarHistorico", () => {
  const msg = (i: number, tamanho = 10) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `m${i}`.padEnd(tamanho, "x"),
  });

  it("mantém só as últimas mensagens, na ordem", () => {
    const historico = Array.from({ length: 20 }, (_, i) => msg(i));

    const enxuto = enxugarHistorico(historico);

    expect(enxuto).toHaveLength(HISTORICO_MAX_MENSAGENS);
    expect(enxuto.at(-1)?.content).toMatch(/^m19/);
    expect(enxuto[0]?.content).toMatch(new RegExp(`^m${20 - HISTORICO_MAX_MENSAGENS}`));
  });

  it("trunca mensagem longa e marca o corte", () => {
    const [enxuta] = enxugarHistorico([msg(0, 8_000)]);

    expect(enxuta?.content.length).toBeLessThanOrEqual(HISTORICO_MAX_CHARS + 6);
    expect(enxuta?.content.endsWith("[...]")).toBe(true);
  });

  it("histórico curto passa intacto", () => {
    const curto = [msg(0), msg(1)];
    expect(enxugarHistorico(curto)).toEqual(curto);
  });

  it("o chat envia o histórico já enxugado", async () => {
    interactionsCreate.mockResolvedValueOnce({ output_text: "resposta" });
    const historico = Array.from({ length: 20 }, (_, i) => msg(i));

    await perguntarAoRelatorio("r.pdf", "texto", "e o dividendo?", historico);

    const passos = interactionsCreate.mock.calls[0]?.[0].input;
    // histórico enxugado + a pergunta atual
    expect(passos).toHaveLength(HISTORICO_MAX_MENSAGENS + 1);
  });
});
