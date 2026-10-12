/**
 * O formato das respostas de GET /ativos/* (backend/src/modules/ativos/ativos.tipos.ts).
 * É uma cópia à mão: o front não importa código do backend. Se um campo mudar lá, o tsc daqui
 * não avisa; quem pega é ativos-tipos.test.ts, que compara os nomes dos campos com os de lá.
 *
 * Número vem como `number` ou `null`: null é "a fonte não informou", e a tela mostra "—".
 */

export type EspecieAcao = "ON" | "PN" | "Unit";
export type TipoFii = "Tijolo" | "Papel" | "Híbrido" | "FoF";

export type EstadoDoBloco = "ok" | "desatualizado" | "indisponivel";

/** Um pedaço da ficha que depende de fonte externa: a tela sabe o que dizer se ela estava fora do ar. */
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

/** Em reais. */
export type ResultadoTrimestral = {
  /** "2T26" */
  periodo: string;
  dataReferencia: string;
  lucroLiquido: number;
  patrimonioLiquido: number;
};

/** Em % do ativo total do fundo. */
export type ComposicaoDoFundo = {
  imoveis: number;
  papel: number;
  cotasDeFii: number;
  liquidez: number;
  outros: number;
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

export type AcaoResumo = {
  ticker: string;
  nome: string;
  setor: string;
  especie: EspecieAcao;
  preco: number | null;
  /** Variação do dia, em %. */
  variacaoDia: number | null;
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
  preco: number | null;
  variacaoDia: number | null;
  dy12m: number | null;
  pvp: number | null;
};

type Cabecalho = {
  preco: number | null;
  variacaoDia: number | null;
  /** Último pregão em que o ativo negociou (AAAA-MM-DD). */
  fechamentoEm: string | null;
};

export type AcaoFicha = AcaoResumo &
  Cabecalho & {
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
  /** Em reais. */
  patrimonioLiquido: number | null;
  cotistas: number | null;
  /** % ao ano sobre o patrimônio. */
  taxaAdministracao: number | null;
  gestao: string | null;
};

export type FiiFicha = FiiResumo &
  Cabecalho & {
    indicadores: IndicadoresDoFii;
    /** De onde vêm os campos da CVM: o mês do informe e quando foi lido. */
    informe: { estado: EstadoDoBloco; atualizadoEm: string | null; competencia: string | null };
    composicao: Bloco<ComposicaoDoFundo>;
    historico: Bloco<PontoDePreco[]>;
    proventos: Bloco<ProventoDoAtivo[]>;
    noticias: Bloco<NoticiaDoAtivo[]>;
  };
