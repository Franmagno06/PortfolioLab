/**
 * Logos das empresas: um SVG por ação em public/logos/<TICKER>.svg, hospedado
 * aqui mesmo. Não vem de outro domínio porque o CSP do site só aceita imagem
 * de 'self', e porque assim a página não depende de um serviço de terceiros
 * estar no ar.
 *
 * Fonte dos arquivos: ícones públicos da brapi (icons.brapi.dev/icons/<TICKER>.svg),
 * baixados uma vez. São marcas de seus titulares e aparecem só para identificar
 * a empresa; as listagens avisam isso ao leitor.
 *
 * FII não tem logo: o ícone mais próximo seria o do gestor, e a logo da XP ao
 * lado de "MXRF11" sugeriria que ela é o fundo. FII ganha um ícone por tipo.
 */
export const ACOES_COM_LOGO = [
  "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "WEGE3", "B3SA3",
  "SUZB3", "AXIA3", "RENT3", "CMIG4", "RADL3", "EQTL3", "TAEE11",
] as const;

/** O caminho público do logo, ou null quando o ativo não tem (aí a tela usa a inicial). */
export function caminhoDoLogo(ticker: string): string | null {
  const t = ticker.toUpperCase();
  return (ACOES_COM_LOGO as readonly string[]).includes(t) ? `/logos/${t}.svg` : null;
}
