/**
 * Números do site público. Todos são fixos, com data e fonte: a página
 * inicial não faz chamada nenhuma para mostrá-los. Quando os números do mês
 * passarem a vir ao vivo (BCB e Yahoo), é aqui que a troca acontece.
 */

/** Fechamento de 2/10/2026. Selic e IPCA: Banco Central (SGS 432 e 13522). Índices: B3, via Yahoo. */
export const NUMEROS_DO_MES = {
  rotulo: "outubro de 2026",
  mes: "outubro",
  mesAnterior: "setembro",
  fechamento: "2 de outubro",
  fechamentoCurto: "2/10",
  selic: 13.75, // % ao ano, meta do Copom
  ipca12m: 4.22, // % nos últimos 12 meses
  ibovespa: { pontos: 192115, variacaoNoMes: 3.1 }, // % desde o fechamento de 30/09
  ifix: { pontos: 3772 },
} as const;

/** Juro real pela fórmula de Fisher, em % ao ano. */
export function juroReal(selicPct: number, ipcaPct: number): number {
  return ((1 + selicPct / 100) / (1 + ipcaPct / 100) - 1) * 100;
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
