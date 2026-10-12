import type { Prisma, SnapshotType } from "@prisma/client";
import { comLimiteDeTempo, criarFila } from "./ativos.cache.js";
import { ativosRepository } from "./ativos.repository.js";

/**
 * As "fotografias": dado público que custa caro buscar (o zip da CVM passa de 20 MB) e muda
 * devagar, guardado na tabela asset_snapshots para a ficha não esperar por ele a cada visita.
 */

/** Quanto tempo cada tipo vale. Passado isso, a próxima leitura busca de novo. */
export const VALIDADE_DO_SNAPSHOT_MS: Record<SnapshotType, number> = {
  CVM_RESULTS: 24 * 60 * 60 * 1000,
  CVM_FUND_REPORT: 6 * 60 * 60 * 1000,
  NEWS: 30 * 60 * 1000,
};

/** Quanto a ficha espera pela busca antes de responder sem ela. A busca segue e grava ao terminar. */
const ESPERA_DA_FICHA_MS = 8_000;

export type EstadoDoBloco = "ok" | "desatualizado" | "indisponivel";

export type Fotografia<T> = {
  dados: T | null;
  atualizadoEm: Date | null;
  /**
   * ok: dado dentro da validade. desatualizado: a busca falhou ou demorou, e o que está aqui é
   * o último que deu certo. indisponivel: nunca houve dado e a busca não chegou a tempo.
   */
  estado: EstadoDoBloco;
};

type Resultado<T> = { dados: T; atualizadoEm: Date };

/**
 * As renovações pesadas (CVM) passam por esta fila, uma de cada vez. Interpretar o zip da CVM é
 * CPU síncrona, e duas ao mesmo tempo seguram o Node o dobro do tempo: nada mais é atendido, e os
 * limites de espera da ficha vencem antes de as respostas das outras fontes serem processadas.
 */
const filaPesada = criarFila((chave, erro) =>
  console.error(`[ativos] falha na renovação pesada ${chave}:`, erro instanceof Error ? erro.message : erro),
);

/** Roda a tarefa na fila pesada e devolve o resultado dela. A chave já é única por busca em voo. */
function emSerie<T>(chave: string, tarefa: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const entrou = filaPesada.adicionar(chave, async () => {
      try {
        resolve(await tarefa());
      } catch (erro) {
        reject(erro);
      }
    });
    // Já havia uma tarefa com esta chave na fila: roda direto, em vez de deixar a promessa pendurada.
    if (!entrou) tarefa().then(resolve, reject);
  });
}

/**
 * Depois que a busca de um (ativo, tipo) falha, ela não é tentada de novo por este tempo. Sem isso, um
 * ativo para o qual a fonte não tem dado (banco sem ITR publicado, FII sem informe) reinterpretaria
 * o zip da CVM, que é CPU síncrona, a cada visita, e um anônimo em laço em cima de uma ficha assim
 * manteria a fila pesada sempre ocupada. O que está guardado, se houver, continua sendo servido.
 */
const ESPERA_APOS_FALHA_MS = 30 * 60 * 1000;
const falhasRecentes = new Map<string, number>();

// Uma busca por (ativo, tipo) em voo. A ficha e o aquecimento do catálogo pedem a mesma
// coisa ao mesmo tempo, e o zip da CVM não deve ser interpretado duas vezes.
const emVoo = new Map<string, Promise<Resultado<unknown> | null>>();

export type OpcoesDaFotografia<T> = {
  assetId: string;
  tipo: SnapshotType;
  /** Devolve o dado, ou null quando a fonte falhou. Lista vazia é dado válido, não falha. */
  buscar: () => Promise<T | null>;
  esperaMaximaMs?: number;
  validadeMs?: number;
  /** Roda a renovação na fila pesada. Padrão: sim para os tipos da CVM, não para as notícias. */
  emSerie?: boolean;
};

export async function obterFotografia<T>({
  assetId,
  tipo,
  buscar,
  esperaMaximaMs = ESPERA_DA_FICHA_MS,
  validadeMs = VALIDADE_DO_SNAPSHOT_MS[tipo],
  emSerie: renovarEmSerie = tipo !== "NEWS",
}: OpcoesDaFotografia<T>): Promise<Fotografia<T>> {
  const guardada = await ativosRepository.findSnapshot(assetId, tipo);

  if (guardada && Date.now() - guardada.updatedAt.getTime() < validadeMs) {
    return { dados: guardada.data as T, atualizadoEm: guardada.updatedAt, estado: "ok" };
  }

  const chave = `${assetId}:${tipo}`;
  let atualizacao = emVoo.get(chave) as Promise<Resultado<T> | null> | undefined;

  const ultimaFalha = falhasRecentes.get(chave);
  if (!atualizacao && ultimaFalha !== undefined && Date.now() - ultimaFalha < ESPERA_APOS_FALHA_MS) {
    return semBusca(guardada);
  }

  if (!atualizacao) {
    const renovacao = () => buscarEGuardar(assetId, tipo, buscar);
    atualizacao = (renovarEmSerie ? emSerie(chave, renovacao) : renovacao()).finally(() => emVoo.delete(chave));
    emVoo.set(chave, atualizacao);
  }

  const resultado = await comLimiteDeTempo(atualizacao, esperaMaximaMs, null);
  if (resultado) return { dados: resultado.dados, atualizadoEm: resultado.atualizadoEm, estado: "ok" };

  // A busca falhou ou ainda não terminou. Se ela estourou o tempo, continua rodando e, ao
  // terminar, grava: a próxima visita já encontra o dado.
  return semBusca(guardada);
}

/** O que responder quando não há busca nova: o último dado bom, marcado como antigo, ou nada. */
function semBusca<T>(guardada: { data: unknown; updatedAt: Date } | null): Fotografia<T> {
  if (guardada) {
    return { dados: guardada.data as T, atualizadoEm: guardada.updatedAt, estado: "desatualizado" };
  }
  return { dados: null, atualizadoEm: null, estado: "indisponivel" };
}

/** Nunca lança: falha da fonte e falha do banco viram null, e a ficha segue com o que tem. */
async function buscarEGuardar<T>(
  assetId: string,
  tipo: SnapshotType,
  buscar: () => Promise<T | null>,
): Promise<Resultado<T> | null> {
  const chave = `${assetId}:${tipo}`;
  try {
    const dados = await buscar();
    if (dados === null) {
      falhasRecentes.set(chave, Date.now());
      return null;
    }

    const atualizadoEm = new Date();
    await ativosRepository.saveSnapshot(assetId, tipo, dados as Prisma.InputJsonValue, atualizadoEm);
    falhasRecentes.delete(chave);
    return { dados, atualizadoEm };
  } catch (erro) {
    falhasRecentes.set(chave, Date.now());
    console.error(`[ativos] falha ao atualizar ${tipo}:`, erro instanceof Error ? erro.message : erro);
    return null;
  }
}

/** Só para testes. */
export function limparBuscasEmVoo() {
  emVoo.clear();
  falhasRecentes.clear();
}

/** Só para testes: resolve quando a fila pesada esvazia. */
export const aguardarFilaPesada = () => filaPesada.ociosa();
