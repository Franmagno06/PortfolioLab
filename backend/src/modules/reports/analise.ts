/**
 * O que um relatório guarda e a tela mostra. Tudo sai dos números que a CVM publica, por regra fixa
 * (resumo-cvm.ts): não há texto escrito por IA nem lido de PDF.
 */
export type Analise = {
  /**
   * Versão das regras que montaram a análise. O cache (cvm_summaries) só é reaproveitado quando a
   * versão bate: análises antigas, escritas por IA, por regras anteriores ou à mão na seed, são
   * refeitas a partir da CVM em vez de continuarem aparecendo.
   */
  versao: number;
  tipoDocumento: string;
  resumoExecutivo: string[];
  alertas: { titulo: string; severidade: "info" | "atencao" | "critico"; detalhe: string }[];
  indicadores: { nome: string; valor: string }[];
  /** Data-base do documento, "AAAA-MM-DD". */
  dataReferencia: string;
  /** Página do documento no sistema da CVM, quando o arquivo de dados abertos a traz. */
  link: string | null;
};

/** Suba ao mudar o que resumo-cvm.ts escreve ou calcula: é o que invalida o cache. */
export const VERSAO_DA_ANALISE = 2;

/** Uma análise guardada serve se foi montada pelas regras atuais. O JSON do banco não tem tipo. */
export function ehAnaliseAtual(valor: unknown): valor is Analise {
  return typeof valor === "object" && valor !== null && (valor as { versao?: unknown }).versao === VERSAO_DA_ANALISE;
}
