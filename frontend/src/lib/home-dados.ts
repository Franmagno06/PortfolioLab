import type { ResumoDeArtigo } from "@/components/aprender/card-artigo";
import type { Artigo, IdDeCategoria } from "./aprender/tipos";
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

/** Os temas de quem está começando: uma data recente em análise de ações não pode abrir a seção só com ações. */
const CATEGORIAS_DE_INICIANTE: readonly IdDeCategoria[] = ["antes-de-investir", "renda-fixa"];

/**
 * Os `quantos` artigos de "Comece por aqui", sem o artigo em destaque, que a seção já mostra à parte.
 * Primeiro os das categorias de iniciante (Antes de investir, Renda fixa), depois, se faltar, os das outras;
 * dentro de cada grupo, o mais recente por `atualizadoEm` (empate: título em ordem alfabética, como em
 * listarArtigos). Não altera a lista recebida.
 */
export function artigosParaComecar<T extends ArtigoParaComecar>(artigos: T[], destaque: string | undefined, quantos = 3): T[] {
  const doIniciante = (a: T) => (CATEGORIAS_DE_INICIANTE.includes(a.categoria) ? 0 : 1);
  return artigos
    .filter((a) => a.slug !== destaque)
    .sort(
      (a, b) =>
        doIniciante(a) - doIniciante(b) ||
        b.atualizadoEm.localeCompare(a.atualizadoEm) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    )
    .slice(0, quantos);
}

/**
 * Os números do bento e o minigráfico do Ibovespa. `numeros` é o mesmo `numerosDoMes` do resto da home.
 *
 * O minigráfico é o último fechamento de cada um dos 12 últimos meses da série do Ibovespa na MESMA resposta.
 * É `null` quando os números caíram no conjunto fixo (nunca misturar uma linha ao vivo com números fixos de
 * outra data) e quando há menos de 2 meses (um ponto só não é linha).
 *
 * Ponto com valor não finito (NaN, Infinity) é DESCARTADO antes de tudo: o último fechamento válido do mês
 * fica no lugar. Buraco de mês dentro da janela (ex.: falta março entre fevereiro e abril) devolve `null`:
 * uma linha que liga fevereiro direto a abril pareceria mensal e mentiria sobre o intervalo.
 */
export function numerosDoBento(dados: DadosDosIndices | null): { numeros: NumerosDoMes; minigraficoIbovespa: number[] | null } {
  const numeros = numerosDoMes(dados);
  if (!dados || !numeros.aoVivo) return { numeros, minigraficoIbovespa: null };

  // ordena por data e deixa o último ponto válido de cada mês sobrescrever os anteriores
  const pontos = dados.pontos.ibovespa.filter((p) => Number.isFinite(p.valor)).sort((a, b) => a.data.localeCompare(b.data));
  const ultimoDoMes = new Map<string, number>();
  for (const p of pontos) ultimoDoMes.set(p.data.slice(0, 7), p.valor);
  const meses = [...ultimoDoMes.entries()].slice(-12);
  if (meses.length < 2) return { numeros, minigraficoIbovespa: null };

  for (let i = 1; i < meses.length; i++) {
    if (meses[i]![0] !== mesSeguinte(meses[i - 1]![0])) return { numeros, minigraficoIbovespa: null };
  }
  return { numeros, minigraficoIbovespa: meses.map(([, valor]) => valor) };
}

/** "2026-12" → "2027-01". */
function mesSeguinte(anoMes: string): string {
  const ano = Number(anoMes.slice(0, 4));
  const mes = Number(anoMes.slice(5, 7));
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

/** Quantas fichas cada lista de Ativos tem: o catálogo curado do front (o teste confere com o do backend). */
export const QUANTIDADE_DE_FICHAS = { acoes: ACOES.length, fiis: FIIS.length, etfs: ETFS.length } as const;
