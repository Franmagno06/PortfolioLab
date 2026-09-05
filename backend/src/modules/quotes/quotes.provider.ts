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
