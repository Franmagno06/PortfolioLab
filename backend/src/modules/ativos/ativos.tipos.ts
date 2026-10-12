import type { EspecieAcao, TipoFii } from "./ativos.catalogo.js";
import type { EstadoDoBloco } from "./ativos.snapshots.js";

/**
 * O formato das respostas de /ativos. Dinheiro e percentual viram `number` aqui, na fronteira
 * HTTP, como no resto da API; dentro dos services continua tudo em Decimal.
 *
 * Todo bloco que depende de uma fonte externa vem dentro de um `Bloco`, com o estado e a data
 * da leitura: a tela mostra "dados de ... da CVM" e sabe o que fazer se a fonte estava fora do ar.
 */

export type Bloco<T> = {
  estado: EstadoDoBloco;
  /** Quando a fonte foi lida, em ISO. Null se nunca foi. */
  atualizadoEm: string | null;
  dados: T | null;
};

export type PontoDePreco = { mes: string; fechamento: number };

/** O Yahoo informa data-ex e valor por cota; não informa o tipo do provento nem a data de pagamento. */
export type ProventoDoAtivo = { dataEx: string; valor: number };

export type NoticiaDoAtivo = { titulo: string; fonte: string; publicadaEm: string; url: string };

/** Em reais. A tela converte para bilhões. */
export type ResultadoTrimestral = {
  /** "2T26" */
  periodo: string;
  dataReferencia: string;
  /** Lucro atribuído aos controladores quando a empresa informa; senão, o lucro líquido. */
  lucroLiquido: number;
  /** Patrimônio líquido consolidado (inclui participação de não controladores). */
  patrimonioLiquido: number;
};

/** Em % do ativo total do fundo. As cinco partes somam 100, a menos do arredondamento. */
export type ComposicaoDoFundo = {
  imoveis: number;
  papel: number;
  cotasDeFii: number;
  liquidez: number;
  outros: number;
};

/** O que sobra do informe mensal da CVM para as páginas, guardado em asset_snapshots. */
export type InformeDoFii = {
  /** "2026-08" */
  competencia: string;
  patrimonioLiquido: number | null;
  cotistas: number | null;
  valorPatrimonialCota: number | null;
  /** Fração, como a CVM publica: 0.00075 = 0,075% do patrimônio no mês. */
  taxaAdministracaoMes: number | null;
  tipoGestao: string | null;
  composicao: ComposicaoDoFundo | null;
};

export type IndicadoresDaAcao = {
  pl: number | null;
  pvp: number | null;
  dy12m: number | null;
  roe: number | null;
  roa: number | null;
  margemLiquida: number | null;
  dividaEbitda: number | null;
};

export type AcaoResumoDto = {
  ticker: string;
  nome: string;
  setor: string;
  especie: EspecieAcao;
  preco: number | null;
  variacaoDia: number | null;
  pl: number | null;
  pvp: number | null;
  dy12m: number | null;
  roe: number | null;
};

export type FiiResumoDto = {
  ticker: string;
  nome: string;
  tipo: TipoFii;
  segmento: string;
  preco: number | null;
  variacaoDia: number | null;
  dy12m: number | null;
  pvp: number | null;
};

export type CabecalhoDoAtivoDto = {
  preco: number | null;
  variacaoDia: number | null;
  /** Data do último pregão em que o ativo negociou (AAAA-MM-DD), ou null se o Yahoo não informou. */
  fechamentoEm: string | null;
};

export type AcaoFichaDto = AcaoResumoDto &
  CabecalhoDoAtivoDto & {
    banco: boolean;
    indicadores: Bloco<IndicadoresDaAcao>;
    historico: Bloco<PontoDePreco[]>;
    proventos: Bloco<ProventoDoAtivo[]>;
    resultados: Bloco<ResultadoTrimestral[]>;
    noticias: Bloco<NoticiaDoAtivo[]>;
  };

export type IndicadoresDoFii = {
  dyMensal: number | null;
  dy12m: number | null;
  pvp: number | null;
  patrimonioLiquido: number | null;
  cotistas: number | null;
  /** Taxa efetiva anualizada, a partir do que o informe mensal registra (% do patrimônio por ano). */
  taxaAdministracao: number | null;
  gestao: string | null;
};

export type FiiFichaDto = FiiResumoDto &
  CabecalhoDoAtivoDto & {
    /** Indicadores que misturam Yahoo (preço, proventos) e o informe mensal da CVM. */
    indicadores: IndicadoresDoFii;
    /** De onde vêm os campos da CVM: o mês do informe e quando foi lido. */
    informe: { estado: EstadoDoBloco; atualizadoEm: string | null; competencia: string | null };
    composicao: Bloco<ComposicaoDoFundo>;
    historico: Bloco<PontoDePreco[]>;
    proventos: Bloco<ProventoDoAtivo[]>;
    noticias: Bloco<NoticiaDoAtivo[]>;
  };
