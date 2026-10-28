import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, apiPublica, cancelarSaida, iniciarSaida } from "./api";

/**
 * Um 401 de sessão morta leva ao login (`encerrarSessao`). Mas quem clicou em
 * "Sair" derruba a própria sessão: uma chamada que a página ainda dispara
 * depois do logout volta 401 e NÃO pode mandar a pessoa para o login com o
 * aviso de sessão expirada — ela pediu para sair e vai para a página inicial.
 */

const replace = vi.fn();

function resposta(status: number, corpo: unknown = {}) {
  return new Response(status === 204 ? null : JSON.stringify(corpo), { status });
}

beforeEach(() => {
  replace.mockReset();
  vi.stubGlobal("location", { pathname: "/dashboard", search: "", replace });
});

afterEach(() => {
  cancelarSaida();
  vi.unstubAllGlobals();
});

describe("401 fora do login", () => {
  it("apaga o cookie e leva ao login com o marcador de sessão expirada", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(resposta(401, { error: "Sessão inválida ou expirada" }))
      .mockResolvedValueOnce(resposta(204));
    vi.stubGlobal("fetch", fetchFalso);

    await expect(api("/portfolio")).rejects.toBeInstanceOf(ApiError);

    expect(fetchFalso).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe("/login?expirada=1&next=%2Fdashboard");
  });

  it("depois de iniciarSaida, o 401 não redireciona nem chama o logout de novo", async () => {
    const fetchFalso = vi.fn().mockResolvedValueOnce(resposta(401, { error: "Não autenticado" }));
    vi.stubGlobal("fetch", fetchFalso);

    iniciarSaida();
    await expect(api("/portfolio")).rejects.toMatchObject({ status: 401 });

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("cancelarSaida devolve o comportamento normal (logout que falhou)", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(resposta(401, { error: "Não autenticado" }))
      .mockResolvedValueOnce(resposta(204));
    vi.stubGlobal("fetch", fetchFalso);

    iniciarSaida();
    cancelarSaida();
    await expect(api("/portfolio")).rejects.toMatchObject({ status: 401 });

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("um login bem-sucedido encerra o modo de saída: a próxima sessão morta volta a redirecionar", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(resposta(200, { user: { id: "1" } }))
      .mockResolvedValueOnce(resposta(401, { error: "Sessão inválida ou expirada" }))
      .mockResolvedValueOnce(resposta(204));
    vi.stubGlobal("fetch", fetchFalso);

    iniciarSaida();
    await api("/auth/login", { method: "POST", body: "{}" });
    await expect(api("/portfolio")).rejects.toMatchObject({ status: 401 });

    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe("apiPublica (leituras públicas, sem sessão)", () => {
  it("devolve o corpo de /api + caminho e repassa as opções (signal)", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchFalso);
    const controle = new AbortController();

    await expect(apiPublica("/indices/dados", { signal: controle.signal })).resolves.toEqual({ ok: 1 });
    expect(fetchFalso.mock.calls[0]?.[0]).toBe("/api/indices/dados");
    expect(fetchFalso.mock.calls[0]?.[1]?.signal).toBe(controle.signal);
  });

  it("um 401 lança ApiError e NÃO encerra a sessão nem leva ao login", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(401, { error: "não" }));
    vi.stubGlobal("fetch", fetchFalso);

    await expect(apiPublica("/indices/dados")).rejects.toBeInstanceOf(ApiError);
    expect(fetchFalso).toHaveBeenCalledTimes(1); // nenhum POST /api/auth/logout
    expect(replace).not.toHaveBeenCalled();
  });
});
