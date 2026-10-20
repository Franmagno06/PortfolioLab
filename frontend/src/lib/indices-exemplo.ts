/**
 * As séries de EXEMPLO das páginas de índices. Nada aqui é cotação real: são números gerados para o
 * protótipo, ancorados nos valores do Figma (o último valor, a variação em 1, 2, 5 e 10 anos e a
 * mínima do ano), para o card da listagem e a ficha mostrarem a mesma coisa.
 *
 * Determinístico de propósito: um gerador com semente fixa por índice, rodado uma vez quando o módulo
 * carrega. Sem Math.random, o servidor e o navegador produziriam números iguais, e um teste pode
 * conferir o valor exato de um tooltip.
 *
 * Com os dados reais vindo de GET /indices/dados, este arquivo fica só como fixture: os testes das
 * contas leem `DADOS_DE_EXEMPLO`, que tem o mesmo formato da resposta da API.
 */

import type { DadosDosIndices, PontoSerie } from "./indices";

/** O último dia das séries de exemplo (o "hoje" da fixture do E2E e dos testes das contas). */
export const DATA_FINAL = "2026-10-15";

/** mulberry32: pequeno, rápido e com período suficiente para alguns milhares de sorteios. */
function gerador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal padrão por Box-Muller, a partir do gerador uniforme. */
function normal(sortear: () => number) {
  const u = Math.max(sortear(), 1e-12);
  const v = sortear();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const arredondar = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;

// ---------------------------------------------------------------------------------------------
// Datas, sempre em UTC: "AAAA-MM-DD" entra e sai sem passar pelo fuso de quem roda o código.

function paraDia(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

function paraIso(dia: number): string {
  return new Date(dia * 86_400_000).toISOString().slice(0, 10);
}

/** Dias úteis (segunda a sexta) entre duas datas, inclusive. Feriados ficam de fora do exemplo. */
function diasUteis(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let d = paraDia(inicio); d <= paraDia(fim); d++) {
    const semana = new Date(d * 86_400_000).getUTCDay();
    if (semana !== 0 && semana !== 6) dias.push(paraIso(d));
  }
  return dias;
}

/** "AAAA-MM" de cada mês entre dois meses, inclusive. */
export function meses(inicio: string, fim: string): string[] {
  const lista: string[] = [];
  let [a, m] = inicio.split("-").map(Number) as [number, number];
  const [af, mf] = fim.split("-").map(Number) as [number, number];
  while (a < af || (a === af && m <= mf)) {
    lista.push(`${a}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return lista;
}

// ---------------------------------------------------------------------------------------------
// Índices de pontos: passeio aleatório diário "amarrado" nas âncoras (ponte browniana).

type Ancora = [data: string, valor: number];

/**
 * Entre duas âncoras, um passeio aleatório em log; depois, a reta que leva o fim do passeio até a
 * âncora seguinte é subtraída. O resultado oscila como um índice, mas passa exatamente por cada âncora.
 */
function serieDiaria(semente: number, volatilidade: number, ancoras: Ancora[]): PontoSerie[] {
  const sortear = gerador(semente);
  const primeira = ancoras[0];
  if (!primeira) return [];
  const pontos: PontoSerie[] = [{ data: primeira[0], valor: primeira[1] }];

  for (let i = 1; i < ancoras.length; i++) {
    const [dataA, valorA] = ancoras[i - 1] as Ancora;
    const [dataB, valorB] = ancoras[i] as Ancora;
    const dias = diasUteis(dataA, dataB).slice(1); // o primeiro já entrou como âncora anterior
    const passeio: number[] = [];
    let acumulado = 0;
    for (let d = 0; d < dias.length; d++) {
      acumulado += normal(sortear) * volatilidade;
      passeio.push(acumulado);
    }
    const desvioFinal = passeio[passeio.length - 1] ?? 0;
    const logA = Math.log(valorA);
    const logB = Math.log(valorB);
    dias.forEach((data, d) => {
      const fracao = (d + 1) / dias.length;
      const log = logA + (passeio[d] ?? 0) - fracao * desvioFinal + fracao * (logB - logA);
      pontos.push({ data, valor: d === dias.length - 1 ? valorB : arredondar(Math.exp(log)) });
    });
  }
  return pontos;
}

/** A partir do valor de hoje e das variações do protótipo, o valor de cada âncora no passado. */
function voltar(hoje: number, variacaoPct: number) {
  return arredondar(hoje / (1 + variacaoPct / 100));
}

const INICIO_DAS_SERIES = "2011-01-03";
const HA_1_ANO = "2025-10-15";
const HA_2_ANOS = "2024-10-15";
const HA_5_ANOS = "2021-10-15";
const HA_10_ANOS = "2016-10-14"; // 15/10/2016 foi um sábado
const QUEDA_DE_2020 = "2020-03-23";
const MINIMA_DE_AGOSTO = "2026-08-07";

type Pontos = {
  hoje: number;
  v1a: number;
  v2a: number;
  v5a: number;
  v10a: number;
  minimaAgosto: number;
  quedaDe2020: number;
  inicio: number;
  volatilidade: number;
  semente: number;
};

function pontosDoIndice(p: Pontos): PontoSerie[] {
  return serieDiaria(p.semente, p.volatilidade, [
    [INICIO_DAS_SERIES, p.inicio],
    [HA_10_ANOS, voltar(p.hoje, p.v10a)],
    [QUEDA_DE_2020, p.quedaDe2020],
    [HA_5_ANOS, voltar(p.hoje, p.v5a)],
    [HA_2_ANOS, voltar(p.hoje, p.v2a)],
    [HA_1_ANO, voltar(p.hoje, p.v1a)],
    [MINIMA_DE_AGOSTO, p.minimaAgosto],
    [DATA_FINAL, p.hoje],
  ]);
}

export const SERIES_DE_PONTOS = {
  ibovespa: pontosDoIndice({
    hoje: 192115, v1a: 14.2, v2a: 24.8, v5a: 77.6, v10a: 160.3,
    minimaAgosto: 166980, quedaDe2020: 63570, inicio: 69300, volatilidade: 0.013, semente: 101,
  }),
  ifix: pontosDoIndice({
    hoje: 3772, v1a: 9.6, v2a: 16.9, v5a: 38.4, v10a: 98.7,
    minimaAgosto: 3442, quedaDe2020: 2310, inicio: 1050, volatilidade: 0.005, semente: 202,
  }),
  smll: pontosDoIndice({
    hoje: 2205, v1a: 12.3, v2a: 9.8, v5a: 31.8, v10a: 64.2,
    minimaAgosto: 1963, quedaDe2020: 1150, inicio: 1400, volatilidade: 0.015, semente: 303,
  }),
  sp500: pontosDoIndice({
    hoje: 7012.6, v1a: 15.8, v2a: 29.4, v5a: 72.6, v10a: 210.4,
    minimaAgosto: 6056, quedaDe2020: 2237, inicio: 1270, volatilidade: 0.01, semente: 404,
  }),
  idiv: pontosDoIndice({
    hoje: 14120, v1a: 18.9, v2a: 31.2, v5a: 92.3, v10a: 240.5,
    minimaAgosto: 11876, quedaDe2020: 4050, inicio: 2900, volatilidade: 0.011, semente: 505,
  }),
} satisfies Record<string, PontoSerie[]>;

// ---------------------------------------------------------------------------------------------
// Selic meta: degraus. A trajetória até 2025 segue as decisões do Copom; de 2026 em diante é o
// cenário do protótipo (cortes de 0,25 até 13,75%). Valor ao fim de cada mês, em % ao ano.

/** [mês da decisão, nova meta]. A meta vale do mês da decisão até a próxima. */
const DECISOES_DA_SELIC: [string, number][] = [
  ["2010-12", 10.75],
  ["2011-01", 11.25], ["2011-03", 11.75], ["2011-04", 12.0], ["2011-06", 12.25], ["2011-07", 12.5],
  ["2011-08", 12.0], ["2011-10", 11.5], ["2011-11", 11.0],
  ["2012-01", 10.5], ["2012-03", 9.75], ["2012-04", 9.0], ["2012-05", 8.5], ["2012-07", 8.0],
  ["2012-08", 7.5], ["2012-10", 7.25],
  ["2013-04", 7.5], ["2013-05", 8.0], ["2013-07", 8.5], ["2013-08", 9.0], ["2013-10", 9.5], ["2013-11", 10.0],
  ["2014-01", 10.5], ["2014-02", 10.75], ["2014-04", 11.0], ["2014-10", 11.25], ["2014-12", 11.75],
  ["2015-01", 12.25], ["2015-03", 12.75], ["2015-04", 13.25], ["2015-06", 13.75], ["2015-07", 14.25],
  ["2016-10", 14.0], ["2016-11", 13.75],
  ["2017-01", 13.0], ["2017-02", 12.25], ["2017-04", 11.25], ["2017-05", 10.25], ["2017-07", 9.25],
  ["2017-09", 8.25], ["2017-10", 7.5], ["2017-12", 7.0],
  ["2018-02", 6.75], ["2018-03", 6.5],
  ["2019-07", 6.0], ["2019-09", 5.5], ["2019-10", 5.0], ["2019-12", 4.5],
  ["2020-02", 4.25], ["2020-03", 3.75], ["2020-05", 3.0], ["2020-06", 2.25], ["2020-08", 2.0],
  ["2021-03", 2.75], ["2021-05", 3.5], ["2021-06", 4.25], ["2021-08", 5.25], ["2021-09", 6.25],
  ["2021-10", 7.75], ["2021-12", 9.25],
  ["2022-02", 10.75], ["2022-03", 11.75], ["2022-05", 12.75], ["2022-06", 13.25], ["2022-08", 13.75],
  ["2023-08", 13.25], ["2023-09", 12.75], ["2023-11", 12.25], ["2023-12", 11.75],
  ["2024-01", 11.25], ["2024-03", 10.75], ["2024-05", 10.5], ["2024-09", 10.75], ["2024-11", 11.25],
  ["2024-12", 12.25],
  ["2025-01", 13.25], ["2025-03", 14.25], ["2025-05", 14.75], ["2025-06", 15.0],
  ["2026-04", 14.75], ["2026-05", 14.5], ["2026-07", 14.25], ["2026-08", 14.0], ["2026-09", 13.75],
];

const MES_FINAL = DATA_FINAL.slice(0, 7);

export const SELIC_MENSAL: PontoSerie[] = (() => {
  let atual = DECISOES_DA_SELIC[0]?.[1] ?? 0;
  const porMes = new Map(DECISOES_DA_SELIC);
  return meses("2011-01", MES_FINAL).map((mes) => {
    atual = porMes.get(mes) ?? atual;
    return { data: mes, valor: atual };
  });
})();

// ---------------------------------------------------------------------------------------------
// IPCA mensal (% no mês). Até 2024, cada ano fecha no IPCA anual do IBGE e os meses são sorteados
// em volta de um padrão sazonal. De junho de 2025 a setembro de 2026, os meses foram escolhidos à
// mão para reproduzir a tabela do protótipo: 4,58% em 12 meses e 0,82% em setembro de 2026.

const IPCA_ANUAL: Record<number, number> = {
  2010: 5.91, 2011: 6.5, 2012: 5.84, 2013: 5.91, 2014: 6.41, 2015: 10.67, 2016: 6.29, 2017: 2.95,
  2018: 3.75, 2019: 4.31, 2020: 4.52, 2021: 10.06, 2022: 5.79, 2023: 4.62, 2024: 4.83,
};

/** Peso de cada mês no ano: janeiro e fevereiro (escola, reajustes) costumam pesar mais. */
const SAZONALIDADE = [1.3, 1.2, 1.0, 0.9, 0.7, 0.6, 0.6, 0.5, 0.6, 0.9, 1.0, 1.2];

const IPCA_FIXO: Record<string, number> = {
  "2025-01": 0.16, "2025-02": 0.58, "2025-03": 0.42, "2025-04": 0.4, "2025-05": 0.33,
  "2025-06": 0.42, "2025-07": 0.37, "2025-08": 0.42, "2025-09": 0.47, "2025-10": 0.1,
  "2025-11": 0.18, "2025-12": 0.33,
  "2026-01": 0.33, "2026-02": 0.62, "2026-03": 0.48, "2026-04": 0.45, "2026-05": 0.44,
  "2026-06": 0.35, "2026-07": 0.18, "2026-08": 0.21, "2026-09": 0.82,
};

/** O IPCA sai no mês seguinte: em 15/10/2026 o último divulgado é o de setembro. */
const ULTIMO_MES_DO_IPCA = "2026-09";

export const IPCA_MENSAL: PontoSerie[] = (() => {
  const sortear = gerador(606);
  const serie: PontoSerie[] = [];
  for (let ano = 2010; ano <= 2024; ano++) {
    const alvo = IPCA_ANUAL[ano] ?? 4;
    // mensal médio que, composto 12 vezes, dá o anual; depois cada mês recebe o seu peso e um ruído
    const medio = ((1 + alvo / 100) ** (1 / 12) - 1) * 100;
    const brutos = SAZONALIDADE.map((peso) => medio * peso * (0.7 + sortear() * 0.6));
    const soma = brutos.reduce((a, b) => a + b, 0);
    const meses11 = brutos.slice(0, 11).map((b) => arredondar((b / soma) * medio * 12));
    // dezembro fecha a conta: o ano composto bate o IPCA anual, a menos do arredondamento
    const produto = meses11.reduce((p, m) => p * (1 + m / 100), 1);
    const dezembro = arredondar(((1 + alvo / 100) / produto - 1) * 100);
    [...meses11, dezembro].forEach((valor, i) => {
      serie.push({ data: `${ano}-${String(i + 1).padStart(2, "0")}`, valor });
    });
  }
  for (const mes of meses("2025-01", ULTIMO_MES_DO_IPCA)) {
    serie.push({ data: mes, valor: IPCA_FIXO[mes] ?? 0 });
  }
  return serie;
})();

// ---------------------------------------------------------------------------------------------
// CDI: anda colado na Selic, um décimo abaixo. Taxa em % ao ano, ao fim de cada mês (o SGS 4389).

const CDI_TAXA_MENSAL: PontoSerie[] = SELIC_MENSAL.map((p) => ({
  data: p.data,
  valor: arredondar(p.valor - 0.1),
}));

/** Dias úteis num mês, para transformar a taxa anual do exemplo em % no mês (base 252). */
const DIAS_UTEIS_NO_MES = 21;

/**
 * O rendimento de um mês, em %, para uma taxa anual base 252: 12% a.a. → 0,95% no mês. Só o exemplo
 * usa esta aproximação, para fabricar o "% no mês" do SGS 4391; os dados reais já vêm assim.
 */
export function rendimentoDoMes(taxaAnualPct: number): number {
  return ((1 + taxaAnualPct / 100) ** (DIAS_UTEIS_NO_MES / 252) - 1) * 100;
}

/**
 * As séries de exemplo no formato de GET /indices/dados. O CDI do mês (SGS 4391) sai da taxa anual
 * pela aproximação acima, e outubro de 2026 entra como o mês corrente, que as contas deixam de fora.
 */
export const DADOS_DE_EXEMPLO: DadosDosIndices = {
  atualizadoEm: `${DATA_FINAL}T21:00:00.000Z`,
  hoje: DATA_FINAL,
  selicMensal: SELIC_MENSAL,
  ipcaMensal: IPCA_MENSAL,
  cdiMensal: CDI_TAXA_MENSAL.map((p) => ({ data: p.data, valor: rendimentoDoMes(p.valor) })),
  cdiTaxaMensal: CDI_TAXA_MENSAL,
  pontos: SERIES_DE_PONTOS,
};
