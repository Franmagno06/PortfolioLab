import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { buscarAcao, buscarFii, listarAcoes, listarFiis } from "./ativos-api";

const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

const fetchFalso = vi.fn();
beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
});
afterEach(() => vi.unstubAllGlobals());

describe("leitura das páginas de ativos", () => {
  it("chama o backend direto, pelo endereço de API_URL, e guarda a resposta por 2 minutos", async () => {
    fetchFalso.mockResolvedValue(resposta([{ ticker: "VALE3" }]));
    await listarAcoes();
    const [url, opcoes] = fetchFalso.mock.calls[0] as [string, RequestInit & { next?: { revalidate: number } }];
    expect(url).toBe("http://localhost:3333/ativos/acoes");
    expect(opcoes.next?.revalidate).toBe(120);
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });

  it("listas e fichas devolvem o JSON da resposta", async () => {
    fetchFalso.mockResolvedValueOnce(resposta([{ ticker: "MXRF11" }]));
    expect(await listarFiis()).toEqual([{ ticker: "MXRF11" }]);
    fetchFalso.mockResolvedValueOnce(resposta({ ticker: "PETR4" }));
    expect(await buscarAcao("PETR4")).toEqual({ ticker: "PETR4" });
    expect(fetchFalso.mock.calls[1]?.[0]).toBe("http://localhost:3333/ativos/acoes/PETR4");
    fetchFalso.mockResolvedValueOnce(resposta({ ticker: "HGLG11" }));
    await buscarFii("HGLG11");
    expect(fetchFalso.mock.calls[2]?.[0]).toBe("http://localhost:3333/ativos/fiis/HGLG11");
  });

  it("ticker fora do catálogo (404) vira null, para a página mostrar 'não encontrado'", async () => {
    fetchFalso.mockResolvedValue(resposta({ error: "Ativo não encontrado" }, 404));
    expect(await buscarAcao("ZZZZ9")).toBeNull();
  });

  it("o ticker da URL é codificado, e não vira outro caminho", async () => {
    fetchFalso.mockResolvedValue(resposta({}, 404));
    await buscarAcao("../auth/me");
    expect(fetchFalso.mock.calls[0]?.[0]).toBe("http://localhost:3333/ativos/acoes/..%2Fauth%2Fme");
  });

  it("erro do backend lança ApiError com o status, e a página mostra o erro da seção", async () => {
    fetchFalso.mockResolvedValue(resposta({ error: "x" }, 503));
    await expect(buscarAcao("VALE3")).rejects.toMatchObject({ name: "ApiError", status: 503 });
    await expect(listarAcoes()).rejects.toBeInstanceOf(ApiError);
  });

  it("backend fora do ar (a conexão falha) lança, e não devolve lista vazia", async () => {
    fetchFalso.mockRejectedValue(new TypeError("fetch failed"));
    await expect(listarFiis()).rejects.toThrow("fetch failed");
  });

  it("lista que o backend diz não existir (404) é erro, e não lista vazia", async () => {
    fetchFalso.mockResolvedValue(resposta({}, 404));
    await expect(listarAcoes()).rejects.toMatchObject({ status: 404 });
  });
});
