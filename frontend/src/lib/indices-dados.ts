import { mesNumerico, mesPorExtenso, numero, percentual } from "./format";
import {
  acharIndice,
  acumular,
  anosAntes,
  cdiEm12Meses,
  cdiPorAno,
  DATA_FINAL,
  formatarValor,
  INDICES,
  ipcaEm12Meses,
  mesesAntes,
  mesesDoIpca,
  mudancasDaSelic,
  anosDoCdi,
  pontosPercentuais,
  recortar,
  resumir,
  valorEmOuAntes,
  variacaoComSinal,
  variacaoPct,
  type Categoria,
  type Destaque,
  type Indice,
  type Ordem,
  type PontoSerie,
  type ProvedorDeIndices,
  type Slug,
  type Trecho,
} from "./indices";
import {
  CDI_MENSAL,
  IPCA_MENSAL,
  SELIC_MENSAL,
  SERIES_DE_PONTOS,
  ULTIMO_MES_COMPLETO_DO_CDI,
  ULTIMO_MES_DO_IPCA,
} from "./indices-series";

/**
 * Os dados das páginas de índices: o provedor e tudo o que lê as séries (os números do card, os
 * textos com número das fichas). Importe só em componente de servidor: os componentes de navegador
 * recebem os números prontos, e as séries de exemplo nunca vão para o bundle do navegador.
 *
 * Para trocar o exemplo por dados reais, basta um `ProvedorDeIndices` novo em `provedorDeIndices`
 * e as séries mensais de base vindas da mesma fonte.
 */

const IPCA_12M = ipcaEm12Meses(IPCA_MENSAL);
const CDI_ANUAL = cdiPorAno(CDI_MENSAL, ULTIMO_MES_COMPLETO_DO_CDI);

const SERIE_DO_GRAFICO: Record<Slug, PontoSerie[]> = {
  selic: SELIC_MENSAL,
  ipca: IPCA_12M,
  cdi: CDI_ANUAL,
  ...SERIES_DE_PONTOS,
};


export const provedorDeExemplo: ProvedorDeIndices = {
  async listarIndices() {
    return INDICES;
  },
  async getIndice(slug) {
    return acharIndice(slug) ?? null;
  },
  async getSerie(slug, periodo) {
    const indice = acharIndice(slug);
    return indice ? recortar(SERIE_DO_GRAFICO[slug], periodo, indice.granularidade) : [];
  },
  async getMensais() {
    return { ipcaMensal: IPCA_MENSAL, cdiMensal: CDI_MENSAL, selicMensal: SELIC_MENSAL };
  },
};

/** Troque aqui quando os dados forem reais. */
export const provedorDeIndices: ProvedorDeIndices = provedorDeExemplo;


function ultimoDeCadaMes(serie: PontoSerie[]): PontoSerie[] {
  const porMes = new Map<string, PontoSerie>();
  for (const p of serie) porMes.set(p.data.slice(0, 7), p);
  return [...porMes.values()];
}

/** Os números do card da listagem (e do cabeçalho da ficha). */
export function destaqueDoIndice(indice: Indice): Destaque {
  const serie = SERIE_DO_GRAFICO[indice.slug];
  const ultimo = serie[serie.length - 1] ?? { data: DATA_FINAL, valor: 0 };

  if (indice.tipo === "pontos") {
    const haUmAno = valorEmOuAntes(serie, anosAntes(ultimo.data, 1));
    const variacao = haUmAno ? (variacaoPct(haUmAno.valor, ultimo.valor) ?? 0) : 0;
    const desdeUmAno = serie.filter((p) => p.data >= anosAntes(ultimo.data, 1));
    return {
      valor: ultimo.valor,
      valorFormatado: formatarValor(indice, ultimo.valor),
      secundario: { rotulo: "Últimos 12 meses", texto: variacaoComSinal(variacao), variacao },
      variacao12m: variacao,
      sparkline: ultimoDeCadaMes(desdeUmAno).map((p) => p.valor),
    };
  }

  if (indice.slug === "ipca") {
    const doMes = IPCA_MENSAL[IPCA_MENSAL.length - 1]?.valor ?? 0;
    const anoAntes = serie[serie.length - 13]?.valor ?? ultimo.valor;
    return {
      valor: ultimo.valor,
      valorFormatado: formatarValor(indice, ultimo.valor),
      secundario: { rotulo: "IPCA do mês", texto: percentual(doMes, 2), variacao: null },
      variacao12m: ultimo.valor - anoAntes,
      sparkline: serie.slice(-12).map((p) => p.valor),
    };
  }

  // Selic e CDI: a taxa de hoje vem da série mensal (a do CDI no gráfico é por ano)
  const mensal = indice.slug === "selic" ? SELIC_MENSAL : CDI_MENSAL;
  const hoje = mensal[mensal.length - 1]?.valor ?? 0;
  const haUmAno = mensal[mensal.length - 13]?.valor ?? hoje;
  const variacao = hoje - haUmAno;
  const secundario =
    indice.slug === "selic"
      ? { rotulo: "Em 12 meses", texto: pontosPercentuais(variacao), variacao }
      : { rotulo: "Rendeu em 12 meses", texto: percentual(cdiEm12Meses(CDI_MENSAL, ULTIMO_MES_COMPLETO_DO_CDI), 2), variacao: null };
  return {
    valor: hoje,
    valorFormatado: formatarValor(indice, hoje),
    secundario,
    variacao12m: variacao,
    sparkline: mensal.slice(-12).map((p) => p.valor),
  };
}

/** Variação de um índice de pontos em N meses, a partir do último fechamento. */
export function variacaoEmMeses(slug: Slug, quantos: number): number | null {
  const serie = SERIE_DO_GRAFICO[slug];
  const ultimo = serie[serie.length - 1];
  if (!ultimo) return null;
  const antes = valorEmOuAntes(serie, mesesAntes(ultimo.data, quantos));
  return antes ? variacaoPct(antes.valor, ultimo.valor) : null;
}


export function ordenarEFiltrar(indices: Indice[], ordem: Ordem, categoria: Categoria | null): Indice[] {
  const filtrados = categoria ? indices.filter((i) => i.categoria === categoria) : [...indices];
  if (ordem === "az") return filtrados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (ordem === "variacao") {
    return filtrados.sort((a, b) => destaqueDoIndice(b).variacao12m - destaqueDoIndice(a).variacao12m);
  }
  return filtrados.sort((a, b) => a.ordemDeBusca - b.ordemDeBusca);
}


// Textos com números das fichas de taxa. Os números saem das séries, nunca escritos à mão.

/** "Qual a Selic hoje?" e afins: um parágrafo com os números em destaque. */
export function paragrafoDeHoje(indice: Indice): Trecho[] {
  if (indice.slug === "selic") {
    const resumo = resumir(SELIC_MENSAL);
    const { valor, variacao12m } = destaqueDoIndice(indice);
    if (!resumo) return [];
    const queda = variacao12m < 0;
    return [
      "A Selic meta hoje é de ",
      { forte: `${percentual(valor, 2)} ao ano` },
      `. Em 12 meses ela ${queda ? "caiu" : variacao12m > 0 ? "subiu" : "ficou parada em"} `,
      { forte: `${numero(Math.abs(variacao12m), 2)} ponto percentual` },
      " e está ",
      { forte: pontosPercentuais(valor - resumo.maxima.valor).replace("−", "") },
      " abaixo do pico de ",
      { forte: percentual(resumo.maxima.valor, 2) },
      ", atingido em ",
      { forte: mesNumerico(resumo.maxima.data) },
      " (desde 2011). Quem decide é o Copom, que se reúne a cada cerca de 45 dias.",
    ];
  }
  if (indice.slug === "ipca") {
    const ultimoMes = IPCA_MENSAL[IPCA_MENSAL.length - 1];
    const ano = ULTIMO_MES_DO_IPCA.slice(0, 4);
    const anoAnterior = String(Number(ano) - 1);
    const doAno = acumular(IPCA_MENSAL.filter((p) => p.data.startsWith(ano)).map((p) => p.valor));
    const doAnoAnterior = acumular(IPCA_MENSAL.filter((p) => p.data.startsWith(anoAnterior)).map((p) => p.valor));
    return [
      "O IPCA acumulado nos últimos 12 meses é de ",
      { forte: percentual(destaqueDoIndice(indice).valor, 2) },
      `. Em ${mesPorExtenso(ULTIMO_MES_DO_IPCA)}, a inflação do mês foi de `,
      { forte: percentual(ultimoMes?.valor ?? 0, 2) },
      `. No ano de ${ano}, até ${mesPorExtenso(ULTIMO_MES_DO_IPCA)}, o acumulado é de `,
      { forte: percentual(doAno, 2) },
      `; em ${anoAnterior} inteiro, foi de `,
      { forte: percentual(doAnoAnterior, 2) },
      ".",
    ];
  }
  const ano = ULTIMO_MES_COMPLETO_DO_CDI.slice(0, 4);
  const anoAnterior = String(Number(ano) - 1);
  const doAno = CDI_ANUAL.find((p) => p.data === ano)?.valor ?? 0;
  const doAnoAnterior = CDI_ANUAL.find((p) => p.data === anoAnterior)?.valor ?? 0;
  return [
    "O CDI hoje é de ",
    { forte: `${percentual(destaqueDoIndice(indice).valor, 2)} ao ano` },
    `. Em ${ano}, até ${mesPorExtenso(ULTIMO_MES_COMPLETO_DO_CDI)}, o acumulado é de `,
    { forte: percentual(doAno, 2) },
    `; em ${anoAnterior} inteiro, foi de `,
    { forte: percentual(doAnoAnterior, 2) },
    ".",
  ];
}

/** "Como isso afeta o seu bolso": a taxa de hoje traduzida em reais. */
export function efeitoNoBolso(indice: Indice): string {
  const { valor } = destaqueDoIndice(indice);
  if (indice.slug === "selic") {
    return `Com a Selic em ${percentual(valor, 2)} ao ano, o Tesouro Selic e boa parte dos CDBs rendem perto disso, antes do imposto. Já financiamentos e cartão de crédito ficam mais caros.`;
  }
  if (indice.slug === "ipca") {
    const reais = (100 * (1 + valor / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return `Com a inflação em ${percentual(valor, 2)} em 12 meses, o que custava R$ 100,00 há um ano custa cerca de ${reais} hoje. Um investimento precisa render mais que isso para aumentar o seu poder de compra.`;
  }
  const reais = (1000 * (1 + valor / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `Com o CDI em ${percentual(valor, 2)} ao ano, R$ 1.000,00 num título que paga 100% do CDI viram cerca de ${reais} em um ano, antes do imposto.`;
}

/** A quarta linha do "Resumo do período" das taxas, que não depende do período escolhido. */
export function linhaFixaDoResumo(indice: Indice): { rotulo: string; texto: string } {
  if (indice.slug === "ipca") {
    const ultimo = IPCA_MENSAL[IPCA_MENSAL.length - 1];
    return { rotulo: `IPCA de ${mesPorExtenso(ULTIMO_MES_DO_IPCA)}`, texto: percentual(ultimo?.valor ?? 0, 2) };
  }
  const { secundario } = destaqueDoIndice(indice);
  return { rotulo: secundario.rotulo, texto: secundario.texto };
}


// ---------------------------------------------------------------------------------------------
// As tabelas das fichas de taxa, já formatadas, e a nota do último ponto quando ele não fechou.

export type Celula = { texto: string; variacao?: number };
export type TabelaDoIndice = {
  titulo: string;
  subtitulo: string;
  colunas: string[];
  linhas: { chave: string; celulas: Celula[] }[];
};

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function tabelaDoIndice(indice: Indice): TabelaDoIndice | null {
  if (indice.slug === "selic") {
    return {
      titulo: "Últimas mudanças da meta",
      subtitulo: "Cada linha é uma decisão do Copom que mudou a Selic meta. No ano: a diferença para a meta de dezembro.",
      colunas: ["Mês", "Nova meta", "Mudança", "No ano"],
      linhas: mudancasDaSelic(SELIC_MENSAL).map((l) => ({
        chave: l.mes,
        celulas: [
          { texto: mesNumerico(l.mes) },
          { texto: percentual(l.meta, 2) },
          { texto: pontosPercentuais(l.variacao), variacao: l.variacao },
          { texto: pontosPercentuais(l.noAno), variacao: l.noAno },
        ],
      })),
    };
  }
  if (indice.slug === "ipca") {
    const ano = ULTIMO_MES_DO_IPCA.slice(0, 4);
    return {
      titulo: `IPCA mês a mês em ${ano}`,
      subtitulo: "Cada linha é um mês, do mais recente para o mais antigo.",
      colunas: ["Mês", "No mês", `No ano de ${ano}`, "Em 12 meses"],
      linhas: mesesDoIpca(IPCA_MENSAL).map((l) => ({
        chave: l.mes,
        celulas: [
          { texto: `${mesPorExtenso(l.mes)} de ${l.mes.slice(0, 4)}` },
          { texto: percentual(l.doMes, 2) },
          { texto: percentual(l.noAno, 2) },
          { texto: percentual(l.em12Meses, 2) },
        ],
      })),
    };
  }
  if (indice.slug === "cdi") {
    return {
      titulo: "CDI ano a ano",
      subtitulo: `Cada linha é um ano. ${ULTIMO_MES_COMPLETO_DO_CDI.slice(0, 4)} vai até ${mesPorExtenso(ULTIMO_MES_COMPLETO_DO_CDI)}.`,
      colunas: ["Ano", "CDI no ano", "Diferença para o ano anterior", "R$ 1.000 viram"],
      linhas: anosDoCdi(cdiPorAno(CDI_MENSAL, ULTIMO_MES_COMPLETO_DO_CDI)).map((l) => ({
        chave: l.ano,
        celulas: [
          { texto: l.ano },
          { texto: percentual(l.noAno, 2) },
          l.diferenca === null ? { texto: "—" } : { texto: pontosPercentuais(l.diferenca), variacao: l.diferenca },
          { texto: reais(l.milViram) },
        ],
      })),
    };
  }
  return null;
}

/** O último ponto do gráfico do CDI é o ano corrente, ainda aberto: o tooltip diz até quando vai. */
export function notaDoUltimoPonto(indice: Indice): string | undefined {
  return indice.slug === "cdi" ? `até ${mesPorExtenso(ULTIMO_MES_COMPLETO_DO_CDI)}` : undefined;
}
