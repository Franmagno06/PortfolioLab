import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lerDadosDosIndices } from "./indices-api";
import { DADOS_DE_EXEMPLO } from "./indices-exemplo";

const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

const fetchFalso = vi.fn();
beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
});
afterEach(() => vi.unstubAllGlobals());

describe("leitura dos dados dos índices", () => {
  it("chama GET /indices/dados no endereço de API_URL, guarda a resposta por 2 minutos e tem prazo", async () => {
    fetchFalso.mockResolvedValue(resposta(DADOS_DE_EXEMPLO));
    const dados = await lerDadosDosIndices();
    const [url, opcoes] = fetchFalso.mock.calls[0] as [string, RequestInit & { next?: { revalidate: number } }];
    expect(url).toBe("http://localhost:3333/indices/dados");
    expect(opcoes.next?.revalidate).toBe(120);
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
    expect(dados).toEqual(DADOS_DE_EXEMPLO);
  });

  it("status de erro vira null, sem lançar", async () => {
    fetchFalso.mockResolvedValue(resposta({ error: "x" }, 500));
    await expect(lerDadosDosIndices()).resolves.toBeNull();
  });

  it("rede fora do ar (fetch rejeitando) vira null, sem lançar", async () => {
    fetchFalso.mockRejectedValue(new TypeError("fetch failed"));
    await expect(lerDadosDosIndices()).resolves.toBeNull();
  });

  it("corpo que não é JSON vira null", async () => {
    fetchFalso.mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(lerDadosDosIndices()).resolves.toBeNull();
  });
});

describe("prazo da leitura", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sem opção, o prazo é de 20 s (o das páginas de índices)", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchFalso.mockResolvedValue(resposta(DADOS_DE_EXEMPLO));
    await lerDadosDosIndices();
    expect(timeout).toHaveBeenCalledWith(20_000);
  });

  it("prazoMs troca o prazo (a home usa 5 s)", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchFalso.mockResolvedValue(resposta(DADOS_DE_EXEMPLO));
    await lerDadosDosIndices({ prazoMs: 5_000 });
    expect(timeout).toHaveBeenCalledWith(5_000);
  });

  it("API que não responde: passado o prazo, vira null em vez de esperar para sempre", async () => {
    // fetch que só termina quando o sinal aborta, como o de verdade
    fetchFalso.mockImplementation(
      (_url: string, opcoes: RequestInit) =>
        new Promise((_resolve, reject) => {
          opcoes.signal?.addEventListener("abort", () => reject(opcoes.signal?.reason));
        }),
    );
    const inicio = Date.now();

    await expect(lerDadosDosIndices({ prazoMs: 50 })).resolves.toBeNull();
    expect(Date.now() - inicio).toBeLessThan(2_000);
  });
});
