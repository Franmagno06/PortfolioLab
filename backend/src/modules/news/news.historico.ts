import { newsRepository } from "./news.repository.js";
import { buscarNoticias, FONTES_PARA_ATIVOS, type ItemNoticia } from "./rss.js";

/**
 * O histórico de notícias que alimenta as fichas de ativos. Os feeds mostram só as últimas dezenas
 * de matérias, então um ativo pouco comentado ficaria sem nenhuma. Aqui as matérias lidas ficam
 * guardadas por alguns dias, e a ficha procura o ativo em todas elas, e não só no último lote.
 *
 * A aba Notícias da carteira não passa por aqui: ela continua lendo só Money Times e Suno, sem banco.
 */

export const DIAS_DE_HISTORICO = 14;

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 10 * 60 * 1000;
/** Se todos os feeds falham, tenta de novo em um minuto, e não a cada visita. */
const NOVA_TENTATIVA_APOS_FALHA_MS = 60 * 1000;

let ultimaLeitura = 0;
let buscaEmVoo: Promise<void> | null = null;

/**
 * Lê os feeds, no máximo uma vez a cada dez minutos e uma ida por vez, e guarda as matérias. Nunca
 * lança: feed fora do ar ou banco indisponível só deixam o histórico como estava.
 */
export function atualizarHistorico(): Promise<void> {
  if (Date.now() - ultimaLeitura < CACHE_MS) return Promise.resolve();

  buscaEmVoo ??= lerEGuardar()
    .catch((erro: unknown) => {
      console.error("[news] falha ao atualizar o histórico:", erro instanceof Error ? erro.message : erro);
    })
    .finally(() => {
      buscaEmVoo = null;
    });
  return buscaEmVoo;
}

async function lerEGuardar(): Promise<void> {
  const itens = await buscarNoticias(FONTES_PARA_ATIVOS);

  if (itens.length === 0) {
    // nenhuma fonte respondeu: não conta como leitura, mas também não repete a cada requisição
    ultimaLeitura = Date.now() - CACHE_MS + NOVA_TENTATIVA_APOS_FALHA_MS;
    return;
  }

  ultimaLeitura = Date.now();
  await newsRepository.saveMany(itens);
  await newsRepository.deleteOlderThan(new Date(Date.now() - DIAS_DE_HISTORICO * UM_DIA_MS));
}

/** As notícias dos últimos dias, as mais recentes primeiro. Lança se o banco falhar. */
export async function noticiasDosUltimosDias(dias = DIAS_DE_HISTORICO): Promise<ItemNoticia[]> {
  const linhas = await newsRepository.findSince(new Date(Date.now() - dias * UM_DIA_MS));
  return linhas.map((l) => ({
    titulo: l.title,
    resumo: l.summary,
    link: l.url,
    fonte: l.source,
    publicadoEm: l.publishedAt.toISOString(),
  }));
}

/** Só para testes. */
export function reiniciarHistorico() {
  ultimaLeitura = 0;
  buscaEmVoo = null;
}
