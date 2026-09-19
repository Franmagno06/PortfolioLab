import { AssetType } from "@prisma/client";

/**
 * Cotações da B3 via Yahoo Finance.
 *
 * Por que Yahoo e não brapi.dev (que estava no roadmap): o brapi não tem
 * plano gratuito — a partir de R$ 99,99/mês — e sem token libera apenas
 * 4 tickers. O Yahoo é gratuito, dispensa chave e cobre ações e FIIs da B3.
 * Na B3, o sufixo do ticker é `.SA` (MXRF11 → MXRF11.SA).
 */

export type Cotacao = {
  ticker: string;
  nome: string;
  preco: number;
  tipo: AssetType;
};

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// A API recusa requisições sem User-Agent de navegador
const CABECALHOS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

type MetaYahoo = {
  regularMarketPrice?: number;
  longName?: string;
  shortName?: string;
  currency?: string;
};

/**
 * Descobre a classe do ativo a partir do nome e do ticker.
 *
 * O sufixo sozinho não basta: BOVA11 (ETF), MXRF11 (FII) e ENGI11 (unit de
 * ação) terminam todos em 11. Por isso o nome tem prioridade sobre o número.
 */
export function classificar(ticker: string, nome: string): AssetType {
  if (/fii|imobili/i.test(nome)) return AssetType.FII;
  if (/\betf\b|ishares|index|índice|indice/i.test(nome)) return AssetType.ETF;

  // sem pista no nome: 3/4/5/6 são ações ordinárias/preferenciais;
  // 11 remanescente é unit, que também é renda variável de empresa
  if (/\d$/.test(ticker)) return AssetType.ACAO;

  return AssetType.ACAO;
}

/** Consulta um ticker. Devolve null se não existir ou a API falhar. */
export async function buscarCotacao(ticker: string): Promise<Cotacao | null> {
  const simbolo = ticker.toUpperCase().trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE}/${simbolo}.SA?interval=1d&range=1d`, {
      headers: CABECALHOS,
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: { result?: { meta?: MetaYahoo }[] };
    };

    const meta = json.chart?.result?.[0]?.meta;
    const preco = meta?.regularMarketPrice;

    // preço ausente ou zerado indica ticker inexistente
    if (!meta || typeof preco !== "number" || preco <= 0) return null;

    const nome = (meta.longName ?? meta.shortName ?? simbolo).trim();

    return { ticker: simbolo, nome, preco, tipo: classificar(simbolo, nome) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cookie + crumb (CSRF token) exigidos pelo quoteSummary — diferente do
 * v8/chart usado em buscarCotacao, que continua aberto. Sem os dois, a API
 * devolve 401 "Invalid Crumb". Cacheados no módulo porque não mudam entre
 * chamadas: renovados só se uma chamada com eles ainda assim levar 401.
 */
type CredenciaisYahoo = { cookie: string; crumb: string };
let credenciaisCache: CredenciaisYahoo | null = null;

async function obterCredenciaisYahoo(): Promise<CredenciaisYahoo | null> {
  try {
    // fc.yahoo.com devolve 404 de propósito (não é uma página real) — o que
    // importa é o Set-Cookie da resposta, presente mesmo com esse status.
    const resCookie = await fetch("https://fc.yahoo.com", { headers: CABECALHOS });
    const cookies = resCookie.headers.getSetCookie?.() ?? [];
    const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    if (!cookie) return null;

    const resCrumb = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...CABECALHOS, Cookie: cookie },
    });
    if (!resCrumb.ok) return null;

    const crumb = (await resCrumb.text()).trim();
    if (!crumb) return null;

    return { cookie, crumb };
  } catch {
    return null;
  }
}

/** Indicadores fundamentalistas de um ativo, calculados a partir do Yahoo. */
export type IndicadoresDoProvedor = {
  /**
   * Preço/Lucro, calculado como preço ÷ (lucro líquido TTM ÷ nº de ações),
   * e NÃO o campo `trailingPE` pronto do Yahoo: para ações da B3 esse campo
   * mostrou-se inflado (~4x) em relação à janela correta — ver o comentário
   * em `calcularPL`. Pode ser negativo (empresa com prejuízo) ou extremo
   * (lucro perto de zero): isso é legítimo, esta função não filtra.
   */
  pl: number | null;
  /** Preço/Valor Patrimonial. */
  pvp: number | null;
  /** Retorno sobre patrimônio líquido, em pontos percentuais. */
  roe: number | null;
  /** Retorno sobre ativos, em pontos percentuais — padrão de mercado para bancos. */
  roa: number | null;
  /** Margem líquida, em pontos percentuais. */
  margemLiquida: number | null;
  /** Setor/indústria como o Yahoo classifica (ex.: "Banks - Regional"). */
  industria: string | null;
  /** Preço no instante da consulta — usado pelo job para o cálculo do P/L e do Dividend Yield. */
  precoAtual: number | null;
};

// Cada campo numérico do quoteSummary vem como número puro ou como
// { raw, fmt }, a depender do módulo. Aceita as duas formas e normaliza
// null quando ausente.
type CampoYahoo = number | { raw?: number } | null | undefined;

function numeroOuNulo(campo: CampoYahoo): number | null {
  if (typeof campo === "number") return campo;
  if (campo && typeof campo.raw === "number") return campo.raw;
  return null;
}

// O Yahoo devolve taxas como fração (0.045); os pontos percentuais que a
// tela mostra multiplicam por 100 aqui, na fronteira com o provedor externo.
function percentualOuNulo(campo: CampoYahoo): number | null {
  const fracao = numeroOuNulo(campo);
  return fracao === null ? null : fracao * 100;
}

/**
 * P/L pela janela certa: preço ÷ (lucro líquido dos últimos 4 trimestres ÷
 * nº de ações). `netIncomeToCommon` do Yahoo já é TTM; o que estava errado
 * era o divisor. Testado ao vivo contra TAEE11 (ação "unit"): dividir pelo
 * `sharesOutstanding` bate com a referência de mercado (P/L ~9); dividir
 * pelo `impliedSharesOutstanding` (contagem de ações-base, maior numa unit)
 * ou usar o `trailingPE`/`trailingEps` prontos do Yahoo infla o resultado
 * em ~4x. Por isso o divisor é sempre `sharesOutstanding`.
 */
function calcularPL(
  precoAtual: number | null,
  netIncomeToCommon: number | null,
  sharesOutstanding: number | null,
): number | null {
  if (precoAtual === null || netIncomeToCommon === null || !sharesOutstanding) return null;
  const lucroPorAcao = netIncomeToCommon / sharesOutstanding;
  if (lucroPorAcao === 0) return null;
  return precoAtual / lucroPorAcao;
}

type QuoteSummaryModulo = Record<string, CampoYahoo>;

/**
 * Busca P/L, P/VP, ROE, ROA, margem líquida e setor via quoteSummary.
 *
 * NÃO busca Dividend Yield: o campo `dividendYield` do Yahoo reflete só o
 * último provento anunciado, não a soma dos últimos 12 meses (confirmado ao
 * vivo em BBAS3: 0,61% no campo pronto contra ~2,8% somando os proventos
 * reais). O job calcula o DY a partir do módulo Proventos (Dividend) —
 * ver scripts/atualizar-indicadores.ts.
 *
 * Usada só pelo job diário — nunca a cada requisição da tela de
 * Indicadores, que lê o cache em AssetIndicator. Devolve null se o ticker
 * não existir ou a API falhar; cada campo do resultado é null
 * individualmente quando o próprio Yahoo não o informa (comum em empresa
 * recém-listada).
 */
export async function buscarIndicadoresFundamentalistas(
  ticker: string,
): Promise<IndicadoresDoProvedor | null> {
  const simbolo = ticker.toUpperCase().trim();
  const modulos = "defaultKeyStatistics,financialData,assetProfile,price";

  // Uma renovação de credenciais chega para tentar de novo: se o crumb já
  // cacheado expirou (401), busca um novo uma única vez antes de desistir.
  for (const forcarRenovacao of [false, true]) {
    if (forcarRenovacao) credenciaisCache = null;
    const credenciais = (credenciaisCache ??= await obterCredenciaisYahoo());
    if (!credenciais) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${simbolo}.SA` +
          `?modules=${modulos}&crumb=${encodeURIComponent(credenciais.crumb)}`,
        { headers: { ...CABECALHOS, Cookie: credenciais.cookie }, signal: controller.signal },
      );

      if (res.status === 401 && !forcarRenovacao) continue; // crumb expirado: tenta renovar
      if (!res.ok) return null;

      return await interpretarRespostaIndicadores(res);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

async function interpretarRespostaIndicadores(
  res: Response,
): Promise<IndicadoresDoProvedor | null> {
  const json = (await res.json()) as {
    quoteSummary?: {
      result?:
        | {
            defaultKeyStatistics?: QuoteSummaryModulo;
            financialData?: QuoteSummaryModulo;
            assetProfile?: { sector?: string | null; industry?: string | null };
            price?: QuoteSummaryModulo;
          }[]
        | null;
    };
  };

  const resultado = json.quoteSummary?.result?.[0];
  if (!resultado) return null;

  const { defaultKeyStatistics, financialData, assetProfile, price } = resultado;

  const precoAtual = numeroOuNulo(price?.["regularMarketPrice"]);
  const netIncomeToCommon = numeroOuNulo(defaultKeyStatistics?.["netIncomeToCommon"]);
  const sharesOutstanding = numeroOuNulo(defaultKeyStatistics?.["sharesOutstanding"]);

  return {
    pl: calcularPL(precoAtual, netIncomeToCommon, sharesOutstanding),
    pvp: numeroOuNulo(defaultKeyStatistics?.["priceToBook"]),
    roe: percentualOuNulo(financialData?.["returnOnEquity"]),
    roa: percentualOuNulo(financialData?.["returnOnAssets"]),
    margemLiquida: percentualOuNulo(
      financialData?.["profitMargins"] ?? defaultKeyStatistics?.["profitMargins"],
    ),
    industria: assetProfile?.industry ?? null,
    precoAtual,
  };
}

/** Consulta vários tickers em paralelo, ignorando os que falharem. */
export async function buscarCotacoes(tickers: string[]): Promise<Map<string, Cotacao>> {
  const resultados = await Promise.all(tickers.map(buscarCotacao));

  const porTicker = new Map<string, Cotacao>();
  for (const c of resultados) {
    if (c) porTicker.set(c.ticker, c);
  }
  return porTicker;
}

/** Um provento anunciado pela empresa, como o Yahoo o devolve. */
export type ProventoDoProvedor = {
  /** Data-ex: quem tinha a posição ANTES dela recebe; quem comprou nela, não. */
  dataEx: Date;
  /** Valor por cota, em reais. */
  valorPorCota: number;
};

/**
 * Histórico de proventos de um ticker.
 *
 * Mesma API de cotação, com `events=div`. O Yahoo devolve a data-ex (não a de
 * pagamento, que ele não expõe) e o valor por cota — nunca o total recebido,
 * que depende da posição de cada investidor.
 *
 * Devolve lista vazia se a API falhar: proventos são enfeite da carteira, não
 * podem derrubar a rota. Mesmo contrato defensivo de buscarCotacao.
 */
export async function buscarProventos(
  ticker: string,
  desde: Date,
): Promise<ProventoDoProvedor[]> {
  const simbolo = ticker.toUpperCase().trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  // segundos desde a época — o formato que a API espera
  const inicio = Math.floor(desde.getTime() / 1000);
  const fim = Math.floor(Date.now() / 1000);

  try {
    const res = await fetch(
      `${BASE}/${simbolo}.SA?period1=${inicio}&period2=${fim}&interval=1d&events=div`,
      { headers: CABECALHOS, signal: controller.signal },
    );
    if (!res.ok) return [];

    const json = (await res.json()) as {
      chart?: {
        result?: { events?: { dividends?: Record<string, { amount?: number; date?: number }> } }[];
      };
    };

    const eventos = json.chart?.result?.[0]?.events?.dividends;
    if (!eventos) return [];

    return Object.values(eventos)
      .filter(
        (e): e is { amount: number; date: number } =>
          typeof e.amount === "number" && e.amount > 0 && typeof e.date === "number",
      )
      .map((e) => ({ dataEx: new Date(e.date * 1000), valorPorCota: e.amount }))
      .sort((a, b) => a.dataEx.getTime() - b.dataEx.getTime());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
