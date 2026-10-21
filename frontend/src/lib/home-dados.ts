import type { ResumoDeArtigo } from "@/components/aprender/card-artigo";
import type { Artigo } from "./aprender/tipos";
import { ACOES, ETFS, FIIS } from "./ativos-catalogo";
import type { DadosDosIndices } from "./indices";
import { numerosDoMes, type NumerosDoMes } from "./site-dados";

/**
 * Os dados das seções da página inicial que não são texto fixo: os artigos de "Comece por aqui", os
 * números do bento de "Ativos e índices" e a contagem das fichas. Funções puras, testadas em
 * home-dados.test.ts; a página só as chama.
 */

/** O que o cartão de artigo precisa, mais a data que decide a ordem. */
export type ArtigoParaComecar = ResumoDeArtigo & Pick<Artigo, "atualizadoEm">;

/**
 * Os `quantos` artigos mais recentes por `atualizadoEm` (empate: título em ordem alfabética, como em
 * listarArtigos), sem o artigo em destaque, que a seção já mostra à parte. Não altera a lista recebida.
 */
export function artigosParaComecar<T extends ArtigoParaComecar>(artigos: T[], destaque: string | undefined, quantos = 3): T[] {
  return artigos
    .filter((a) => a.slug !== destaque)
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm) || a.titulo.localeCompare(b.titulo, "pt-BR"))
    .slice(0, quantos);
}

/**
 * Os números do bento e o minigráfico do Ibovespa. `numeros` é o mesmo `numerosDoMes` do resto da home.
 *
 * O minigráfico é o último fechamento de cada um dos 12 últimos meses da série do Ibovespa na MESMA resposta.
 * É `null` quando os números caíram no conjunto fixo (nunca misturar uma linha ao vivo com números fixos de
 * outra data) e quando há menos de 2 meses (um ponto só não é linha).
 */
export function numerosDoBento(dados: DadosDosIndices | null): { numeros: NumerosDoMes; minigraficoIbovespa: number[] | null } {
  const numeros = numerosDoMes(dados);
  if (!dados || !numeros.aoVivo) return { numeros, minigraficoIbovespa: null };

  // a série vem em ordem de data: o último ponto de cada mês sobrescreve os anteriores
  const ultimoDoMes = new Map<string, number>();
  for (const p of dados.pontos.ibovespa) ultimoDoMes.set(p.data.slice(0, 7), p.valor);
  const meses = [...ultimoDoMes.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12);

  return { numeros, minigraficoIbovespa: meses.length < 2 ? null : meses.map(([, valor]) => valor) };
}

/** Quantas fichas cada lista de Ativos tem: o catálogo curado do front (o teste confere com o do backend). */
export const QUANTIDADE_DE_FICHAS = { acoes: ACOES.length, fiis: FIIS.length, etfs: ETFS.length } as const;
