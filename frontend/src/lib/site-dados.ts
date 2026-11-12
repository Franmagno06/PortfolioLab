import { mesPorExtenso, percentual } from "./format";
import { ipcaEm12Meses, variacaoPct, type DadosDosIndices } from "./indices";

/**
 * Números do site público. Os do mês saem de `numerosDoMes`: ao vivo (Banco Central e Yahoo, os mesmos
 * dados das páginas de índices) quando a leitura funciona, e os números fixos de `NUMEROS_DO_MES`, com a
 * data deles, quando não. O resto do arquivo (a empresa fictícia do exemplo) é fixo e didático.
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
  /**
   * Só com `aoVivo: true`: quais indicadores ficaram sem dado e mostram o valor de `NUMEROS_DO_MES`. A home
   * escreve a data da referência ao lado de cada um. Ausente no conjunto fixo inteiro, que já diz a própria data.
   */
  fixos?: { selic: boolean; ipca: boolean; ifix: boolean };
};

const arredondar2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Os números do mês a partir de GET /indices/dados.
 *
 * Queda por indicador: só devolve o conjunto fixo INTEIRO (`aoVivo: false`) quando `dados` é `null` ou
 * quando a série do Ibovespa está vazia. Quando há ponto do Ibovespa, `aoVivo` é `true` e cada indicador
 * secundário (Selic, IPCA em 12 meses, IFIX) usa o dado ao vivo quando disponível ou cai individualmente
 * em `NUMEROS_DO_MES` (sinalizado em `fixos`). Sem ponto confiável no mês anterior (ausente ou zero),
 * a variação do Ibovespa vira `null`.
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
  if (!ultimoIbov) return fixo;

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
    selic: selic?.valor ?? NUMEROS_DO_MES.selic,
    ipca12m: ipca12m?.valor ?? NUMEROS_DO_MES.ipca12m,
    ipcaReferencia: ipca && ipca12m ? mesPorExtenso(ipca.data) : NUMEROS_DO_MES.ipcaReferencia,
    ibovespa: { pontos: ultimoIbov.valor, variacaoNoMes: variacao === null ? null : arredondar2(variacao) },
    ifix: { pontos: ifix?.valor ?? NUMEROS_DO_MES.ifix.pontos },
    aoVivo: true,
    intradiario: ultimoIbov.data === dados.hoje,
    fixos: { selic: !selic, ipca: !ipca || !ipca12m, ifix: !ifix },
  };
}

/** Juro real pela fórmula de Fisher, em % ao ano. */
export function juroReal(selicPct: number, ipcaPct: number): number {
  return ((1 + selicPct / 100) / (1 + ipcaPct / 100) - 1) * 100;
}

/** Alíquota de IR usada na frase do juro real: a menor da tabela regressiva da renda fixa (Lei 11.033/2004, art. 1º). */
export const IR_DA_FRASE_DO_JURO_REAL = 15;

/**
 * Juro real depois do imposto: a taxa nominal perde `irPct` do rendimento antes de descontar a inflação
 * (Fisher sobre a taxa líquida). 13,75% com 15% de IR viram 11,6875% líquidos.
 */
export function juroRealLiquido(selicPct: number, ipcaPct: number, irPct = IR_DA_FRASE_DO_JURO_REAL): number {
  return juroReal(selicPct * (1 - irPct / 100), ipcaPct);
}

/** "perto de 9%", "menos de 1%" ou "abaixo da inflação", conforme o valor. O `+ 0` tira o "-0". */
function pertoDe(real: number): string {
  const inteiro = Math.round(real) + 0;
  if (real > 0 && inteiro >= 1) return `perto de ${percentual(inteiro, 0)}`;
  if (real > 0) return "menos de 1%";
  return "abaixo da inflação";
}

/**
 * A frase do juro real, em três pedaços (o do meio vai em negrito). Fala da Selic, e não de "a renda fixa", diz
 * que o número é antes do imposto, dá o depois de 15% de IR e lembra que taxa passada não garante a futura. Não
 * chama o número de "régua a superar": é uma taxa de hoje, não uma meta. Com o juro real zerado ou negativo, diz
 * que a Selic não cobre a inflação.
 */
export function fraseDoJuroReal(selicPct: number, ipcaPct: number): { antes: string; destaque: string; depois: string } {
  const real = juroReal(selicPct, ipcaPct);
  const liquido = juroRealLiquido(selicPct, ipcaPct);
  if (real > 0) {
    const depoisDoIr = liquido > 0 ? `${pertoDe(liquido)} depois de ${IR_DA_FRASE_DO_JURO_REAL}% de IR, a menor alíquota da renda fixa` : `abaixo da inflação depois de ${IR_DA_FRASE_DO_JURO_REAL}% de IR, a menor alíquota da renda fixa`;
    return {
      antes: "Descontada a inflação, a Selic de hoje paga ",
      destaque: `${pertoDe(real)} ao ano antes do imposto`,
      depois: ` (${depoisDoIr}). Taxa passada não garante a futura.`,
    };
  }
  const umaCasa = Math.round(real * 10) / 10 + 0;
  return {
    antes: "Com esses números, a Selic ",
    destaque: "não cobre a inflação",
    depois: `: o juro real está em ${percentual(umaCasa, 1)} ao ano, antes do imposto. Taxa passada não garante a futura.`,
  };
}

/**
 * A empresa do exemplo didático da home, de /aprender/indicadores, de /aprender/como-calculamos e dos artigos
 * de indicadores. É FICTÍCIA, de propósito: um exemplo com um ativo real e critérios aplicados a ele funcionaria
 * como análise de valor mobiliário (Resolução CVM 20). Sem ticker, sem data e sem fonte de mercado.
 *
 * Os números são redondos e coerentes entre si; os por ação saem dos totais (site-dados.test.ts confere cada um):
 * - 100 milhões de ações; lucro de R$ 400 mi; patrimônio de R$ 2 bi; receita de R$ 1,6 bi;
 * - lucro por ação = 400 mi ÷ 100 mi = R$ 4,00; patrimônio por ação = 2 bi ÷ 100 mi = R$ 20,00;
 * - P/L = 40 ÷ 4 = 10; P/VP = 40 ÷ 20 = 2; ROE = 400 mi ÷ 2 bi = 20%; margem = 400 mi ÷ 1,6 bi = 25%;
 * - proventos de 12 meses = 4 × R$ 0,60 = R$ 2,40; DY = 2,40 ÷ 40 = 6%;
 * - dívida líquida de R$ 1,2 bi ÷ EBITDA de R$ 600 mi = 2,0x.
 */
export const ATIVO_DE_EXEMPLO = {
  nome: "Empresa Exemplo S.A.",
  aviso: "empresa fictícia, números ilustrativos",
  fonte: "valores ilustrativos, inventados para este exemplo",
  acoes: 100_000_000,
  lucroLiquido: 400_000_000,
  patrimonioLiquido: 2_000_000_000,
  receitaLiquida: 1_600_000_000,
  dividaLiquida: 1_200_000_000,
  ebitda: 600_000_000,
  preco: 40,
  pl: 10,
  pvp: 2,
  dy12m: 6,
  /** Proventos dos últimos 12 meses, por ação. */
  proventos12m: { porUnidade: 2.4, pagamentos: 4, valores: [0.6, 0.6, 0.6, 0.6] },
  roe: 20,
  margemLiquida: 25,
  dividaEbitda: 2 as number | null,
  /** Derivado: lucro líquido ÷ número de ações. */
  lucroPorAcao: 4,
  /** Derivado: patrimônio líquido ÷ número de ações. */
  valorPatrimonialPorAcao: 20,
} as const;

export type Criterio = {
  rotulo: string;
  campo: "roe" | "dy12m" | "pvp" | "pl";
  comparacao: "acima" | "abaixo";
  limite: number;
};

/**
 * Critérios de EXEMPLO, aplicados só à empresa fictícia, para mostrar como uma regra pessoal funciona. Não são
 * os critérios do site, nem uma faixa recomendada: cada pessoa escolhe os seus, e o site não avalia ativos.
 */
export const CRITERIOS_DE_EXEMPLO: Criterio[] = [
  { rotulo: "ROE acima de 15%", campo: "roe", comparacao: "acima", limite: 15 },
  { rotulo: "Dividend yield acima de 6%", campo: "dy12m", comparacao: "acima", limite: 6 },
  { rotulo: "P/VP abaixo de 1,5", campo: "pvp", comparacao: "abaixo", limite: 1.5 },
];

export function atende(ativo: typeof ATIVO_DE_EXEMPLO, c: Criterio): boolean {
  const v = ativo[c.campo];
  return c.comparacao === "acima" ? v > c.limite : v < c.limite;
}

/** A conta de demonstração que `npm run db:local` cria (backend/prisma/seed-demo.ts). */
export const CONTA_DEMO = { ativos: 16, transacoes: 27 } as const;
