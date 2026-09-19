import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O quoteSummary exige cookie + crumb (CSRF) — diferente do v8/chart usado
// em buscarCotacao, que é aberto. Cada teste mocka as três chamadas que o
// handshake faz (fc.yahoo.com → getcrumb → quoteSummary) e usa um módulo
// FRESCO (vi.resetModules) para o cache de credenciais não vazar de um
// teste para o outro.
function respostaComCookie(cookies: string[]) {
  return { ok: false, status: 404, headers: { getSetCookie: () => cookies } };
}

function respostaDeCrumb(crumb: string, ok = true) {
  return { ok, status: ok ? 200 : 401, text: async () => crumb };
}

function respostaDeQuoteSummary(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

const COOKIE_VALIDO = ["A3=sessao-teste; Path=/; Domain=.yahoo.com"];
const CRUMB_VALIDO = "crumb-de-teste";

async function carregarProviderComFetch(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  return import("./quotes.provider.js");
}

// Corpo típico de uma ação real (moldado no que TAEE11 devolveu ao vivo):
// preço 41.91, netIncomeToCommon 1.635.716.992, sharesOutstanding 344.498.907
// → P/L manual ≈ 8,83 (bate com a referência de mercado ~9). O campo
// trailingPE pronto do Yahoo, para esta mesma ação, vinha 39,9 — ~4,5x
// inflado — por isso o provider não usa mais aquele campo.
function corpoQuoteSummary(overrides: {
  price?: number;
  netIncomeToCommon?: number;
  sharesOutstanding?: number;
  priceToBook?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  profitMargins?: number;
  industry?: string | null;
}) {
  return {
    quoteSummary: {
      result: [
        {
          price: { regularMarketPrice: { raw: overrides.price ?? 41.91 } },
          defaultKeyStatistics: {
            netIncomeToCommon: { raw: overrides.netIncomeToCommon ?? 1_635_716_992 },
            sharesOutstanding: { raw: overrides.sharesOutstanding ?? 344_498_907 },
            priceToBook: { raw: overrides.priceToBook ?? 3.2 },
            profitMargins: { raw: overrides.profitMargins ?? 0.36476 },
          },
          financialData: {
            returnOnEquity: { raw: overrides.returnOnEquity ?? 0.20859 },
            returnOnAssets: { raw: overrides.returnOnAssets ?? 0.06896 },
          },
          assetProfile: { industry: overrides.industry ?? "Utilities - Regulated Electric" },
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buscarIndicadoresFundamentalistas", () => {
  it("calcula o P/L a partir de lucro TTM ÷ ações, não do trailingPE pronto do Yahoo", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      return respostaDeQuoteSummary(200, corpoQuoteSummary({}));
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    const indicadores = await buscarIndicadoresFundamentalistas("TAEE11");

    // 41.91 / (1_635_716_992 / 344_498_907) ≈ 8.83 — bate com a referência
    // de mercado (~9), diferente do trailingPE pronto do Yahoo (~39.9)
    expect(indicadores?.pl).toBeCloseTo(8.83, 1);
  });

  it("mapeia P/VP, ROE, ROA, margem líquida e setor", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      return respostaDeQuoteSummary(
        200,
        corpoQuoteSummary({
          priceToBook: 9.1,
          returnOnEquity: 0.325,
          returnOnAssets: 0.08,
          profitMargins: 0.158,
          industry: "Banks - Regional",
        }),
      );
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    const indicadores = await buscarIndicadoresFundamentalistas("WEGE3");

    expect(indicadores?.pvp).toBe(9.1);
    expect(indicadores?.roe).toBe(32.5);
    expect(indicadores?.roa).toBe(8);
    expect(indicadores?.margemLiquida).toBe(15.8);
    expect(indicadores?.industria).toBe("Banks - Regional");
  });

  it("lucro líquido negativo (empresa com prejuízo): P/L negativo, não filtrado", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      return respostaDeQuoteSummary(
        200,
        corpoQuoteSummary({ netIncomeToCommon: -50_000_000, sharesOutstanding: 1_000_000 }),
      );
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    const indicadores = await buscarIndicadoresFundamentalistas("PREJU3");

    expect(indicadores?.pl).toBeLessThan(0);
  });

  it("sem nº de ações (sharesOutstanding ausente): P/L vira null, não divide por zero", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      return respostaDeQuoteSummary(200, {
        quoteSummary: {
          result: [
            {
              price: { regularMarketPrice: { raw: 41.91 } },
              defaultKeyStatistics: { netIncomeToCommon: { raw: 1_635_716_992 } },
              financialData: {},
              assetProfile: {},
            },
          ],
        },
      });
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    const indicadores = await buscarIndicadoresFundamentalistas("SEMACAO3");

    expect(indicadores?.pl).toBeNull();
  });

  it("indicador ausente no provedor vira null, não erro", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      // banco típico: sem profitMargins nos módulos consultados
      return respostaDeQuoteSummary(200, {
        quoteSummary: {
          result: [
            {
              price: { regularMarketPrice: { raw: 23.2 } },
              defaultKeyStatistics: {
                netIncomeToCommon: { raw: 16_381_933_568 },
                sharesOutstanding: { raw: 5_708_873_364 },
              },
              financialData: {},
              assetProfile: {},
            },
          ],
        },
      });
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    const indicadores = await buscarIndicadoresFundamentalistas("ITSA4");

    expect(indicadores?.pl).toBeCloseTo(8.08, 1);
    expect(indicadores?.pvp).toBeNull();
    expect(indicadores?.roe).toBeNull();
    expect(indicadores?.roa).toBeNull();
    expect(indicadores?.margemLiquida).toBeNull();
    expect(indicadores?.industria).toBeNull();
  });

  it("ticker inexistente (result vazio) devolve null", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      return respostaDeQuoteSummary(200, { quoteSummary: { result: [] } });
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    expect(await buscarIndicadoresFundamentalistas("ZZZZ9")).toBeNull();
  });

  it("crumb expirado (401 na primeira tentativa): renova e tenta de novo", async () => {
    let chamadasQuoteSummary = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      chamadasQuoteSummary++;
      if (chamadasQuoteSummary === 1) {
        return respostaDeQuoteSummary(401, { finance: { error: { code: "Unauthorized" } } });
      }
      return respostaDeQuoteSummary(200, corpoQuoteSummary({}));
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    const indicadores = await buscarIndicadoresFundamentalistas("PETR4");

    expect(chamadasQuoteSummary).toBe(2);
    expect(indicadores?.pl).not.toBeNull();
  });

  it("não consegue obter cookie do Yahoo → devolve null sem quebrar", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie([]); // sem Set-Cookie
      return respostaDeQuoteSummary(200, {});
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    expect(await buscarIndicadoresFundamentalistas("PETR4")).toBeNull();
  });

  it("resposta HTTP não-ok (e não 401) do quoteSummary devolve null", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fc.yahoo.com")) return respostaComCookie(COOKIE_VALIDO);
      if (url.includes("getcrumb")) return respostaDeCrumb(CRUMB_VALIDO);
      return respostaDeQuoteSummary(500, {});
    });
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    expect(await buscarIndicadoresFundamentalistas("PETR4")).toBeNull();
  });

  it("provedor fora do ar (fetch rejeita) devolve null, não derruba o job", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
    const { buscarIndicadoresFundamentalistas } = await carregarProviderComFetch(fetchMock);

    expect(await buscarIndicadoresFundamentalistas("PETR4")).toBeNull();
  });
});
