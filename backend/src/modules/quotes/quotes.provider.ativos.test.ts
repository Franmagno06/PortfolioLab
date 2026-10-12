import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Os campos que as páginas de Ativos pedem ao Yahoo: variação do dia, proventos
// do próprio ativo (com a diferença entre "falhou" e "não pagou") e dívida/EBITDA.
// Módulo FRESCO a cada teste (vi.resetModules): o cache de credenciais do quoteSummary
// não pode vazar de um teste para o outro.

async function carregarProviderComFetch(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  return import("./quotes.provider.js");
}

const json = (corpo: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("calcularDividaEbitda", () => {
  it("(dívida − caixa) ÷ EBITDA, com os números reais da VALE3", async () => {
    const { calcularDividaEbitda } = await import("./quotes.provider.js");

    // conferido ao vivo: dívida R$ 110,0 bi, caixa R$ 29,8 bi, EBITDA R$ 77,3 bi
    expect(calcularDividaEbitda(110_007_001_088, 29_841_999_872, 77_332_996_096)).toBeCloseTo(1.04, 2);
  });

  it("mais caixa que dívida dá razão negativa, que é informação (WEGE3)", async () => {
    const { calcularDividaEbitda } = await import("./quotes.provider.js");

    expect(calcularDividaEbitda(5_834_735_104, 8_801_141_760, 8_491_448_832)).toBeCloseTo(-0.35, 2);
  });

  it("EBITDA zero ou negativo: null, porque a razão não tem leitura", async () => {
    const { calcularDividaEbitda } = await import("./quotes.provider.js");

    expect(calcularDividaEbitda(100, 10, 0)).toBeNull();
    expect(calcularDividaEbitda(100, 10, -5)).toBeNull();
  });

  it("qualquer campo que o Yahoo não informou: null (banco não tem EBITDA)", async () => {
    const { calcularDividaEbitda } = await import("./quotes.provider.js");

    expect(calcularDividaEbitda(null, 10, 50)).toBeNull();
    expect(calcularDividaEbitda(100, null, 50)).toBeNull();
    expect(calcularDividaEbitda(100, 10, null)).toBeNull();
  });
});

describe("buscarIndicadoresFundamentalistas: dívida/EBITDA", () => {
  const COOKIE = { ok: false, status: 404, headers: { getSetCookie: () => ["A3=x; Path=/"] } };
  const CRUMB = { ok: true, status: 200, text: async () => "crumb" };

  function respostaDoYahoo(financialData: Record<string, unknown>) {
    return json({
      quoteSummary: {
        result: [
          {
            price: { regularMarketPrice: { raw: 62.48 } },
            defaultKeyStatistics: {
              netIncomeToCommon: { raw: 1_000_000_000 },
              sharesOutstanding: { raw: 100_000_000 },
            },
            financialData,
            assetProfile: { industry: "Other Industrial Metals & Mining" },
          },
        ],
      },
    });
  }

  function fetchCom(financialData: Record<string, unknown>) {
    return vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return COOKIE;
      if (url.includes("getcrumb")) return CRUMB;
      return respostaDoYahoo(financialData);
    });
  }

  it("lê dívida total, caixa e EBITDA do financialData", async () => {
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(
      fetchCom({
        totalDebt: { raw: 110_007_001_088 },
        totalCash: { raw: 29_841_999_872 },
        ebitda: { raw: 77_332_996_096 },
      }),
    );

    const indicadores = await buscarIndicadoresFundamentalistas("VALE3");

    expect(indicadores?.dividaEbitda).toBeCloseTo(1.04, 2);
  });

  it("banco: o Yahoo devolve o EBITDA como objeto vazio, e a razão fica null", async () => {
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(
      fetchCom({ totalDebt: { raw: 1_115_894_054_912 }, totalCash: { raw: 484_164_993_024 }, ebitda: {} }),
    );

    const indicadores = await buscarIndicadoresFundamentalistas("ITUB4");

    expect(indicadores?.dividaEbitda).toBeNull();
  });
});

describe("buscarCotacao: variação do dia", () => {
  function chart(meta: Record<string, unknown>) {
    return json({ chart: { result: [{ meta }] } });
  }

  it("devolve o fechamento anterior e o momento do último negócio", async () => {
    const { buscarCotacao } = await carregarProviderComFetch(
      vi.fn(async () =>
        chart({
          regularMarketPrice: 63.23,
          chartPreviousClose: 62.48,
          regularMarketTime: 1_791_576_331, // 2026-10-09
          longName: "Vale S.A.",
        }),
      ),
    );

    const cotacao = await buscarCotacao("VALE3");

    expect(cotacao?.preco).toBe(63.23);
    expect(cotacao?.fechamentoAnterior).toBe(62.48);
    expect(cotacao?.negociadoEm?.toISOString().slice(0, 10)).toBe("2026-10-09");
  });

  it("sem fechamento anterior no Yahoo: null, e o preço continua valendo", async () => {
    const { buscarCotacao } = await carregarProviderComFetch(
      vi.fn(async () => chart({ regularMarketPrice: 10, longName: "Algo S.A." })),
    );

    const cotacao = await buscarCotacao("ALGO3");

    expect(cotacao?.preco).toBe(10);
    expect(cotacao?.fechamentoAnterior).toBeNull();
    expect(cotacao?.negociadoEm).toBeNull();
  });
});

describe("buscarProventosOuNulo: falha não é o mesmo que zero", () => {
  const desde = new Date("2025-10-12");

  function comDividendos(dividendos?: Record<string, { amount: number; date: number }>) {
    return json({ chart: { result: [dividendos ? { events: { dividends: dividendos } } : {}] } });
  }

  it("devolve os proventos em ordem de data-ex", async () => {
    const { buscarProventosOuNulo } = await carregarProviderComFetch(
      vi.fn(async () =>
        comDividendos({
          b: { amount: 0.5, date: 1_773_000_000 },
          a: { amount: 0.3, date: 1_757_000_000 },
        }),
      ),
    );

    const proventos = await buscarProventosOuNulo("TAEE11", desde);

    expect(proventos?.map((p) => p.valorPorCota)).toEqual([0.3, 0.5]);
  });

  it("o Yahoo respondeu e o ativo não pagou nada: lista vazia (um zero de verdade)", async () => {
    const { buscarProventosOuNulo } = await carregarProviderComFetch(vi.fn(async () => comDividendos()));

    expect(await buscarProventosOuNulo("ALGO3", desde)).toEqual([]);
  });

  it("resposta de erro do Yahoo: null", async () => {
    const { buscarProventosOuNulo } = await carregarProviderComFetch(vi.fn(async () => json({}, 500)));

    expect(await buscarProventosOuNulo("TAEE11", desde)).toBeNull();
  });

  it("ticker que o Yahoo não conhece (chart sem result): null, e não zero proventos", async () => {
    const { buscarProventosOuNulo } = await carregarProviderComFetch(
      vi.fn(async () => json({ chart: { result: null, error: { code: "Not Found" } } })),
    );

    expect(await buscarProventosOuNulo("XXXX9", desde)).toBeNull();
  });

  it("rede caiu: null", async () => {
    const { buscarProventosOuNulo } = await carregarProviderComFetch(
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );

    expect(await buscarProventosOuNulo("TAEE11", desde)).toBeNull();
  });

  it("buscarProventos (a versão de sempre) segue devolvendo lista vazia na falha", async () => {
    const { buscarProventos } = await carregarProviderComFetch(vi.fn(async () => json({}, 500)));

    expect(await buscarProventos("TAEE11", desde)).toEqual([]);
  });
});
