import type { DadosDosIndices } from "./indices";

/**
 * A leitura de GET /indices/dados, feita no servidor do Next (as páginas de índices são Server
 * Components). Mesmo molde de ativos-api.ts: direto em API_URL, e não pelo /api do navegador.
 *
 * Diferente de lá, aqui nada lança: qualquer falha (rede, prazo, status de erro, corpo que não é
 * JSON) vira `null`, e a página mostra o aviso "não conseguimos buscar agora" em vez de quebrar.
 */

const API_URL = process.env.API_URL ?? "http://localhost:3333";
/** O E2E põe 0 para que cada teste leia o que o servidor de mentira devolve naquele instante. */
const REVALIDAR_EM_SEGUNDOS = Number(process.env.ATIVOS_REVALIDAR_S ?? 120);
/** O backend responde em até 15 s quando o Banco Central está lento. */
const TEMPO_LIMITE_MS = 20_000;

/**
 * `prazoMs` encurta a espera: a home usa 5 s, porque lá os números do mês têm o conjunto fixo como
 * reserva e não vale segurar o visitante; as páginas de índices esperam os 20 s.
 */
export async function lerDadosDosIndices({ prazoMs = TEMPO_LIMITE_MS }: { prazoMs?: number } = {}): Promise<DadosDosIndices | null> {
  try {
    const res = await fetch(`${API_URL}/indices/dados`, {
      next: { revalidate: REVALIDAR_EM_SEGUNDOS },
      signal: AbortSignal.timeout(prazoMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as DadosDosIndices;
  } catch {
    return null;
  }
}
