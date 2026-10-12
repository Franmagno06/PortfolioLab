import { ApiError } from "./api";
import type { AcaoFicha, AcaoResumo, EtfFicha, EtfResumo, FiiFicha, FiiResumo } from "./ativos-tipos";

/**
 * A leitura das páginas de ativos, feita no servidor do Next (as páginas são Server Components).
 * Não passa por `api()` de lib/api.ts: aquele usa o caminho relativo /api, que só existe no
 * navegador. Aqui a chamada vai direto ao backend, no mesmo endereço do rewrite do next.config.ts.
 *
 * O Next guarda cada resposta por 2 minutos. O backend já tem os próprios caches (cotação por
 * minutos, CVM por horas), então isto só impede que cada visita chegue ao limitador de requisições,
 * que conta o IP do servidor do Next, e não o de cada visitante.
 */

const API_URL = process.env.API_URL ?? "http://localhost:3333";
/** O E2E põe 0 para que cada teste leia o que o servidor de mentira devolve naquele instante. */
const REVALIDAR_EM_SEGUNDOS = Number(process.env.ATIVOS_REVALIDAR_S ?? 120);
/** A primeira leitura de um ativo pode esperar o Yahoo e a CVM. */
const TEMPO_LIMITE_MS = 20_000;

/** O JSON da rota, ou null se o backend respondeu 404 (ticker fora do catálogo). Outro erro lança. */
async function ler<T>(caminho: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${caminho}`, {
    next: { revalidate: REVALIDAR_EM_SEGUNDOS },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  // 400 é ticker em formato inválido, que para o leitor também é "não encontrado"
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new ApiError("Não foi possível carregar os dados agora.", res.status);
  return (await res.json()) as T;
}

async function lerLista<T>(caminho: string): Promise<T[]> {
  const itens = await ler<T[]>(caminho);
  if (!itens) throw new ApiError("Lista não encontrada.", 404);
  return itens;
}

export const listarAcoes = () => lerLista<AcaoResumo>("/ativos/acoes");
export const listarFiis = () => lerLista<FiiResumo>("/ativos/fiis");
export const listarEtfs = () => lerLista<EtfResumo>("/ativos/etfs");

export const buscarAcao = (ticker: string) => ler<AcaoFicha>(`/ativos/acoes/${encodeURIComponent(ticker)}`);
export const buscarEtf = (ticker: string) => ler<EtfFicha>(`/ativos/etfs/${encodeURIComponent(ticker)}`);
export const buscarFii = (ticker: string) => ler<FiiFicha>(`/ativos/fiis/${encodeURIComponent(ticker)}`);
