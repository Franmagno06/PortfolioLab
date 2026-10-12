/**
 * Os tickers e nomes do catálogo, para o que precisa deles sem esperar a API: o menu do
 * cabeçalho e o teste dos logos. Os números (preço, indicadores) vêm sempre do backend.
 *
 * É uma cópia de backend/src/modules/ativos/ativos.catalogo.ts, e o teste daqui lê aquele arquivo
 * e falha se as duas listas divergirem. A ordem é fixa e NÃO indica qual ativo é melhor:
 * nada aqui é ranking ou recomendação (Resolução CVM 20).
 */

/** Quantos ativos a listagem mostra antes de "Ver todas", e quantos o menu lista. */
export const QUANTIDADE_INICIAL = 5;

export type AtivoDoCatalogo = { ticker: string; nome: string };

export const ACOES: AtivoDoCatalogo[] = [
  { ticker: "PETR4", nome: "Petrobras PN" },
  { ticker: "VALE3", nome: "Vale S.A." },
  { ticker: "ITUB4", nome: "Itaú Unibanco PN" },
  { ticker: "BBDC4", nome: "Bradesco PN" },
  { ticker: "BBAS3", nome: "Banco do Brasil ON" },
  { ticker: "ABEV3", nome: "Ambev ON" },
  { ticker: "WEGE3", nome: "WEG ON" },
  { ticker: "B3SA3", nome: "B3 ON" },
  { ticker: "SUZB3", nome: "Suzano ON" },
  { ticker: "AXIA3", nome: "Axia Energia (antiga Eletrobras) ON" },
  { ticker: "RENT3", nome: "Localiza ON" },
  { ticker: "CMIG4", nome: "Cemig PN" },
  { ticker: "RADL3", nome: "RaiaDrogasil ON" },
  { ticker: "EQTL3", nome: "Equatorial ON" },
  { ticker: "TAEE11", nome: "Taesa Unit" },
];

export const FIIS: AtivoDoCatalogo[] = [
  { ticker: "MXRF11", nome: "Maxi Renda" },
  { ticker: "HGLG11", nome: "Pátria Log (antigo CSHG Logística)" },
  { ticker: "KNRI11", nome: "Kinea Renda Imobiliária" },
  { ticker: "KNCR11", nome: "Kinea Rendimentos Imobiliários" },
  { ticker: "KNIP11", nome: "Kinea Índices de Preços" },
  { ticker: "BTLG11", nome: "BTG Pactual Logística" },
  { ticker: "XPLG11", nome: "XP Log" },
  { ticker: "VISC11", nome: "Vinci Shopping Centers" },
  { ticker: "HGRE11", nome: "Pátria Escritórios (antigo CSHG Real Estate)" },
  { ticker: "KFOF11", nome: "Kinea Fundo de Fundos" },
  { ticker: "HGBS11", nome: "Hedge Brasil Shopping" },
  { ticker: "VILG11", nome: "Vinci Logística" },
  { ticker: "XPSF11", nome: "XP Selection Fundo de Fundos" },
  { ticker: "XPML11", nome: "XP Malls" },
  { ticker: "HGCR11", nome: "Pátria Recebíveis Imobiliários (antigo CSHG Recebíveis)" },
];

/** O ticker pode vir em minúsculas na URL; o catálogo é em maiúsculas. */
export const acharAcao = (ticker: string) => ACOES.find((a) => a.ticker === ticker.toUpperCase());
export const acharEtf = (ticker: string) => ETFS.find((e) => e.ticker === ticker.toUpperCase());
export const acharFii = (ticker: string) => FIIS.find((f) => f.ticker === ticker.toUpperCase());

export const ETFS: AtivoDoCatalogo[] = [
  { ticker: "BOVA11", nome: "iShares Ibovespa" },
  { ticker: "IVVB11", nome: "iShares S&P 500" },
  { ticker: "SMAL11", nome: "iShares Small Caps" },
  { ticker: "DIVO11", nome: "It Now IDIV" },
  { ticker: "B5P211", nome: "It Now IMA-B5 P2" },
  { ticker: "IMAB11", nome: "It Now IMA-B" },
  { ticker: "FIXA11", nome: "BB ETF Renda Fixa Pré" },
  { ticker: "NASD11", nome: "Trend ETF Nasdaq 100" },
  { ticker: "GOLD11", nome: "Trend ETF Ouro" },
  { ticker: "HASH11", nome: "Hashdex Nasdaq Crypto" },
];

/** Os ativos que o menu do cabeçalho mostra como atalho. */
export const ACOES_INICIAIS = ACOES.slice(0, QUANTIDADE_INICIAL);
export const FIIS_INICIAIS = FIIS.slice(0, QUANTIDADE_INICIAL);
export const ETFS_INICIAIS = ETFS.slice(0, QUANTIDADE_INICIAL);

/** Inicial do avatar: a primeira letra do ticker. */
export function inicialDoAtivo(ticker: string): string {
  return ticker.charAt(0).toUpperCase();
}
