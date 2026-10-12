import {
  acharAcaoResumo,
  acharFiiResumo,
  type AcaoResumo,
  type FiiResumo,
} from "./ativos-catalogo";

/**
 * A ficha de cada ativo: o resumo da listagem mais o que só a ficha mostra.
 *
 * DADOS DE EXEMPLO, como em ativos-catalogo.ts. Cada bloco diz de onde virá:
 *  - historico ....... quotes.provider.ts → buscarHistoricoMensal (fechamento mensal, Yahoo)
 *  - proventos ....... quotes.provider.ts → buscarProventos. O Yahoo só informa a data-ex;
 *                      data de pagamento NÃO existe na fonte, por isso não há coluna dela.
 *  - resultados ...... reports/cvm.provider.ts → buscarDadosAcao (ITR/DFP: lucro e patrimônio)
 *  - composicao, PL,
 *    cotistas ........ reports/cvm.provider.ts → buscarDadosFii (Informe Mensal)
 *  - noticias ........ news/rss.ts (feeds Money Times e Suno) filtradas pelo ticker — hoje o
 *                      módulo não filtra por ativo
 *  - taxa de adm. e
 *    tipo de gestão .. sem fonte no backend ainda; vem do regulamento do fundo
 *  - margem, ROA,
 *    dívida/EBITDA ... indicators.service.ts (margem e ROA já existem; dívida/EBITDA não)
 */

export type PontoDePreco = { mes: string; fechamento: number };
export type Provento = { dataEx: string; tipo: "Dividendo" | "JCP" | "Rendimento"; valor: number };
export type ResultadoTrimestral = { periodo: string; lucroLiquido: number; patrimonioLiquido: number };
export type NoticiaDoAtivo = { titulo: string; fonte: string; publicadaEm: string; url?: string };
export type FaixaDaCarteira = { rotulo: string; pct: number };

export type AcaoFicha = AcaoResumo & {
  /** Banco não tem margem líquida nem dívida/EBITDA com sentido: a ficha troca por ROA. */
  banco: boolean;
  margemLiquida: number | null;
  roa: number | null;
  dividaEbitda: number | null;
  fechamentoEm: string;
  historico: PontoDePreco[];
  proventos: Provento[];
  /** Em R$ bilhões. */
  resultados: ResultadoTrimestral[];
  noticias: NoticiaDoAtivo[];
};

export type FiiFicha = FiiResumo & {
  /** Rendimento do último mês, em % da cota. */
  dyMensal: number;
  /** Em R$ bilhões. */
  patrimonioLiquido: number;
  cotistas: number;
  /** % ao ano sobre o patrimônio. */
  taxaAdministracao: number;
  gestao: "Ativa" | "Passiva";
  fechamentoEm: string;
  historico: PontoDePreco[];
  proventos: Provento[];
  composicao: FaixaDaCarteira[];
  noticias: NoticiaDoAtivo[];
};

// ---------------------------------------------------------------------------
// Geradores determinísticos: a mesma entrada dá sempre a mesma saída, então a
// tela, os testes e o E2E enxergam os mesmos números.
// ---------------------------------------------------------------------------

/** Os 12 fechamentos mensais que o gráfico mostra, do mais antigo ao mais recente. */
export const MESES_DO_GRAFICO = [
  "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
  "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
];

function semente(texto: string): number {
  let h = 2166136261;
  for (const c of texto) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sorteador(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Doze fechamentos mensais que terminam exatamente em `precoFinal`.
 * `volatilidade` é o passo máximo de um mês para o outro (0,06 = até 6%).
 */
export function gerarHistorico(ticker: string, precoFinal: number, volatilidade: number): PontoDePreco[] {
  const sorteio = sorteador(semente(ticker));
  const bruto: number[] = [1];
  for (let i = 1; i < MESES_DO_GRAFICO.length; i++) {
    const anterior = bruto[i - 1] ?? 1;
    bruto.push(anterior * (1 + (sorteio() - 0.5) * 2 * volatilidade));
  }
  const ultimo = bruto[bruto.length - 1] ?? 1;
  return MESES_DO_GRAFICO.map((mes, i) => ({
    mes,
    fechamento:
      i === MESES_DO_GRAFICO.length - 1
        ? precoFinal
        : Math.round(((bruto[i] ?? 1) / ultimo) * precoFinal * 100) / 100,
  }));
}

const arredondar = (v: number) => Math.round(v * 100) / 100;

/** Quatro pagamentos por ano, alternando dividendo e juros sobre capital próprio. */
function gerarProventosDeAcao(preco: number, dy12m: number | null): Provento[] {
  const porPagamento = Math.max(0.01, arredondar(((dy12m ?? 0) / 100) * preco / 4));
  const datas = ["2026-08-12", "2026-03-20", "2025-12-12", "2025-09-05"];
  return datas.map((dataEx, i) => ({
    dataEx,
    tipo: i % 2 === 1 ? "JCP" : "Dividendo",
    valor: arredondar(porPagamento * (1 + (i % 2 === 0 ? 0.04 : -0.04))),
  }));
}

/** Rendimento mensal, no último dia útil de cada mês. */
function gerarProventosDeFii(preco: number, dyMensal: number): Provento[] {
  const base = (dyMensal / 100) * preco;
  const datas = ["2026-09-30", "2026-08-31", "2026-07-31", "2026-06-30"];
  return datas.map((dataEx, i) => ({
    dataEx,
    tipo: "Rendimento",
    valor: arredondar(base * (1 + (i === 3 ? -0.05 : 0.0))),
  }));
}

/** Quatro trimestres com pequenas variações em torno de uma base. */
function gerarResultados(ticker: string, lucroBase: number, patrimonioBase: number): ResultadoTrimestral[] {
  const sorteio = sorteador(semente(`${ticker}-cvm`));
  const periodos = ["3T25", "4T25", "1T26", "2T26"];
  let patrimonio = patrimonioBase * 0.985;
  return periodos.map((periodo) => {
    patrimonio *= 1 + sorteio() * 0.02;
    return {
      periodo,
      lucroLiquido: Math.round(lucroBase * (0.9 + sorteio() * 0.2) * 10) / 10,
      patrimonioLiquido: Math.round(patrimonio * 10) / 10,
    };
  });
}

function gerarNoticias(nome: string, ticker: string, tipo: "empresa" | "fundo"): NoticiaDoAtivo[] {
  const curto = nome.replace(/ (ON|PN|Unit)$/, "");
  return tipo === "empresa"
    ? [
        { titulo: `${curto}: o que olhar no resultado do trimestre`, fonte: "Money Times", publicadaEm: "2026-10-07" },
        { titulo: `Como ${ticker} se compara com o setor nos últimos 12 meses`, fonte: "Suno", publicadaEm: "2026-10-05" },
        { titulo: `${curto} anuncia pagamento de proventos`, fonte: "Money Times", publicadaEm: "2026-10-03" },
      ]
    : [
        { titulo: `${ticker} mantém o rendimento mensal`, fonte: "Money Times", publicadaEm: "2026-10-08" },
        { titulo: `Fundos do segmento: o que esperar com os juros em queda`, fonte: "Suno", publicadaEm: "2026-10-06" },
        { titulo: `Gestora de ${ticker} divulga o relatório gerencial do mês`, fonte: "Money Times", publicadaEm: "2026-10-04" },
      ];
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

type ExtrasDaAcao = {
  banco?: boolean;
  margem?: number;
  roa?: number;
  dividaEbitda?: number;
  /** Lucro trimestral e patrimônio, em R$ bilhões — a base dos resultados de exemplo. */
  lucroTri: number;
  patrimonio: number;
  volatilidade: number;
};

const EXTRAS_ACOES: Record<string, ExtrasDaAcao> = {
  PETR4: { margem: 18.4, dividaEbitda: 0.9, lucroTri: 32, patrimonio: 400, volatilidade: 0.07 },
  VALE3: { margem: 21.5, dividaEbitda: 0.6, lucroTri: 7.4, patrimonio: 190, volatilidade: 0.06 },
  ITUB4: { banco: true, roa: 1.7, lucroTri: 11, patrimonio: 190, volatilidade: 0.04 },
  BBDC4: { banco: true, roa: 0.9, lucroTri: 5.6, patrimonio: 160, volatilidade: 0.05 },
  BBAS3: { banco: true, roa: 1.2, lucroTri: 7.1, patrimonio: 190, volatilidade: 0.05 },
  ABEV3: { margem: 16, dividaEbitda: -0.3, lucroTri: 3.9, patrimonio: 85, volatilidade: 0.04 },
  WEGE3: { margem: 16.9, dividaEbitda: -0.4, lucroTri: 1.6, patrimonio: 20, volatilidade: 0.06 },
  B3SA3: { margem: 33, dividaEbitda: 1.3, lucroTri: 1.2, patrimonio: 17, volatilidade: 0.06 },
  SUZB3: { margem: 24, dividaEbitda: 2.8, lucroTri: 3.3, patrimonio: 43, volatilidade: 0.07 },
  ELET3: { margem: 17.9, dividaEbitda: 2.4, lucroTri: 2.4, patrimonio: 55, volatilidade: 0.05 },
  RENT3: { margem: 8.9, dividaEbitda: 3.5, lucroTri: 0.9, patrimonio: 19, volatilidade: 0.07 },
  JBSS3: { margem: 3.1, dividaEbitda: 2.2, lucroTri: 1.8, patrimonio: 40, volatilidade: 0.06 },
  RADL3: { margem: 3.3, dividaEbitda: 0.5, lucroTri: 0.6, patrimonio: 9, volatilidade: 0.05 },
  EQTL3: { margem: 8.8, dividaEbitda: 3.2, lucroTri: 0.7, patrimonio: 14, volatilidade: 0.05 },
  TAEE11: { margem: 38, dividaEbitda: 2.6, lucroTri: 0.4, patrimonio: 5.4, volatilidade: 0.04 },
};

/** GET /ativos/acoes/:ticker — null quando o ticker não está no catálogo. */
export async function buscarAcao(ticker: string): Promise<AcaoFicha | null> {
  const resumo = acharAcaoResumo(ticker);
  const extras = resumo ? EXTRAS_ACOES[resumo.ticker] : undefined;
  if (!resumo || !extras) return null;

  return {
    ...resumo,
    banco: extras.banco ?? false,
    margemLiquida: extras.margem ?? null,
    roa: extras.roa ?? null,
    dividaEbitda: extras.dividaEbitda ?? null,
    fechamentoEm: "2026-10-09",
    historico: gerarHistorico(resumo.ticker, resumo.preco, extras.volatilidade),
    proventos: gerarProventosDeAcao(resumo.preco, resumo.dy12m),
    resultados: gerarResultados(resumo.ticker, extras.lucroTri, extras.patrimonio),
    noticias: gerarNoticias(resumo.nome, resumo.ticker, "empresa"),
  };
}

// ---------------------------------------------------------------------------
// FIIs
// ---------------------------------------------------------------------------

type ExtrasDoFii = {
  dyMensal: number;
  patrimonio: number;
  cotistas: number;
  taxa: number;
  composicao: FaixaDaCarteira[];
  volatilidade: number;
};

const COMPOSICAO_TIJOLO: FaixaDaCarteira[] = [
  { rotulo: "Imóveis (tijolo)", pct: 90 },
  { rotulo: "Renda fixa e caixa", pct: 10 },
  { rotulo: "CRI (títulos de dívida imobiliária)", pct: 0 },
  { rotulo: "Cotas de outros FIIs", pct: 0 },
];

const composicaoPapel = (cri: number): FaixaDaCarteira[] => [
  { rotulo: "CRI (títulos de dívida imobiliária)", pct: cri },
  { rotulo: "Renda fixa e caixa", pct: 100 - cri },
  { rotulo: "Cotas de outros FIIs", pct: 0 },
  { rotulo: "Imóveis (tijolo)", pct: 0 },
];

const composicaoFof = (cotas: number): FaixaDaCarteira[] => [
  { rotulo: "Cotas de outros FIIs", pct: cotas },
  { rotulo: "Renda fixa e caixa", pct: 100 - cotas },
  { rotulo: "CRI (títulos de dívida imobiliária)", pct: 0 },
  { rotulo: "Imóveis (tijolo)", pct: 0 },
];

const EXTRAS_FIIS: Record<string, ExtrasDoFii> = {
  MXRF11: {
    dyMensal: 1.0, patrimonio: 3.2, cotistas: 985_000, taxa: 0.7, volatilidade: 0.03,
    composicao: [
      { rotulo: "CRI (títulos de dívida imobiliária)", pct: 78 },
      { rotulo: "Cotas de outros FIIs", pct: 12 },
      { rotulo: "Renda fixa e caixa", pct: 10 },
      { rotulo: "Imóveis (tijolo)", pct: 0 },
    ],
  },
  HGLG11: { dyMensal: 0.7, patrimonio: 5.0, cotistas: 480_000, taxa: 0.7, volatilidade: 0.03, composicao: COMPOSICAO_TIJOLO },
  KNRI11: {
    dyMensal: 0.69, patrimonio: 4.3, cotistas: 310_000, taxa: 0.7, volatilidade: 0.03,
    composicao: [
      { rotulo: "Imóveis (tijolo)", pct: 90 },
      { rotulo: "CRI (títulos de dívida imobiliária)", pct: 6 },
      { rotulo: "Renda fixa e caixa", pct: 4 },
      { rotulo: "Cotas de outros FIIs", pct: 0 },
    ],
  },
  KNCR11: { dyMensal: 1.02, patrimonio: 5.8, cotistas: 280_000, taxa: 0.6, volatilidade: 0.02, composicao: composicaoPapel(94) },
  KNIP11: { dyMensal: 0.92, patrimonio: 3.9, cotistas: 190_000, taxa: 0.8, volatilidade: 0.03, composicao: composicaoPapel(92) },
  BTLG11: { dyMensal: 0.71, patrimonio: 4.6, cotistas: 360_000, taxa: 0.65, volatilidade: 0.03, composicao: COMPOSICAO_TIJOLO },
  XPLG11: { dyMensal: 0.69, patrimonio: 3.1, cotistas: 330_000, taxa: 0.7, volatilidade: 0.03, composicao: COMPOSICAO_TIJOLO },
  VISC11: { dyMensal: 0.72, patrimonio: 3.4, cotistas: 270_000, taxa: 0.9, volatilidade: 0.03, composicao: COMPOSICAO_TIJOLO },
  HGRE11: { dyMensal: 0.6, patrimonio: 1.9, cotistas: 90_000, taxa: 0.95, volatilidade: 0.04, composicao: COMPOSICAO_TIJOLO },
  BCFF11: { dyMensal: 0.76, patrimonio: 2.6, cotistas: 380_000, taxa: 0.9, volatilidade: 0.03, composicao: composicaoFof(96) },
  HGBS11: { dyMensal: 0.65, patrimonio: 1.2, cotistas: 150_000, taxa: 0.65, volatilidade: 0.03, composicao: COMPOSICAO_TIJOLO },
  VILG11: { dyMensal: 0.67, patrimonio: 1.5, cotistas: 70_000, taxa: 0.75, volatilidade: 0.03, composicao: COMPOSICAO_TIJOLO },
  RBRF11: { dyMensal: 0.7, patrimonio: 0.7, cotistas: 120_000, taxa: 0.84, volatilidade: 0.04, composicao: composicaoFof(94) },
  XPML11: { dyMensal: 0.68, patrimonio: 3.0, cotistas: 410_000, taxa: 0.75, volatilidade: 0.03, composicao: COMPOSICAO_TIJOLO },
  IRDM11: { dyMensal: 1.05, patrimonio: 1.3, cotistas: 130_000, taxa: 0.75, volatilidade: 0.04, composicao: composicaoPapel(91) },
};

/** GET /ativos/fiis/:ticker — null quando o ticker não está no catálogo. */
export async function buscarFii(ticker: string): Promise<FiiFicha | null> {
  const resumo = acharFiiResumo(ticker);
  const extras = resumo ? EXTRAS_FIIS[resumo.ticker] : undefined;
  if (!resumo || !extras) return null;

  return {
    ...resumo,
    dyMensal: extras.dyMensal,
    patrimonioLiquido: extras.patrimonio,
    cotistas: extras.cotistas,
    taxaAdministracao: extras.taxa,
    // Todos os fundos do catálogo são de gestão ativa; um FII de índice (raro) seria "Passiva".
    gestao: "Ativa",
    fechamentoEm: "2026-10-09",
    historico: gerarHistorico(resumo.ticker, resumo.preco, extras.volatilidade),
    proventos: gerarProventosDeFii(resumo.preco, extras.dyMensal),
    composicao: extras.composicao,
    noticias: gerarNoticias(resumo.nome, resumo.ticker, "fundo"),
  };
}
