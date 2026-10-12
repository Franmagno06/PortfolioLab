/**
 * Catálogo curado das páginas "Ativos": 15 ações e 15 FIIs.
 *
 * DADOS DE EXEMPLO. Nesta etapa nada vem do backend: os números são
 * plausíveis, mas inventados, e as telas dizem isso. O formato é o que a API
 * real devolveria, e os dois `listar*` já são assíncronos, para que a troca por
 * `api("/ativos/acoes")` não mexa na tela.
 *
 * Origem de cada campo, quando a API existir:
 *  - preco, variacaoDia ........ quotes.provider.ts → buscarCotacao (Yahoo, com atraso)
 *  - pl, pvp, dy12m, roe ....... indicators.service.ts (cache de 24h; hoje só para os
 *                                ativos da carteira — precisa valer para o catálogo)
 *  - setor ..................... AssetIndicator.industria (Yahoo); Asset.sector é nulo
 *  - tipo e segmento de FII .... não existe em nenhuma fonte do backend; tabela fixa
 *
 * A ORDEM É FIXA E NÃO INDICA QUAL ATIVO É MELHOR: nada aqui é ranking ou
 * recomendação (Resolução CVM 20). As páginas dizem isso ao leitor.
 */

/** Dia do fechamento que as cotações de exemplo representam. */
export const FECHAMENTO_DOS_DADOS = "2026-10-09";

/** Quantos ativos a listagem mostra antes de "Ver todas". */
export const QUANTIDADE_INICIAL = 5;

export type EspecieAcao = "ON" | "PN" | "Unit";
export type TipoFii = "Tijolo" | "Papel" | "Híbrido" | "FoF";

export type AcaoResumo = {
  ticker: string;
  nome: string;
  setor: string;
  especie: EspecieAcao;
  preco: number;
  /** Variação do dia, em %. */
  variacaoDia: number;
  pl: number | null;
  pvp: number | null;
  /** Dividend yield dos últimos 12 meses, em %. */
  dy12m: number | null;
  roe: number | null;
};

export type FiiResumo = {
  ticker: string;
  nome: string;
  tipo: TipoFii;
  segmento: string;
  preco: number;
  variacaoDia: number;
  /** Dividend yield dos últimos 12 meses, em %. */
  dy12m: number | null;
  pvp: number | null;
};

export const ACOES: AcaoResumo[] = [
  { ticker: "PETR4", nome: "Petrobras PN", setor: "Petróleo e gás", especie: "PN", preco: 38.12, variacaoDia: 0.8, pl: 5.4, pvp: 1.2, dy12m: 13.8, roe: 22.3 },
  { ticker: "VALE3", nome: "Vale S.A.", setor: "Mineração", especie: "ON", preco: 62.48, variacaoDia: 1.2, pl: 6.9, pvp: 1.3, dy12m: 8.4, roe: 18.2 },
  { ticker: "ITUB4", nome: "Itaú Unibanco PN", setor: "Bancos", especie: "PN", preco: 36.9, variacaoDia: 0.4, pl: 9.1, pvp: 1.9, dy12m: 6.2, roe: 21.0 },
  { ticker: "BBDC4", nome: "Bradesco PN", setor: "Bancos", especie: "PN", preco: 14.25, variacaoDia: -0.3, pl: 8.0, pvp: 0.9, dy12m: 7.8, roe: 11.5 },
  { ticker: "BBAS3", nome: "Banco do Brasil ON", setor: "Bancos", especie: "ON", preco: 24.7, variacaoDia: 0.6, pl: 4.3, pvp: 0.7, dy12m: 10.9, roe: 17.6 },
  { ticker: "ABEV3", nome: "Ambev ON", setor: "Bebidas", especie: "ON", preco: 12.8, variacaoDia: -0.5, pl: 14.2, pvp: 2.3, dy12m: 5.9, roe: 16.1 },
  { ticker: "WEGE3", nome: "WEG ON", setor: "Bens industriais", especie: "ON", preco: 41.3, variacaoDia: 0.9, pl: 27.5, pvp: 7.6, dy12m: 1.5, roe: 28.0 },
  { ticker: "B3SA3", nome: "B3 ON", setor: "Serviços financeiros", especie: "ON", preco: 11.7, variacaoDia: 0.2, pl: 13.0, pvp: 3.4, dy12m: 6.8, roe: 26.0 },
  { ticker: "SUZB3", nome: "Suzano ON", setor: "Papel e celulose", especie: "ON", preco: 52.6, variacaoDia: 1.5, pl: 6.1, pvp: 2.0, dy12m: 3.4, roe: 31.0 },
  { ticker: "ELET3", nome: "Eletrobras ON", setor: "Energia elétrica", especie: "ON", preco: 41.9, variacaoDia: -0.2, pl: 11.8, pvp: 0.9, dy12m: 4.1, roe: 7.6 },
  { ticker: "RENT3", nome: "Localiza ON", setor: "Aluguel de carros", especie: "ON", preco: 47.2, variacaoDia: -1.1, pl: 15.9, pvp: 1.9, dy12m: 2.6, roe: 12.5 },
  { ticker: "JBSS3", nome: "JBS ON", setor: "Alimentos", especie: "ON", preco: 33.4, variacaoDia: 0.7, pl: 8.5, pvp: 2.1, dy12m: 3.2, roe: 26.0 },
  { ticker: "RADL3", nome: "RaiaDrogasil ON", setor: "Farmácias", especie: "ON", preco: 24.1, variacaoDia: -0.4, pl: 33.0, pvp: 5.9, dy12m: 1.7, roe: 17.5 },
  { ticker: "EQTL3", nome: "Equatorial ON", setor: "Energia elétrica", especie: "ON", preco: 33.8, variacaoDia: 0.3, pl: 13.6, pvp: 2.0, dy12m: 4.4, roe: 15.0 },
  { ticker: "TAEE11", nome: "Taesa Unit", setor: "Transmissão de energia", especie: "Unit", preco: 42.85, variacaoDia: 0.5, pl: 9.02, pvp: 1.83, dy12m: 7.02, roe: 20.9 },
];

export const FIIS: FiiResumo[] = [
  { ticker: "MXRF11", nome: "Maxi Renda", tipo: "Papel", segmento: "Recebíveis (CRI)", preco: 9.08, variacaoDia: -0.4, dy12m: 12.1, pvp: 1.01 },
  { ticker: "HGLG11", nome: "CSHG Logística", tipo: "Tijolo", segmento: "Logística", preco: 158.4, variacaoDia: 0.2, dy12m: 8.6, pvp: 0.95 },
  { ticker: "KNRI11", nome: "Kinea Renda Imobiliária", tipo: "Híbrido", segmento: "Lajes e logística", preco: 156.2, variacaoDia: -0.1, dy12m: 8.3, pvp: 0.93 },
  { ticker: "KNCR11", nome: "Kinea Rendimentos", tipo: "Papel", segmento: "Recebíveis (CDI)", preco: 103.5, variacaoDia: 0.1, dy12m: 12.4, pvp: 1.0 },
  { ticker: "KNIP11", nome: "Kinea Índices de Preços", tipo: "Papel", segmento: "Recebíveis (IPCA)", preco: 90.3, variacaoDia: -0.2, dy12m: 11.2, pvp: 0.98 },
  { ticker: "BTLG11", nome: "BTG Pactual Logística", tipo: "Tijolo", segmento: "Logística", preco: 102.1, variacaoDia: 0.3, dy12m: 8.7, pvp: 0.96 },
  { ticker: "XPLG11", nome: "XP Log", tipo: "Tijolo", segmento: "Logística", preco: 99.8, variacaoDia: 0.1, dy12m: 8.4, pvp: 0.88 },
  { ticker: "VISC11", nome: "Vinci Shopping Centers", tipo: "Tijolo", segmento: "Shoppings", preco: 107.6, variacaoDia: -0.3, dy12m: 8.9, pvp: 0.93 },
  { ticker: "HGRE11", nome: "CSHG Real Estate", tipo: "Tijolo", segmento: "Lajes corporativas", preco: 122.3, variacaoDia: -0.6, dy12m: 7.2, pvp: 0.76 },
  { ticker: "BCFF11", nome: "BTG Pactual Fundo de Fundos", tipo: "FoF", segmento: "Fundo de fundos", preco: 70.4, variacaoDia: 0.0, dy12m: 9.4, pvp: 0.83 },
  { ticker: "HGBS11", nome: "Hedge Brasil Shopping", tipo: "Tijolo", segmento: "Shoppings", preco: 192.5, variacaoDia: -0.2, dy12m: 8.1, pvp: 0.91 },
  { ticker: "VILG11", nome: "Vinci Logística", tipo: "Tijolo", segmento: "Logística", preco: 102.9, variacaoDia: 0.2, dy12m: 8.0, pvp: 0.86 },
  { ticker: "RBRF11", nome: "RBR Alpha Fundo de Fundos", tipo: "FoF", segmento: "Fundo de fundos", preco: 62.1, variacaoDia: -0.4, dy12m: 8.8, pvp: 0.82 },
  { ticker: "XPML11", nome: "XP Malls", tipo: "Tijolo", segmento: "Shoppings", preco: 108.7, variacaoDia: 0.4, dy12m: 8.6, pvp: 0.95 },
  { ticker: "IRDM11", nome: "Iridium Recebíveis Imobiliários", tipo: "Papel", segmento: "Recebíveis (IPCA e CDI)", preco: 71.3, variacaoDia: -0.7, dy12m: 12.9, pvp: 0.85 },
];

/** Os ativos que o menu do cabeçalho e a listagem mostram primeiro. */
export const ACOES_INICIAIS = ACOES.slice(0, QUANTIDADE_INICIAL);
export const FIIS_INICIAIS = FIIS.slice(0, QUANTIDADE_INICIAL);

/** GET /ativos/acoes — a lista do catálogo, no formato da API. */
export async function listarAcoes(): Promise<AcaoResumo[]> {
  return ACOES;
}

/** GET /ativos/fiis */
export async function listarFiis(): Promise<FiiResumo[]> {
  return FIIS;
}

/** O ticker pode vir em minúsculas na URL; o catálogo é em maiúsculas. */
export function acharAcaoResumo(ticker: string): AcaoResumo | undefined {
  const t = ticker.toUpperCase();
  return ACOES.find((a) => a.ticker === t);
}

export function acharFiiResumo(ticker: string): FiiResumo | undefined {
  const t = ticker.toUpperCase();
  return FIIS.find((f) => f.ticker === t);
}

/** Inicial do avatar: a primeira letra do ticker. */
export function inicialDoAtivo(ticker: string): string {
  return ticker.charAt(0).toUpperCase();
}
