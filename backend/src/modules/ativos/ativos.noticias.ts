import { citaAtivo, noticiasComCache, termosDoAtivo } from "../news/news.service.js";
import type { ItemNoticia } from "../news/rss.js";
import type { NoticiaDoAtivo } from "./ativos.tipos.js";

/**
 * As notícias da ficha de um ativo: as mesmas fontes da aba de Notícias (Money Times e Suno,
 * feeds RSS das próprias editoras), filtradas pelas que citam o ticker ou o nome da empresa.
 * Usa o cache de 10 minutos dessa aba, então abrir uma ficha não faz outra ida aos feeds.
 *
 * Os feeds guardam só as últimas dezenas de matérias, então um ativo pouco comentado pode ficar
 * sem nenhuma. A ficha mostra isso como "nenhuma notícia recente", e não como erro.
 */

const MAXIMO_NA_FICHA = 5;

/** O nome como a imprensa o escreve: sem a classe da ação e sem o "(antigo ...)" dos FIIs renomeados. */
export function nomeParaBusca(nome: string): string {
  return nome
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+(ON|PN|Unit)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pura: as notícias do ativo dentre as de um feed, as mais recentes primeiro. */
export function noticiasDoAtivo(itens: ItemNoticia[], ticker: string, nome: string): NoticiaDoAtivo[] {
  const termos = termosDoAtivo(ticker, nomeParaBusca(nome));

  return itens
    .filter((n) => citaAtivo(n.titulo, n.resumo, termos))
    .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm))
    .slice(0, MAXIMO_NA_FICHA)
    .map((n) => ({ titulo: n.titulo, fonte: n.fonte, publicadaEm: n.publicadoEm, url: n.link }));
}

export async function buscarNoticiasDoAtivo(ticker: string, nome: string): Promise<NoticiaDoAtivo[]> {
  return noticiasDoAtivo(await noticiasComCache(), ticker, nome);
}
