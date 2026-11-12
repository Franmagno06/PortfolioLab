/**
 * O que um relatório guarda e a tela mostra. Tudo sai dos números que a CVM publica, por regra fixa
 * (resumo-cvm.ts): não há texto escrito por IA nem lido de PDF.
 */

/** Um trecho do resumo: "O documento", "Resultado do trimestre", "Balanço na data-base"... */
export type BlocoDoResumo = { titulo: string; itens: string[] };

/**
 * Um ponto marcado por corte fixo. `criterio` é a regra que o gerou, escrita para a tela
 * ("lucro 15% ou mais acima da base de comparação"): diz a direção do número, não a qualidade.
 */
export type Destaque = { titulo: string; detalhe: string; criterio: string };
export type Alerta = Destaque & { severidade: "atencao" | "critico" };

export type Analise = {
  /**
   * Versão das regras que montaram a análise. O cache (cvm_summaries) só é reaproveitado quando a
   * versão bate: análises antigas, escritas por IA, por regras anteriores ou à mão na seed, são
   * refeitas a partir da CVM em vez de continuarem aparecendo.
   */
  versao: number;
  tipoDocumento: string;
  /** O resumo do documento, em blocos. Até a versão 2 era a lista solta `resumoExecutivo`. */
  blocos: BlocoDoResumo[];
  /** "Destaques do período": o número andou na direção que o corte descreve. */
  destaques: Destaque[];
  /** "Pontos de atenção" (atencao) e "Pontos críticos" (critico). */
  alertas: Alerta[];
  /** `definicao`: o que a conta é, ou como o indicador é calculado. Neutra, sem juízo. */
  indicadores: { nome: string; valor: string; definicao: string }[];
  /** Data-base do documento, "AAAA-MM-DD". */
  dataReferencia: string;
  /** Página do documento no sistema da CVM, quando o arquivo de dados abertos a traz. */
  link: string | null;
};

/** Suba ao mudar o que resumo-cvm.ts escreve ou calcula: é o que invalida o cache. */
export const VERSAO_DA_ANALISE = 3;

/** Uma análise guardada serve se foi montada pelas regras atuais. O JSON do banco não tem tipo. */
export function ehAnaliseAtual(valor: unknown): valor is Analise {
  return typeof valor === "object" && valor !== null && (valor as { versao?: unknown }).versao === VERSAO_DA_ANALISE;
}
