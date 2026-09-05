import { portfolioService } from "../portfolio/portfolio.service.js";
import { buscarNoticias, type ItemNoticia } from "./rss.js";

export type NoticiaClassificada = ItemNoticia & {
  /** Tickers da carteira do usuário citados nesta notícia */
  tickers: string[];
};

// Os feeds mudam a cada poucos minutos e são de terceiros — cachear evita
// martelar os servidores deles e deixa a resposta instantânea.
const CACHE_MS = 10 * 60 * 1000;
let cache: { em: number; itens: ItemNoticia[] } | null = null;

async function noticiasComCache(): Promise<ItemNoticia[]> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.itens;

  const itens = await buscarNoticias();
  // só substitui o cache se veio algo — se todas as fontes falharem,
  // é melhor servir notícia velha do que lista vazia
  if (itens.length > 0) cache = { em: Date.now(), itens };

  return cache?.itens ?? [];
}

/** Remove acentos e caixa para comparar "Itaú" com "itau". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Ruído societário: classe da ação, forma jurídica e a papelada que todo FII
// carrega no nome. Nada disso identifica a empresa.
const RUIDO =
  /[\s.]*\b(on|pn|pna|pnb|unt|units?|fii|etf|s\s?\.?\s?a|sa|ltda|holding|participacoes)\b\.?\s*$/i;
const PAPELADA_DE_FUNDO =
  /\s*\bfundos?\s+(de\s+)?investimentos?\s+imobiliari[oa]s?\b\s*/gi;

// Termos que sozinhos casariam com metade do noticiário. Só barram quando são
// o resultado inteiro: "Auren Energia" passa, "Energia" não.
const GENERICOS = new Set([
  "banco",
  "brasil",
  "energia",
  "renda",
  "companhia",
  "industria",
  "comercio",
  "participacoes",
  "shopping",
  "logistica",
]);

/** Um candidato a nome só serve se for longo e não for palavra genérica. */
function ehTermoUtil(termo: string): boolean {
  return termo.length >= 5 && !GENERICOS.has(termo);
}

/**
 * Monta os termos que identificam um ativo numa notícia.
 *
 * O ticker sempre entra: é o identificador de maior precisão, e a imprensa
 * brasileira costuma citá-lo entre parênteses — "Banco do Brasil (BBAS3)".
 *
 * O nome exige tratamento. O que o provedor devolve é a razão social, e quase
 * nunca é como a notícia escreve: "Companhia Energética de Minas Gerais -
 * CEMIG" vira "Cemig", e "Kinea Renda Imobiliária Fundo de Investimento
 * Imobiliário" vira "Kinea". Por isso o nome é quebrado no hífen — a marca
 * costuma estar de um dos lados — e limpo da papelada societária. Termo curto
 * ou genérico é descartado, senão "Energia" casaria com o setor inteiro.
 */
export function termosDoAtivo(ticker: string, nome: string): string[] {
  const termos = new Set([normalizar(ticker)]);

  for (const parte of nome.split(/\s+-\s+/)) {
    const limpo = normalizar(parte)
      .replace(PAPELADA_DE_FUNDO, " ")
      .replace(/[()]/g, " ")
      .replace(RUIDO, "")
      .replace(/\s+/g, " ")
      .trim();

    if (ehTermoUtil(limpo)) termos.add(limpo);
  }

  return [...termos];
}

/** Escapa o que for especial em regex, para o termo entrar como texto puro. */
function comoRegex(termo: string): string {
  return termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Diz se a notícia cita o ativo, olhando título e resumo.
 *
 * O resumo entra porque a manchete brasileira costuma ser genérica — "Bancos
 * puxam o Ibovespa" — e é o lead que nomeia quem subiu.
 *
 * A busca exige palavra inteira: sem isso "banco do brasil" casaria dentro de
 * "banco do brasilia", e "vale" dentro de "valeu".
 */
export function citaAtivo(titulo: string, resumo: string, termos: string[]): boolean {
  const alvo = normalizar(`${titulo} ${resumo}`);
  const limite = "\\b";
  return termos.some((termo) => new RegExp(limite + comoRegex(termo) + limite).test(alvo));
}

export const newsService = {
  async listar(userId: string) {
    const [noticias, carteira] = await Promise.all([
      noticiasComCache(),
      // getCarteira já descarta posições zeradas
      portfolioService.getCarteira(userId),
    ]);

    const ativos = carteira.map((a) => ({
      ticker: a.ticker,
      termos: termosDoAtivo(a.ticker, a.name),
    }));

    const classificadas: NoticiaClassificada[] = noticias.map((n) => {
      const tickers = ativos.filter((a) => citaAtivo(n.titulo, n.resumo ?? "", a.termos));
      return { ...n, tickers: tickers.map((a) => a.ticker) };
    });

    return {
      // notícias que citam algum ativo da carteira
      daSuaCarteira: classificadas.filter((n) => n.tickers.length > 0),
      // o resto do noticiário de mercado
      mercado: classificadas.filter((n) => n.tickers.length === 0),
      atualizadoEm: new Date(cache?.em ?? Date.now()).toISOString(),
    };
  },
};
