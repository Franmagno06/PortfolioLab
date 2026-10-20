import { mesPorExtenso, percentual } from "./format";
import { ipcaEm12Meses, variacaoPct, type DadosDosIndices } from "./indices";

/**
 * Números do site público. Os do mês saem de `numerosDoMes`: ao vivo (Banco Central e Yahoo, os mesmos
 * dados das páginas de índices) quando a leitura funciona, e os números fixos de `NUMEROS_DO_MES`, com a
 * data deles, quando não. O resto do arquivo (ativo de exemplo, trilhas) é fixo e didático.
 */

/**
 * Fechamento de 2/10/2026 para Selic e índices. Selic e IPCA: Banco Central (SGS 432 e 13522). Índices: B3, via
 * Yahoo. O IPCA é o último que o IBGE divulgou (o de setembro saiu em 9/10), conferido em 15/10/2026: por isso o mês
 * de referência dele aparece à parte na página.
 */
export const NUMEROS_DO_MES = {
  rotulo: "outubro de 2026",
  mes: "outubro",
  mesAnterior: "setembro",
  fechamento: "2 de outubro",
  fechamentoCurto: "2/10",
  selic: 13.75, // % ao ano, meta do Copom
  ipca12m: 4.58, // % nos 12 meses até setembro de 2026
  ipcaReferencia: "setembro",
  ibovespa: { pontos: 192115, variacaoNoMes: 3.1 }, // % desde o fechamento de 30/09
  ifix: { pontos: 3772 },
} as const;

/** Os números do mês como a home os mostra. `aoVivo` diz se vieram dos índices reais ou do conjunto fixo. */
export type NumerosDoMes = {
  rotulo: string;
  mes: string;
  mesAnterior: string;
  fechamento: string;
  fechamentoCurto: string;
  selic: number;
  ipca12m: number;
  ipcaReferencia: string;
  /** `variacaoNoMes` é nula quando não há base confiável no mês anterior: melhor omitir que inventar. */
  ibovespa: { pontos: number; variacaoNoMes: number | null };
  ifix: { pontos: number };
  aoVivo: boolean;
  /**
   * O último ponto do Ibovespa é do próprio dia (`dados.hoje`): com o pregão aberto, o Yahoo devolve a
   * barra em andamento, e a home não pode chamá-la de fechamento. Sempre false no conjunto fixo.
   */
  intradiario: boolean;
};

const arredondar2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Os números do mês a partir de GET /indices/dados.
 *
 * Queda: com `null` ou com qualquer uma das quatro séries de que a home precisa vazia (Selic, IPCA com ao
 * menos 12 meses, Ibovespa, IFIX), devolve o conjunto fixo INTEIRO com `aoVivo: false`. Não mistura campo
 * vivo com a data do fixo: o parágrafo da home cita uma data de fechamento só. Única exceção: sem ponto
 * confiável no mês anterior (ausente ou zero), a variação do Ibovespa vira `null` e o resto segue ao vivo.
 */
export function numerosDoMes(dados: DadosDosIndices | null): NumerosDoMes {
  const fixo: NumerosDoMes = { ...NUMEROS_DO_MES, ibovespa: { ...NUMEROS_DO_MES.ibovespa }, ifix: { ...NUMEROS_DO_MES.ifix }, aoVivo: false, intradiario: false };
  if (!dados) return fixo;

  const selic = dados.selicMensal.at(-1);
  const ipca = dados.ipcaMensal.at(-1);
  const ipca12m = ipcaEm12Meses(dados.ipcaMensal).at(-1);
  const ibov = dados.pontos.ibovespa;
  const ultimoIbov = ibov.at(-1);
  const ifix = dados.pontos.ifix.at(-1);
  if (!selic || !ipca || !ipca12m || !ultimoIbov || !ifix) return fixo;

  const [ano, mm, dd] = ultimoIbov.data.split("-");
  const mesNumero = Number(mm);
  const dia = Number(dd);
  if (!ano || !mesNumero || !dia) return fixo;
  const anoMes = ultimoIbov.data.slice(0, 7);
  const mes = mesPorExtenso(anoMes);
  const anoMesAnterior = mesNumero === 1 ? `${Number(ano) - 1}-12` : `${ano}-${String(mesNumero - 1).padStart(2, "0")}`;

  const base = ibov.filter((p) => p.data.slice(0, 7) <= anoMesAnterior).at(-1);
  const variacao = base && base.data.slice(0, 7) === anoMesAnterior ? variacaoPct(base.valor, ultimoIbov.valor) : null;

  return {
    rotulo: `${mes} de ${ano}`,
    mes,
    mesAnterior: mesPorExtenso(anoMesAnterior),
    fechamento: `${dia} de ${mes}`,
    fechamentoCurto: `${dia}/${mesNumero}`,
    selic: selic.valor,
    ipca12m: ipca12m.valor,
    ipcaReferencia: mesPorExtenso(ipca.data),
    ibovespa: { pontos: ultimoIbov.valor, variacaoNoMes: variacao === null ? null : arredondar2(variacao) },
    ifix: { pontos: ifix.valor },
    aoVivo: true,
    intradiario: ultimoIbov.data === dados.hoje,
  };
}

/** Juro real pela fórmula de Fisher, em % ao ano. */
export function juroReal(selicPct: number, ipcaPct: number): number {
  return ((1 + selicPct / 100) / (1 + ipcaPct / 100) - 1) * 100;
}

/**
 * A frase do juro real na home, em três pedaços (o do meio vai em negrito). Só diz que a renda fixa
 * "rende" quando o juro real é positivo; com ele zerado ou negativo, diz que ela não cobre a inflação,
 * em vez de chamar um número negativo de régua a superar. O `+ 0` tira o "-0" do arredondamento.
 */
export function fraseDoJuroReal(selicPct: number, ipcaPct: number): { antes: string; destaque: string; depois: string } {
  const real = juroReal(selicPct, ipcaPct);
  const inteiro = Math.round(real) + 0;
  if (real > 0 && inteiro >= 1) {
    return {
      antes: "Descontada a inflação, a renda fixa rende ",
      destaque: `perto de ${percentual(inteiro, 0)} ao ano`,
      depois: ". É a régua que qualquer outro investimento precisa superar.",
    };
  }
  if (real > 0) {
    return {
      antes: "Descontada a inflação, a renda fixa rende ",
      destaque: "menos de 1% ao ano",
      depois: ": sobra pouco acima da inflação.",
    };
  }
  const umaCasa = Math.round(real * 10) / 10 + 0;
  return {
    antes: "Com esses números, a renda fixa atrelada à Selic ",
    destaque: "não cobre a inflação",
    depois: `: o juro real está em ${percentual(umaCasa, 1)} ao ano.`,
  };
}

/** TAEE11 no fechamento de 2/10/2026, Yahoo Finance, calculado como o job de indicadores calcula. */
export const ATIVO_DE_EXEMPLO = {
  ticker: "TAEE11",
  nome: "Taesa",
  descricao: "transmissão de energia elétrica",
  fechamento: "2 de outubro de 2026",
  preco: 42.85,
  variacaoNoMes: 2.49,
  pl: 9.02,
  pvp: 1.83,
  dy12m: 7.02,
  proventos12m: { porUnidade: 3.01, pagamentos: 4 },
  roe: 20.9,
} as const;

export type Criterio = {
  rotulo: string;
  campo: "roe" | "dy12m" | "pvp" | "pl";
  comparacao: "acima" | "abaixo";
  limite: number;
};

export const CRITERIOS_DE_EXEMPLO: Criterio[] = [
  { rotulo: "ROE acima de 15%", campo: "roe", comparacao: "acima", limite: 15 },
  { rotulo: "Dividend yield acima de 6%", campo: "dy12m", comparacao: "acima", limite: 6 },
  { rotulo: "P/VP abaixo de 1,5", campo: "pvp", comparacao: "abaixo", limite: 1.5 },
];

export function atende(ativo: typeof ATIVO_DE_EXEMPLO, c: Criterio): boolean {
  const v = ativo[c.campo];
  return c.comparacao === "acima" ? v > c.limite : v < c.limite;
}

export const TRILHAS = [
  { numero: 1, titulo: "Antes de investir: reserva e orçamento", aulas: 5, descricao: "Por que a reserva de emergência vem antes da primeira ação." },
  { numero: 2, titulo: "Renda fixa sem mistério", aulas: 5, descricao: "Selic, CDI, Tesouro Direto e CDB, com as contas feitas em reais." },
  { numero: 3, titulo: "Como reconhecer um ativo sólido", aulas: 6, descricao: "Lucro constante, dívida sob controle e um histórico de proventos que se sustenta." },
  { numero: 4, titulo: "Do primeiro aporte à primeira carteira", aulas: 7, descricao: "Quanto colocar em cada classe de ativo e por que a ordem importa." },
  { numero: 5, titulo: "Rebalancear sem vender", aulas: 4, descricao: "Usar cada aporte para levar a carteira de volta às metas." },
] as const;

/** A conta de demonstração que `npm run db:local` cria (backend/prisma/seed-demo.ts). */
export const CONTA_DEMO = { ativos: 16, transacoes: 27 } as const;
