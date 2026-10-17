import { dataDiaCurta, mesNumerico, numero, percentual } from "./format";
import type { IdDaDica } from "./indicadores-explicados";
import { ROTAS } from "./navegacao";

/**
 * As páginas de índices (/ativos/indices): o catálogo dos oito índices, os textos fixos de cada
 * ficha e as contas sobre as séries.
 *
 * Este arquivo não tem dado nenhum, e por isso os gráficos (componentes de navegador) podem
 * importá-lo sem levar as séries junto. Os dados ficam em indices-dados.ts, que só roda no servidor e
 * é a única porta das páginas para eles (`provedorDeIndices`). As fontes de verdade, quando entrarem:
 *  - Banco Central, SGS: 432 (Selic meta), 13522 (IPCA em 12 meses), 433 (IPCA do mês), 4389 (CDI);
 *  - B3: Ibovespa, IFIX, SMLL e IDIV, e a composição de cada carteira;
 *  - S&P Dow Jones Indices: S&P 500.
 * As contas abaixo recebem séries e não sabem de onde elas vieram, então continuam valendo.
 */

/** Um ponto de uma série: "AAAA-MM-DD" (diária), "AAAA-MM" (mensal) ou "AAAA" (anual). */
export type PontoSerie = { data: string; valor: number };

/** O último dia das séries de exemplo: a data de "atualizado em" de todas as páginas. */
export const DATA_FINAL = "2026-10-15";

export const SLUGS = ["selic", "ipca", "cdi", "ibovespa", "ifix", "smll", "sp500", "idiv"] as const;
export type Slug = (typeof SLUGS)[number];

export type Categoria = "juros-inflacao" | "bolsa-brasil" | "exterior";
export type Tipo = "taxa" | "pontos";
export type Periodo = "6M" | "1A" | "3A" | "5A" | "10A" | "15A" | "Max";

/** Como o gráfico agrupa a série: uma barra por mês, uma por ano, ou um ponto por dia de pregão. */
export type Granularidade = "mensal" | "anual" | "diaria";

/** Um trecho de frase; `forte` sai em negrito, como os números do bloco "Qual a Selic hoje?". */
export type Trecho = string | { forte: string };

export type Link = { rotulo: string; href: string };

export type Indice = {
  slug: Slug;
  nome: string;
  codigo: string;
  categoria: Categoria;
  tipo: Tipo;
  /** "% a.a." para taxa anual, "%" para inflação, "pontos" para os índices de bolsa. */
  unidade: "% a.a." | "%" | "pontos";
  fonte: { nome: string; serie: string };
  /** Data (AAAA-MM-DD) do último dado da série. */
  atualizadoEm: string;
  /** Uma frase, para o card da listagem. */
  descricao: string;
  /** O que o índice é, em parágrafos curtos: o bloco em formato de artigo da ficha. */
  explicacao: string[];
  armadilha: string;
  veja_tambem: Link[];
  /** A etiqueta sob o nome, na ficha: o nome por extenso. */
  etiqueta: string;
  /** O rótulo do número principal: "Selic meta hoje", "Pontos". */
  rotuloDoValor: string;
  dica: IdDaDica;
  /** Ordem de "Mais buscados" (1 = o mais buscado). Fixa no exemplo. */
  ordemDeBusca: number;
  granularidade: Granularidade;
  periodos: Periodo[];
  periodoPadrao: Periodo;
  /** Título e subtítulo do bloco do gráfico. */
  grafico: { titulo: string; subtitulo: string };
  /** Slug de um artigo de /aprender, para o "Quer entender melhor?". */
  artigo: string;
  /** Só nas fichas de pontos: como o índice é montado. */
  comoFunciona?: string;
};

export const CATEGORIAS: { id: Categoria; rotulo: string }[] = [
  { id: "juros-inflacao", rotulo: "Juros e inflação" },
  { id: "bolsa-brasil", rotulo: "Bolsa brasileira" },
  { id: "exterior", rotulo: "Exterior" },
];

export const rotaDoIndice = (slug: Slug) => `${ROTAS.indices}/${slug}`;

const PERIODOS_MENSAIS: Periodo[] = ["1A", "3A", "5A", "10A", "Max"];
const PERIODOS_DE_PONTOS: Periodo[] = ["6M", "1A", "5A", "10A", "15A"];

const veja = (slug: Slug, rotulo: string): Link => ({ rotulo, href: rotaDoIndice(slug) });

export const INDICES: Indice[] = [
  {
    slug: "selic",
    nome: "Selic",
    codigo: "SELIC",
    categoria: "juros-inflacao",
    tipo: "taxa",
    unidade: "% a.a.",
    fonte: { nome: "Banco Central do Brasil", serie: "SGS 432" },
    atualizadoEm: DATA_FINAL,
    descricao: "Definida pelo Copom a cada cerca de 45 dias.",
    explicacao: [
      "Quando a Selic sobe, o crédito fica mais caro e a renda fixa passa a render mais; em geral, a bolsa perde parte do apelo. Quando cai, costuma acontecer o contrário. Por isso ela serve de termômetro para quase tudo o que se investe no Brasil.",
    ],
    armadilha:
      "Selic meta não é Selic over. A meta é a decisão do Copom; a over é a taxa que os bancos praticaram de fato. As duas costumam andar quase iguais.",
    veja_tambem: [
      veja("cdi", "CDI"),
      veja("ipca", "IPCA"),
      veja("ibovespa", "Ibovespa"),
      { rotulo: "Artigo: Selic e CDI sem mistério", href: "/aprender/selic-cdi-sem-misterio" },
    ],
    etiqueta: "Taxa básica de juros da economia",
    rotuloDoValor: "Selic meta hoje",
    dica: "selicMeta",
    ordemDeBusca: 2,
    granularidade: "mensal",
    periodos: PERIODOS_MENSAIS,
    periodoPadrao: "5A",
    grafico: { titulo: "Evolução da Selic meta", subtitulo: "Valor ao fim de cada mês, em % ao ano" },
    artigo: "selic-cdi-sem-misterio",
  },
  {
    slug: "ipca",
    nome: "IPCA",
    codigo: "IPCA",
    categoria: "juros-inflacao",
    tipo: "taxa",
    unidade: "%",
    fonte: { nome: "IBGE, via Banco Central", serie: "SGS 13522 e 433" },
    atualizadoEm: DATA_FINAL,
    descricao: "A inflação oficial do Brasil, medida pelo IBGE.",
    explicacao: [
      "O IPCA é a inflação oficial do Brasil, medida pelo IBGE. Ele mostra quanto subiram os preços de uma cesta de produtos e serviços que as famílias compram. Se a sua renda e os seus investimentos não acompanham, você perde poder de compra.",
    ],
    armadilha:
      "IPCA do mês e IPCA em 12 meses são números diferentes. Um mês alto não quer dizer inflação alta no ano: compare sempre o acumulado.",
    veja_tambem: [
      veja("selic", "Selic"),
      veja("cdi", "CDI"),
      veja("ibovespa", "Ibovespa"),
      { rotulo: "Artigo: por que o dinheiro parado perde valor", href: "/aprender/por-que-o-dinheiro-parado-perde-valor" },
    ],
    etiqueta: "Índice Nacional de Preços ao Consumidor Amplo",
    rotuloDoValor: "IPCA em 12 meses",
    dica: "ipca12m",
    ordemDeBusca: 3,
    granularidade: "mensal",
    periodos: PERIODOS_MENSAIS,
    periodoPadrao: "1A",
    grafico: {
      titulo: "IPCA acumulado em 12 meses",
      subtitulo: "O acumulado dos 12 meses anteriores, ao fim de cada mês, em %",
    },
    artigo: "por-que-o-dinheiro-parado-perde-valor",
  },
  {
    slug: "cdi",
    nome: "CDI",
    codigo: "CDI",
    categoria: "juros-inflacao",
    tipo: "taxa",
    unidade: "% a.a.",
    fonte: { nome: "B3, via Banco Central", serie: "SGS 4389" },
    atualizadoEm: DATA_FINAL,
    descricao: "A régua da renda fixa.",
    explicacao: [
      "O CDI é a taxa dos empréstimos de um dia entre bancos e anda quase colado na Selic. Por isso ele é a régua da renda fixa: CDB, LCI e LCA costumam prometer “tantos % do CDI”.",
    ],
    armadilha:
      "“100% do CDI” é o rendimento antes do imposto de renda. Num CDB, o imposto sai do ganho, e a alíquota cai com o prazo.",
    veja_tambem: [
      veja("selic", "Selic"),
      veja("ipca", "IPCA"),
      veja("ifix", "IFIX"),
      { rotulo: "Artigo: CDB, LCI, LCA e o FGC", href: "/aprender/cdb-lci-lca-e-fgc" },
    ],
    etiqueta: "Certificado de Depósito Interbancário",
    rotuloDoValor: "CDI hoje",
    dica: "cdiHoje",
    ordemDeBusca: 4,
    granularidade: "anual",
    periodos: ["3A", "5A", "10A", "15A", "Max"],
    periodoPadrao: "10A",
    grafico: { titulo: "CDI acumulado por ano", subtitulo: "Rendimento acumulado em cada ano, em %" },
    artigo: "selic-cdi-sem-misterio",
  },
  {
    slug: "ibovespa",
    nome: "Ibovespa",
    codigo: "IBOV",
    categoria: "bolsa-brasil",
    tipo: "pontos",
    unidade: "pontos",
    fonte: { nome: "B3", serie: "Ibovespa" },
    atualizadoEm: DATA_FINAL,
    descricao: "As ações mais negociadas da B3.",
    explicacao: [
      "O Ibovespa é o principal índice da bolsa brasileira. Ele funciona como uma carteira de referência com as ações mais negociadas da B3 e mostra, em pontos, se o conjunto delas está subindo ou caindo.",
    ],
    comoFunciona:
      "Cada empresa pesa de acordo com o valor das ações em circulação, com um limite para nenhuma dominar o índice. A carteira é revista a cada quatro meses. Quando se diz que “o Ibovespa subiu 1%”, quer dizer que, na média ponderada, essas ações subiram 1%.",
    armadilha:
      "Pontos não são reais: 192.115 pontos não valem R$ 192.115. O número só serve para comparar o índice com ele mesmo ao longo do tempo.",
    veja_tambem: [veja("ifix", "IFIX"), veja("smll", "Small Caps"), veja("selic", "Selic"), { rotulo: "Ações da lista", href: "/ativos/acoes" }],
    etiqueta: "Principal índice da bolsa brasileira",
    rotuloDoValor: "Pontos",
    dica: "pontosDoIndice",
    ordemDeBusca: 1,
    granularidade: "diaria",
    periodos: PERIODOS_DE_PONTOS,
    periodoPadrao: "1A",
    grafico: { titulo: "Pontos do Ibovespa", subtitulo: "Fechamento de cada dia de pregão" },
    artigo: "etfs-uma-cota-varios-ativos",
  },
  {
    slug: "ifix",
    nome: "IFIX",
    codigo: "IFIX",
    categoria: "bolsa-brasil",
    tipo: "pontos",
    unidade: "pontos",
    fonte: { nome: "B3", serie: "IFIX" },
    atualizadoEm: DATA_FINAL,
    descricao: "Os fundos imobiliários mais negociados da B3.",
    explicacao: [
      "O IFIX mede o desempenho dos fundos imobiliários mais negociados da B3. É o “Ibovespa dos FIIs”: mostra, em pontos, se o conjunto desses fundos está valorizando ou não.",
    ],
    comoFunciona:
      "Ele considera o preço das cotas e também os rendimentos que os fundos distribuem, como se fossem reinvestidos. Quando se diz que “o IFIX subiu 1%”, é a média ponderada desses fundos, com os rendimentos incluídos.",
    armadilha:
      "O IFIX inclui os rendimentos distribuídos. Para comparar com a sua carteira de FIIs, some o preço e os rendimentos que você recebeu.",
    veja_tambem: [veja("ibovespa", "Ibovespa"), veja("smll", "Small Caps"), veja("selic", "Selic"), { rotulo: "Fundos imobiliários da lista", href: "/ativos/fiis" }],
    etiqueta: "Índice de fundos imobiliários da B3",
    rotuloDoValor: "Pontos",
    dica: "pontosDoIndice",
    ordemDeBusca: 5,
    granularidade: "diaria",
    periodos: PERIODOS_DE_PONTOS,
    periodoPadrao: "1A",
    grafico: { titulo: "Pontos do IFIX", subtitulo: "Fechamento de cada dia de pregão" },
    artigo: "fiis-tijolo-ou-papel",
  },
  {
    slug: "smll",
    nome: "Small Caps",
    codigo: "SMLL",
    categoria: "bolsa-brasil",
    tipo: "pontos",
    unidade: "pontos",
    fonte: { nome: "B3", serie: "SMLL" },
    atualizadoEm: DATA_FINAL,
    descricao: "As empresas menores da bolsa.",
    explicacao: [
      "O Small Caps (SMLL) acompanha as empresas de menor valor de mercado da bolsa brasileira. Elas costumam oscilar mais que as gigantes, para cima e para baixo.",
    ],
    comoFunciona:
      "Por serem empresas menores, que dependem mais do crédito e do consumo no país, o índice tende a reagir mais ao ritmo da economia e aos juros. Por isso a Selic é uma boa companhia para ler este gráfico.",
    armadilha:
      "Pontos não são reais, e os do SMLL não se comparam com os do Ibovespa: cada índice começou de uma base diferente. Compare variações, não pontos.",
    veja_tambem: [veja("ibovespa", "Ibovespa"), veja("idiv", "Dividendos"), veja("selic", "Selic"), { rotulo: "Ações da lista", href: "/ativos/acoes" }],
    etiqueta: "Índice de small caps da B3",
    rotuloDoValor: "Pontos",
    dica: "pontosDoIndice",
    ordemDeBusca: 7,
    granularidade: "diaria",
    periodos: PERIODOS_DE_PONTOS,
    periodoPadrao: "1A",
    grafico: { titulo: "Pontos do Small Caps", subtitulo: "Fechamento de cada dia de pregão" },
    artigo: "etfs-uma-cota-varios-ativos",
  },
  {
    slug: "sp500",
    nome: "S&P 500",
    codigo: "SPX",
    categoria: "exterior",
    tipo: "pontos",
    unidade: "pontos",
    fonte: { nome: "S&P Dow Jones Indices", serie: "S&P 500" },
    atualizadoEm: DATA_FINAL,
    descricao: "500 grandes empresas dos EUA.",
    explicacao: [
      "O S&P 500 reúne cerca de 500 das maiores empresas listadas nos Estados Unidos e é a principal referência da bolsa americana. O valor é em pontos, calculado em dólares.",
    ],
    comoFunciona:
      "Ele é ponderado pelo valor de mercado das empresas: as maiores pesam mais. Para quem investe a partir do Brasil, o resultado em reais também depende da variação do dólar.",
    armadilha:
      "O S&P 500 é calculado em dólares. Se o dólar cair frente ao real, o ganho em reais é menor que a variação do índice, e o contrário também vale.",
    veja_tambem: [veja("ibovespa", "Ibovespa"), veja("selic", "Selic"), veja("cdi", "CDI"), { rotulo: "ETFs da lista", href: "/ativos/etfs" }],
    etiqueta: "As 500 maiores empresas dos EUA",
    rotuloDoValor: "Pontos",
    dica: "pontosDoIndice",
    ordemDeBusca: 6,
    granularidade: "diaria",
    periodos: PERIODOS_DE_PONTOS,
    periodoPadrao: "1A",
    grafico: { titulo: "Pontos do S&P 500", subtitulo: "Fechamento de cada dia de pregão nos EUA" },
    artigo: "etfs-uma-cota-varios-ativos",
  },
  {
    slug: "idiv",
    nome: "Dividendos",
    codigo: "IDIV",
    categoria: "bolsa-brasil",
    tipo: "pontos",
    unidade: "pontos",
    fonte: { nome: "B3", serie: "IDIV" },
    atualizadoEm: DATA_FINAL,
    descricao: "Empresas que distribuem mais proventos.",
    explicacao: [
      "O Índice de Dividendos (IDIV) acompanha as empresas da bolsa que mais distribuíram proventos aos acionistas, em relação ao preço das ações, nos últimos anos.",
    ],
    comoFunciona:
      "A carteira é revista a cada quatro meses e prioriza quem pagou dividendos e juros sobre capital próprio com regularidade. Ainda assim, provento passado não é promessa de provento futuro.",
    armadilha:
      "Dividendo alto no passado não se repete por obrigação. Uma empresa pode reduzir os pagamentos se o lucro cair, e o índice muda de carteira quando isso acontece.",
    veja_tambem: [veja("ibovespa", "Ibovespa"), veja("smll", "Small Caps"), veja("selic", "Selic"), { rotulo: "Artigo: dividend yield", href: "/aprender/dividend-yield" }],
    etiqueta: "Empresas que distribuem mais proventos",
    rotuloDoValor: "Pontos",
    dica: "pontosDoIndice",
    ordemDeBusca: 8,
    granularidade: "diaria",
    periodos: PERIODOS_DE_PONTOS,
    periodoPadrao: "1A",
    grafico: { titulo: "Pontos do IDIV", subtitulo: "Fechamento de cada dia de pregão" },
    artigo: "dividend-yield",
  },
];

/** O título do bloco em formato de artigo da ficha. */
export const PERGUNTA_DA_FICHA: Record<Slug, string> = {
  selic: "Qual a Selic hoje?",
  ipca: "Qual o IPCA hoje?",
  cdi: "Qual o CDI hoje?",
  ibovespa: "O que é o Ibovespa?",
  ifix: "O que é o IFIX?",
  smll: "O que é o Small Caps?",
  sp500: "O que é o S&P 500?",
  idiv: "O que é o IDIV?",
};

export function acharIndice(slug: string): Indice | undefined {
  return INDICES.find((i) => i.slug === slug);
}

// =============================================================================================
// Contas sobre séries. Puras: recebem a série e devolvem número, venha ela de onde vier.

/** Juros compostos de uma sequência de taxas em %: [1, 1] → 2,01. */
export function acumular(taxasPct: number[]): number {
  return (taxasPct.reduce((p, t) => p * (1 + t / 100), 1) - 1) * 100;
}

/** Variação percentual entre dois valores. Base zero não tem variação definida. */
export function variacaoPct(inicio: number, fim: number): number | null {
  return inicio === 0 ? null : (fim / inicio - 1) * 100;
}

/** "AAAA-MM-DD" menos N anos, no mesmo dia do mês. */
export function anosAntes(data: string, anos: number): string {
  return `${Number(data.slice(0, 4)) - anos}${data.slice(4)}`;
}

/** "AAAA-MM-DD" menos N meses, no mesmo dia (sem passar do último dia do mês). */
export function mesesAntes(data: string, quantos: number): string {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7)) - quantos;
  const novoAno = ano + Math.floor((mes - 1) / 12);
  const novoMes = ((((mes - 1) % 12) + 12) % 12) + 1;
  const ultimoDia = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
  const dia = Math.min(Number(data.slice(8, 10)), ultimoDia);
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** O último ponto na data ou antes dela: o fechamento que valia naquele dia. */
export function valorEmOuAntes(serie: PontoSerie[], data: string): PontoSerie | undefined {
  let achado: PontoSerie | undefined;
  for (const p of serie) {
    if (p.data > data) break;
    achado = p;
  }
  return achado;
}

const MESES_DO_PERIODO: Record<Periodo, number | null> = {
  "6M": 6, "1A": 12, "3A": 36, "5A": 60, "10A": 120, "15A": 180, Max: null,
};

/**
 * O pedaço da série que o período mostra. Mensal: os últimos N meses. Anual: os últimos N anos (o ano
 * corrente conta). Diária: os pregões desde a mesma data, N meses antes do último dado.
 */
export function recortar(serie: PontoSerie[], periodo: Periodo, granularidade: Granularidade): PontoSerie[] {
  const meses = MESES_DO_PERIODO[periodo];
  const ultimo = serie[serie.length - 1];
  if (meses === null || !ultimo) return serie;
  if (granularidade === "mensal") return serie.slice(-meses);
  if (granularidade === "anual") return serie.slice(-Math.max(1, Math.round(meses / 12)));
  const desde = mesesAntes(ultimo.data, meses);
  return serie.filter((p) => p.data >= desde);
}

/**
 * Poucos pontos para desenhar, muitos para ler: acima de `maximo`, fica um ponto a cada tantos, e o
 * último sempre entra. A tabela "ver dados" e o resumo usam a série inteira; só o desenho é reduzido.
 */
export function reduzirParaGrafico(serie: PontoSerie[], maximo = 400): PontoSerie[] {
  if (serie.length <= maximo) return serie;
  const passo = Math.ceil(serie.length / maximo);
  const reduzida = serie.filter((_, i) => i % passo === 0);
  const ultimo = serie[serie.length - 1];
  if (ultimo && reduzida[reduzida.length - 1] !== ultimo) reduzida.push(ultimo);
  return reduzida;
}

export type ResumoDoPeriodo = {
  hoje: PontoSerie;
  maxima: PontoSerie;
  minima: PontoSerie;
  media: number;
  /** Do primeiro ao último ponto do período, em % (só faz sentido para pontos). */
  variacao: number | null;
};

/** Máxima e mínima ficam com a PRIMEIRA vez que o valor apareceu: "15,00%, atingido em 06/2025". */
export function resumir(serie: PontoSerie[]): ResumoDoPeriodo | null {
  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  if (!primeiro || !ultimo) return null;
  let maxima = primeiro;
  let minima = primeiro;
  let soma = 0;
  for (const p of serie) {
    if (p.valor > maxima.valor) maxima = p;
    if (p.valor < minima.valor) minima = p;
    soma += p.valor;
  }
  return { hoje: ultimo, maxima, minima, media: soma / serie.length, variacao: variacaoPct(primeiro.valor, ultimo.valor) };
}

// =============================================================================================
// As séries de cada índice, já na forma que o gráfico mostra.

/** IPCA acumulado em 12 meses, mês a mês (SGS 13522), composto a partir do IPCA mensal (SGS 433). */
export function ipcaEm12Meses(mensal: PontoSerie[]): PontoSerie[] {
  return mensal.slice(11).map((p, i) => ({
    data: p.data,
    valor: arredondar2(acumular(mensal.slice(i, i + 12).map((m) => m.valor))),
  }));
}

/** CDI acumulado em cada ano, somando os rendimentos dos meses completos. O ano corrente vai até o último mês fechado. */
export function cdiPorAno(mensal: PontoSerie[], ultimoMesCompleto: string): PontoSerie[] {
  const porAno = new Map<string, number[]>();
  for (const p of mensal) {
    if (p.data > ultimoMesCompleto) continue;
    const ano = p.data.slice(0, 4);
    porAno.set(ano, [...(porAno.get(ano) ?? []), rendimentoDoMes(p.valor)]);
  }
  return [...porAno].map(([ano, rendimentos]) => ({ data: ano, valor: arredondar2(acumular(rendimentos)) }));
}

/** CDI acumulado nos 12 últimos meses completos. */
export function cdiEm12Meses(mensal: PontoSerie[], ultimoMesCompleto: string): number {
  const fechados = mensal.filter((p) => p.data <= ultimoMesCompleto).slice(-12);
  return arredondar2(acumular(fechados.map((p) => rendimentoDoMes(p.valor))));
}

function arredondar2(v: number) {
  return Math.round(v * 100) / 100;
}

// =============================================================================================
// Eixos e rótulos dos gráficos.

/** Como cada período aparece no seletor e numa frase. */
export const ROTULO_DO_PERIODO: Record<Periodo, { botao: string; frase: string }> = {
  "6M": { botao: "6M", frase: "6 meses" },
  "1A": { botao: "1A", frase: "1 ano" },
  "3A": { botao: "3A", frase: "3 anos" },
  "5A": { botao: "5A", frase: "5 anos" },
  "10A": { botao: "10A", frase: "10 anos" },
  "15A": { botao: "15A", frase: "15 anos" },
  Max: { botao: "Máx", frase: "todo o histórico" },
};

/** A data de um ponto como o eixo e o tooltip a mostram: "10/09/26", "01/2025" ou "2023". */
export function formatarData(data: string, granularidade: Granularidade): string {
  if (granularidade === "diaria") return dataDiaCurta(data);
  if (granularidade === "mensal") return mesNumerico(data);
  return data;
}

/**
 * As datas que ganham rótulo no eixo horizontal: no máximo umas sete, para não se sobreporem.
 * Mensal: de 2 em 2 meses até um ano, depois janeiro e julho, depois só janeiro de alguns anos.
 * Anual: todos os anos. Diária: seis datas espaçadas por igual, com a primeira e a última.
 */
export function marcasDoEixoX(serie: PontoSerie[], granularidade: Granularidade): string[] {
  const datas = serie.map((p) => p.data);
  if (granularidade === "anual" || datas.length <= 7) return datas;
  if (granularidade === "diaria") {
    const marcas = Array.from({ length: 6 }, (_, i) => datas[Math.round((i * (datas.length - 1)) / 5)]);
    return [...new Set(marcas.filter((d): d is string => d !== undefined))];
  }
  if (datas.length <= 12) return datas.filter((_, i) => (datas.length - 1 - i) % 2 === 0);
  if (datas.length <= 36) return datas.filter((d) => d.endsWith("-01") || d.endsWith("-07"));
  const janeiros = datas.filter((d) => d.endsWith("-01"));
  const passo = Math.ceil(janeiros.length / 7);
  return janeiros.filter((_, i) => (janeiros.length - 1 - i) % passo === 0);
}

/** Dias úteis num mês, para transformar a taxa anual em rendimento do mês (base 252). */
const DIAS_UTEIS_NO_MES = 21;

/** O rendimento de um mês, em %, para uma taxa anual base 252: 12% a.a. → 0,95% no mês. */
export function rendimentoDoMes(taxaAnualPct: number): number {
  return ((1 + taxaAnualPct / 100) ** (DIAS_UTEIS_NO_MES / 252) - 1) * 100;
}

// =============================================================================================
// O provedor: a única porta pela qual as páginas pegam dados. Assíncrono já agora, para a troca
// por uma API não mudar nenhuma página.

export type DadosMensais = { ipcaMensal: PontoSerie[]; cdiMensal: PontoSerie[]; selicMensal: PontoSerie[] };

export interface ProvedorDeIndices {
  listarIndices(): Promise<Indice[]>;
  getIndice(slug: string): Promise<Indice | null>;
  /** A série que o gráfico do índice mostra, recortada no período. */
  getSerie(slug: Slug, periodo: Periodo): Promise<PontoSerie[]>;
  /** As séries mensais de base, que algumas contas precisam além da série do gráfico. */
  getMensais(): Promise<DadosMensais>;
}

export const AVISO_DE_EXEMPLO =
  "Dados de exemplo, gerados para esta versão do site: não são as cotações nem as taxas reais.";

// =============================================================================================
// O que cada card e cada ficha mostram. Card e ficha leem destas funções, para nunca divergirem.

/** Valor de uma taxa ou de um índice no formato da unidade: "13,75% a.a.", "4,58%", "192.115". */
export function formatarValor(indice: Indice, valor: number, casas?: number): string {
  if (indice.unidade === "% a.a.") return `${percentual(valor, 2)} a.a.`;
  if (indice.unidade === "%") return percentual(valor, 2);
  return numero(valor, casas ?? (indice.slug === "sp500" ? 2 : 0));
}

/** Diferença entre duas taxas, em pontos percentuais e com sinal: "−1,25 p.p.". */
export function pontosPercentuais(diferenca: number): string {
  const sinal = diferenca > 0 ? "+" : diferenca < 0 ? "−" : "";
  return `${sinal}${numero(Math.abs(diferenca), 2)} p.p.`;
}

/** Variação em %, com sinal: "+14,2%", "−3,4%". */
export function variacaoComSinal(v: number, casas = 1): string {
  const sinal = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sinal}${numero(Math.abs(v), casas)}%`;
}

export type Destaque = {
  valor: number;
  valorFormatado: string;
  /** A segunda linha do card: variação em 12 meses, ou o número que o índice traz junto. */
  secundario: { rotulo: string; texto: string; variacao: number | null };
  /** Para a ordem "Maior variação 12m": % nos pontos, p.p. nas taxas. */
  variacao12m: number;
  /** Os últimos 12 meses, um valor por mês, para o minigráfico. */
  sparkline: number[];
};

// ---------------------------------------------------------------------------------------------
// Ordem e filtro da listagem.

export type Ordem = "buscados" | "az" | "variacao";
export const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: "buscados", rotulo: "Mais buscados" },
  { id: "az", rotulo: "A–Z" },
  { id: "variacao", rotulo: "Maior variação 12m" },
];

export function lerOrdem(valor: string | string[] | undefined): Ordem {
  return ORDENS.some((o) => o.id === valor) ? (valor as Ordem) : "buscados";
}

export function lerCategoria(valor: string | string[] | undefined): Categoria | null {
  return CATEGORIAS.some((c) => c.id === valor) ? (valor as Categoria) : null;
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------
// As tabelas das fichas de taxa.

export type LinhaDaSelic = { mes: string; meta: number; variacao: number; noAno: number };

/** Cada mês em que a meta mudou, do mais recente para o mais antigo, com o acumulado no ano. */
export function mudancasDaSelic(mensal: PontoSerie[], quantas = 6): LinhaDaSelic[] {
  const linhas: LinhaDaSelic[] = [];
  for (let i = 1; i < mensal.length; i++) {
    const atual = mensal[i] as PontoSerie;
    const anterior = mensal[i - 1] as PontoSerie;
    if (atual.valor === anterior.valor) continue;
    const dezembroAnterior = valorEmOuAntes(mensal, `${Number(atual.data.slice(0, 4)) - 1}-12`);
    linhas.push({
      mes: atual.data,
      meta: atual.valor,
      variacao: atual.valor - anterior.valor,
      noAno: atual.valor - (dezembroAnterior?.valor ?? anterior.valor),
    });
  }
  return linhas.reverse().slice(0, quantas);
}

export type LinhaDoIpca = { mes: string; doMes: number; noAno: number; em12Meses: number };

/** Os meses do último ano com IPCA divulgado, do mais recente para o mais antigo. */
export function mesesDoIpca(mensal: PontoSerie[]): LinhaDoIpca[] {
  const em12 = ipcaEm12Meses(mensal);
  const ultimo = mensal[mensal.length - 1];
  if (!ultimo) return [];
  const ano = ultimo.data.slice(0, 4);
  return mensal
    .filter((p) => p.data.startsWith(ano))
    .map((p) => ({
      mes: p.data,
      doMes: p.valor,
      noAno: acumular(mensal.filter((m) => m.data.startsWith(ano) && m.data <= p.data).map((m) => m.valor)),
      em12Meses: em12.find((m) => m.data === p.data)?.valor ?? 0,
    }))
    .reverse();
}

export type LinhaDoCdi = { ano: string; noAno: number; diferenca: number | null; milViram: number };

/** O CDI de cada ano, do mais recente, com a diferença para o ano anterior e R$ 1.000 aplicados no ano. */
export function anosDoCdi(porAno: PontoSerie[], quantos = 5): LinhaDoCdi[] {
  return porAno
    .map((p, i) => {
      const anterior = porAno[i - 1];
      return {
        ano: p.data,
        noAno: p.valor,
        diferenca: anterior ? p.valor - anterior.valor : null,
        milViram: 1000 * (1 + p.valor / 100),
      };
    })
    .reverse()
    .slice(0, quantos);
}

