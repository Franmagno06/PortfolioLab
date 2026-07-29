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
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Sufixos de classe da ação/cota que não ajudam a identificar a empresa
const SUFIXOS = /\s+(on|pn|pna|pnb|unt|units?|fii|etf|s\.a\.?|sa)$/i;

/**
 * Monta os termos que identificam um ativo numa notícia.
 * - o ticker sempre entra (alta precisão: "PETR4")
 * - o nome da empresa só entra com 5+ caracteres, porque nomes curtos como
 *   "Vale" casariam com o verbo ("vale a pena") e poluiriam o resultado
 */
function termosDoAtivo(ticker: string, nome: string): string[] {
  const termos = [normalizar(ticker)];

  const nomeLimpo = nome.replace(SUFIXOS, "").trim();
  if (nomeLimpo.length >= 5) termos.push(normalizar(nomeLimpo));

  return termos;
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
      const alvo = normalizar(n.titulo);
      const tickers = ativos.filter((a) => a.termos.some((t) => alvo.includes(t)));
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
