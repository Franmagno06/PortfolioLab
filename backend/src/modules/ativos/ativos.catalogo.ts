/**
 * O catálogo curado das páginas de Ativos: 15 ações e 15 FIIs.
 *
 * É a fronteira de segurança das rotas públicas de /ativos: só ticker daqui
 * chega a Yahoo, CVM ou aos feeds de notícia. Qualquer outro vira 404 antes de qualquer
 * chamada externa, então ninguém consegue usar a API para consultar ativo
 * arbitrário nem para esgotar a cota dessas fontes.
 *
 * A ORDEM É FIXA E NÃO INDICA QUAL ATIVO É MELHOR: nada aqui é ranking ou
 * recomendação (Resolução CVM 20).
 *
 * O que está aqui é o que nenhuma fonte entrega de forma confiável, e foi
 * levantado à mão:
 *  - setor (o Yahoo devolve em inglês, e só para ação);
 *  - tipo e segmento do FII. O "segmento" do cadastro da CVM é o que o gestor
 *    declarou e não serve (o MXRF11 consta lá como "Logística"). O tipo foi
 *    conferido contra a composição real da carteira no informe mensal da CVM
 *    de ago/2026: papel = maioria em CRI, tijolo = maioria em imóveis, FoF =
 *    maioria em cotas de outros FIIs. O indexador de KNCR11 (CDI) e KNIP11
 *    (IPCA) vem da política dos fundos, que o informe não traz.
 *
 * O front tem uma cópia só dos tickers e nomes, para o menu e as rotas
 * estáticas (frontend/src/lib/ativos-catalogo.ts). Um teste de lá confere que
 * as duas listas não divergem.
 */

export type EspecieAcao = "ON" | "PN" | "Unit";
export type TipoFii = "Tijolo" | "Papel" | "Híbrido" | "FoF";

export type AcaoDoCatalogo = {
  ticker: string;
  nome: string;
  setor: string;
  especie: EspecieAcao;
};

export type FiiDoCatalogo = {
  ticker: string;
  nome: string;
  tipo: TipoFii;
  segmento: string;
};

export const SETOR_BANCOS = "Bancos";

export const ACOES: readonly AcaoDoCatalogo[] = [
  { ticker: "PETR4", nome: "Petrobras PN", setor: "Petróleo e gás", especie: "PN" },
  { ticker: "VALE3", nome: "Vale S.A.", setor: "Mineração", especie: "ON" },
  { ticker: "ITUB4", nome: "Itaú Unibanco PN", setor: SETOR_BANCOS, especie: "PN" },
  { ticker: "BBDC4", nome: "Bradesco PN", setor: SETOR_BANCOS, especie: "PN" },
  { ticker: "BBAS3", nome: "Banco do Brasil ON", setor: SETOR_BANCOS, especie: "ON" },
  { ticker: "ABEV3", nome: "Ambev ON", setor: "Bebidas", especie: "ON" },
  { ticker: "WEGE3", nome: "WEG ON", setor: "Bens industriais", especie: "ON" },
  { ticker: "B3SA3", nome: "B3 ON", setor: "Serviços financeiros", especie: "ON" },
  { ticker: "SUZB3", nome: "Suzano ON", setor: "Papel e celulose", especie: "ON" },
  { ticker: "AXIA3", nome: "Axia Energia (antiga Eletrobras) ON", setor: "Energia elétrica", especie: "ON" },
  { ticker: "RENT3", nome: "Localiza ON", setor: "Aluguel de carros", especie: "ON" },
  { ticker: "CMIG4", nome: "Cemig PN", setor: "Energia elétrica", especie: "PN" },
  { ticker: "RADL3", nome: "RaiaDrogasil ON", setor: "Farmácias", especie: "ON" },
  { ticker: "EQTL3", nome: "Equatorial ON", setor: "Energia elétrica", especie: "ON" },
  { ticker: "TAEE11", nome: "Taesa Unit", setor: "Transmissão de energia", especie: "Unit" },
];

export const FIIS: readonly FiiDoCatalogo[] = [
  { ticker: "MXRF11", nome: "Maxi Renda", tipo: "Papel", segmento: "Recebíveis (CRI)" },
  { ticker: "HGLG11", nome: "Pátria Log (antigo CSHG Logística)", tipo: "Tijolo", segmento: "Logística" },
  { ticker: "KNRI11", nome: "Kinea Renda Imobiliária", tipo: "Tijolo", segmento: "Lajes e logística" },
  { ticker: "KNCR11", nome: "Kinea Rendimentos Imobiliários", tipo: "Papel", segmento: "Recebíveis (CDI)" },
  { ticker: "KNIP11", nome: "Kinea Índices de Preços", tipo: "Papel", segmento: "Recebíveis (IPCA)" },
  { ticker: "BTLG11", nome: "BTG Pactual Logística", tipo: "Tijolo", segmento: "Logística" },
  { ticker: "XPLG11", nome: "XP Log", tipo: "Tijolo", segmento: "Logística" },
  { ticker: "VISC11", nome: "Vinci Shopping Centers", tipo: "Tijolo", segmento: "Shoppings" },
  { ticker: "HGRE11", nome: "Pátria Escritórios (antigo CSHG Real Estate)", tipo: "Tijolo", segmento: "Lajes corporativas" },
  { ticker: "KFOF11", nome: "Kinea Fundo de Fundos", tipo: "FoF", segmento: "Fundo de fundos" },
  { ticker: "HGBS11", nome: "Hedge Brasil Shopping", tipo: "Tijolo", segmento: "Shoppings" },
  { ticker: "VILG11", nome: "Vinci Logística", tipo: "Tijolo", segmento: "Logística" },
  { ticker: "XPSF11", nome: "XP Selection Fundo de Fundos", tipo: "FoF", segmento: "Fundo de fundos" },
  { ticker: "XPML11", nome: "XP Malls", tipo: "Tijolo", segmento: "Shoppings" },
  { ticker: "HGCR11", nome: "Pátria Recebíveis Imobiliários (antigo CSHG Recebíveis)", tipo: "Papel", segmento: "Recebíveis (CRI)" },
];

export function acharAcao(ticker: string): AcaoDoCatalogo | undefined {
  const t = ticker.toUpperCase().trim();
  return ACOES.find((a) => a.ticker === t);
}

export function acharFii(ticker: string): FiiDoCatalogo | undefined {
  const t = ticker.toUpperCase().trim();
  return FIIS.find((f) => f.ticker === t);
}

/** Banco não tem margem líquida nem dívida/EBITDA com sentido: a ficha troca por ROA. */
export function ehBanco(acao: AcaoDoCatalogo): boolean {
  return acao.setor === SETOR_BANCOS;
}

// ---------------------------------------------------------------------------
// ETFs
// ---------------------------------------------------------------------------

export type CategoriaDeEtf =
  | "Ações do Brasil"
  | "Ações do exterior"
  | "Renda fixa"
  | "Ouro"
  | "Criptoativos";

export type EtfDoCatalogo = {
  ticker: string;
  nome: string;
  categoria: CategoriaDeEtf;
  /** O índice que o fundo copia, como o regulamento o chama. */
  indice: string;
  /** CNPJ da classe de cotas, só dígitos, como o cadastro da CVM (registro_classe.csv) o publica. */
  cnpj: string;
};

/**
 * Os principais ETFs de índice, um por ideia de investimento. Poucos de propósito: o conjunto de
 * ETFs listados é pequeno e pouco conhecido, e a página não é um ranking. O CNPJ foi conferido
 * contra o cadastro de classes da CVM pelo nome do fundo (BOVA11 é a "iShares Ibovespa", e assim
 * por diante). A taxa de administração não está aqui nem em nenhuma fonte aberta confiável: fica de
 * fora, e a ficha manda conferir no regulamento.
 */
export const ETFS: readonly EtfDoCatalogo[] = [
  { ticker: "BOVA11", nome: "iShares Ibovespa", categoria: "Ações do Brasil", indice: "Ibovespa", cnpj: "10406511000161" },
  { ticker: "IVVB11", nome: "iShares S&P 500", categoria: "Ações do exterior", indice: "S&P 500", cnpj: "19909560000191" },
  { ticker: "SMAL11", nome: "iShares Small Caps", categoria: "Ações do Brasil", indice: "Índice Small Cap (SMLL)", cnpj: "10406600000108" },
  { ticker: "DIVO11", nome: "It Now IDIV", categoria: "Ações do Brasil", indice: "Índice de Dividendos (IDIV)", cnpj: "13416245000146" },
  { ticker: "B5P211", nome: "It Now IMA-B5 P2", categoria: "Renda fixa", indice: "IMA-B 5 P2", cnpj: "38354864000184" },
  { ticker: "IMAB11", nome: "It Now IMA-B", categoria: "Renda fixa", indice: "IMA-B", cnpj: "31024153000100" },
  { ticker: "FIXA11", nome: "BB ETF Renda Fixa Pré", categoria: "Renda fixa", indice: "S&P/B3 Índice Futuro de Taxas de Juros", cnpj: "26845780000164" },
  { ticker: "NASD11", nome: "Trend ETF Nasdaq 100", categoria: "Ações do exterior", indice: "Nasdaq-100", cnpj: "35578672000163" },
  { ticker: "GOLD11", nome: "Trend ETF Ouro", categoria: "Ouro", indice: "Preço do ouro (LBMA)", cnpj: "37985763000149" },
  { ticker: "HASH11", nome: "Hashdex Nasdaq Crypto", categoria: "Criptoativos", indice: "Nasdaq CME Crypto Index (NCI)", cnpj: "38314708000190" },
];

export function acharEtf(ticker: string): EtfDoCatalogo | undefined {
  const t = ticker.toUpperCase().trim();
  return ETFS.find((e) => e.ticker === t);
}
