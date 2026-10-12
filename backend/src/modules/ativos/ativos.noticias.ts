import { atualizarHistorico, noticiasDosUltimosDias } from "../news/news.historico.js";
import { citaAtivo, normalizar, termosDoAtivo } from "../news/news.service.js";
import type { ItemNoticia } from "../news/rss.js";
import type { NoticiaDoAtivo } from "./ativos.tipos.js";

/**
 * As notícias da ficha de um ativo: dos feeds RSS públicos de várias editoras, guardados por 14 dias
 * (news.historico.ts), filtradas pelas que citam o ticker ou o nome da empresa. Cada feed mostra só
 * as últimas dezenas de matérias, mas o histórico acumula, então um ativo pouco comentado ainda
 * acha as de alguns dias atrás. Sem nenhuma, a ficha diz "nenhuma notícia recente", e não erro.
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
  // a mesma matéria sai em vários portais, com links diferentes: fica a mais recente de cada título
  const vistas = new Set<string>();

  return itens
    .filter((n) => citaAtivo(n.titulo, n.resumo, termos))
    .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm))
    .filter((n) => {
      const chave = normalizar(n.titulo);
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    })
    .slice(0, MAXIMO_NA_FICHA)
    .map((n) => ({ titulo: n.titulo, fonte: n.fonte, publicadaEm: n.publicadoEm, url: n.link }));
}

export async function buscarNoticiasDoAtivo(ticker: string, nome: string): Promise<NoticiaDoAtivo[]> {
  // lê os feeds se já passou o prazo, e procura o ativo em tudo o que está guardado
  await atualizarHistorico();
  return noticiasDoAtivo(await noticiasDosUltimosDias(), ticker, nome);
}
