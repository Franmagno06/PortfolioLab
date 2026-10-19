import { dataCurta, mesNumerico, mesPorExtenso, numero, percentual } from "./format";
import {
  acharIndice,
  acumular,
  anosAntes,
  cdiEm12Meses,
  cdiPorAno,
  formatarValor,
  INDICES,
  mesesAntes,
  mesesDoIpca,
  mudancasDaSelic,
  anosDoCdi,
  pontosPercentuais,
  recortar,
  resumir,
  serieDoGrafico,
  ultimoMesCompleto,
  valorEmOuAntes,
  variacaoComSinal,
  variacaoPct,
  type Categoria,
  type DadosDosIndices,
  type Destaque,
  type Indice,
  type Ordem,
  type PontoSerie,
  type ProvedorDeIndices,
  type Slug,
  type Trecho,
} from "./indices";

/**
 * Os dados das páginas de índices: o provedor e tudo o que lê as séries (os números do card, os
 * textos com número das fichas). Importe só em componente de servidor: os componentes de navegador
 * recebem os números prontos.
 *
 * Toda conta recebe os dados (`DadosDosIndices`, o JSON de GET /indices/dados) como último parâmetro.
 * Qualquer série pode vir vazia, quando a fonte falhou: as contas devolvem "—", lista vazia ou null,
 * nunca um número inventado.
 */

/** Sem resposta da API: todas as séries vazias, e as contas devolvem "—" em vez de inventar número. */
export function dadosVazios(hoje: string = new Date().toISOString().slice(0, 10)): DadosDosIndices {
  return {
    atualizadoEm: "",
    hoje,
    selicMensal: [],
    ipcaMensal: [],
    cdiMensal: [],
    cdiTaxaMensal: [],
    pontos: { ibovespa: [], ifix: [], smll: [], sp500: [], idiv: [] },
  };
}

/**
 * O provedor das páginas: os dados vêm de GET /indices/dados (lib/indices-api.ts), lidos uma vez por
 * página e passados para cá. `null` (a API falhou) vira séries vazias.
 */
export function provedorDaApi(dados: DadosDosIndices | null): ProvedorDeIndices {
  const efetivos = dados ?? dadosVazios();
  return {
    async listarIndices() {
      return INDICES;
    },
    async getIndice(slug) {
      return acharIndice(slug) ?? null;
    },
    async getSerie(slug, periodo) {
      const indice = acharIndice(slug);
      return indice ? recortar(serieDoGrafico(slug, efetivos), periodo, indice.granularidade) : [];
    },
    async getDados() {
      return efetivos;
    },
  };
}

/** O último mês com IPCA divulgado (o IBGE publica no mês seguinte). Sem série: "". */
const ultimoMesDoIpca = (dados: DadosDosIndices) => dados.ipcaMensal[dados.ipcaMensal.length - 1]?.data ?? "";

/** O último mês fechado do CDI: o mês corrente, parcial, fica de fora. Sem série: "". */
const ultimoMesCompletoDoCdi = (dados: DadosDosIndices) => ultimoMesCompleto(dados.cdiMensal, dados.hoje);

function ultimoDeCadaMes(serie: PontoSerie[]): PontoSerie[] {
  const porMes = new Map<string, PontoSerie>();
  for (const p of serie) porMes.set(p.data.slice(0, 7), p);
  return [...porMes.values()];
}

const SEM_DADO = "—";

function destaqueVazio(rotulo: string): Destaque {
  return {
    valor: 0,
    valorFormatado: SEM_DADO,
    secundario: { rotulo, texto: SEM_DADO, variacao: null },
    variacao12m: 0,
    sparkline: [],
    semDados: true,
  };
}

/** Os números do card da listagem (e do cabeçalho da ficha). */
export function destaqueDoIndice(indice: Indice, dados: DadosDosIndices): Destaque {
  const serie = serieDoGrafico(indice.slug, dados);

  if (indice.tipo === "pontos") {
    const ultimo = serie[serie.length - 1];
    if (!ultimo) return destaqueVazio("Últimos 12 meses");
    // sem um fechamento de um ano atrás (IFIX gravado há poucos dias), não há variação de 12 meses
    const haUmAno = valorEmOuAntes(serie, anosAntes(ultimo.data, 1));
    const variacao = haUmAno ? variacaoPct(haUmAno.valor, ultimo.valor) : null;
    const desdeUmAno = serie.filter((p) => p.data >= anosAntes(ultimo.data, 1));
    return {
      valor: ultimo.valor,
      valorFormatado: formatarValor(indice, ultimo.valor),
      secundario: {
        rotulo: "Últimos 12 meses",
        texto: variacao === null ? SEM_DADO : variacaoComSinal(variacao),
        variacao,
      },
      variacao12m: variacao ?? 0,
      sparkline: ultimoDeCadaMes(desdeUmAno).map((p) => p.valor),
      semDados: false,
    };
  }

  if (indice.slug === "ipca") {
    const ultimo = serie[serie.length - 1];
    if (!ultimo) return destaqueVazio("IPCA do mês");
    const doMes = dados.ipcaMensal[dados.ipcaMensal.length - 1]?.valor;
    const anoAntes = serie[serie.length - 13]?.valor ?? ultimo.valor;
    return {
      valor: ultimo.valor,
      valorFormatado: formatarValor(indice, ultimo.valor),
      secundario: { rotulo: "IPCA do mês", texto: doMes === undefined ? SEM_DADO : percentual(doMes, 2), variacao: null },
      variacao12m: ultimo.valor - anoAntes,
      sparkline: serie.slice(-12).map((p) => p.valor),
      semDados: false,
    };
  }

  // Selic e CDI: a taxa de hoje vem da série mensal em % a.a. (a do CDI no gráfico é por ano)
  const mensal = indice.slug === "selic" ? dados.selicMensal : dados.cdiTaxaMensal;
  const rotulo = indice.slug === "selic" ? "Em 12 meses" : "Rendeu em 12 meses";
  const ultimo = mensal[mensal.length - 1];
  if (!ultimo) return destaqueVazio(rotulo);
  const hoje = ultimo.valor;
  const haUmAno = mensal[mensal.length - 13]?.valor ?? hoje;
  const variacao = hoje - haUmAno;
  let secundario: Destaque["secundario"];
  if (indice.slug === "selic") {
    secundario = { rotulo, texto: pontosPercentuais(variacao), variacao };
  } else {
    const rendeu = cdiEm12Meses(dados.cdiMensal, ultimoMesCompletoDoCdi(dados));
    secundario = { rotulo, texto: rendeu === null ? SEM_DADO : percentual(rendeu, 2), variacao: null };
  }
  return {
    valor: hoje,
    valorFormatado: formatarValor(indice, hoje),
    secundario,
    variacao12m: variacao,
    sparkline: mensal.slice(-12).map((p) => p.valor),
    semDados: false,
  };
}

/** Variação de um índice de pontos em N meses, a partir do último fechamento. Sem o ponto de N meses antes: null. */
export function variacaoEmMeses(slug: Slug, quantos: number, dados: DadosDosIndices): number | null {
  const serie = serieDoGrafico(slug, dados);
  const ultimo = serie[serie.length - 1];
  if (!ultimo) return null;
  const antes = valorEmOuAntes(serie, mesesAntes(ultimo.data, quantos));
  return antes ? variacaoPct(antes.valor, ultimo.valor) : null;
}

export function ordenarEFiltrar(indices: Indice[], ordem: Ordem, categoria: Categoria | null, dados: DadosDosIndices): Indice[] {
  const filtrados = categoria ? indices.filter((i) => i.categoria === categoria) : [...indices];
  if (ordem === "az") return filtrados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (ordem === "variacao") {
    const destaques = new Map(filtrados.map((i) => [i.slug, destaqueDoIndice(i, dados)]));
    return filtrados.sort((a, b) => {
      const da = destaques.get(a.slug) as Destaque;
      const db = destaques.get(b.slug) as Destaque;
      // índice sem dados vai para o fim; entre os outros, quem mais variou primeiro
      if (da.semDados !== db.semDados) return da.semDados ? 1 : -1;
      return db.variacao12m - da.variacao12m;
    });
  }
  return filtrados.sort((a, b) => a.ordemDeBusca - b.ordemDeBusca);
}

// Textos com números das fichas de taxa. Os números saem das séries, nunca escritos à mão.

/** "Qual a Selic hoje?" e afins: um parágrafo com os números em destaque. Sem dados: nenhum trecho. */
export function paragrafoDeHoje(indice: Indice, dados: DadosDosIndices): Trecho[] {
  if (indice.slug === "selic") {
    const resumo = resumir(dados.selicMensal);
    const { valor, variacao12m } = destaqueDoIndice(indice, dados);
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
    const destaque = destaqueDoIndice(indice, dados);
    const ultimoMes = dados.ipcaMensal[dados.ipcaMensal.length - 1];
    if (destaque.semDados || !ultimoMes) return [];
    const mes = ultimoMesDoIpca(dados);
    const ano = mes.slice(0, 4);
    const anoAnterior = String(Number(ano) - 1);
    const doAno = acumular(dados.ipcaMensal.filter((p) => p.data.startsWith(ano)).map((p) => p.valor));
    const doAnoAnterior = acumular(dados.ipcaMensal.filter((p) => p.data.startsWith(anoAnterior)).map((p) => p.valor));
    return [
      "O IPCA acumulado nos últimos 12 meses é de ",
      { forte: percentual(destaque.valor, 2) },
      `. Em ${mesPorExtenso(mes)}, a inflação do mês foi de `,
      { forte: percentual(ultimoMes.valor, 2) },
      `. No ano de ${ano}, até ${mesPorExtenso(mes)}, o acumulado é de `,
      { forte: percentual(doAno, 2) },
      `; em ${anoAnterior} inteiro, foi de `,
      { forte: percentual(doAnoAnterior, 2) },
      ".",
    ];
  }
  const destaque = destaqueDoIndice(indice, dados);
  const mes = ultimoMesCompletoDoCdi(dados);
  const porAno = cdiPorAno(dados.cdiMensal, mes);
  const ano = mes.slice(0, 4);
  const anoAnterior = String(Number(ano) - 1);
  const doAno = porAno.find((p) => p.data === ano)?.valor;
  const doAnoAnterior = porAno.find((p) => p.data === anoAnterior)?.valor;
  if (destaque.semDados || doAno === undefined) return [];
  const trechos: Trecho[] = [
    "O CDI hoje é de ",
    { forte: `${percentual(destaque.valor, 2)} ao ano` },
    `. Em ${ano}, até ${mesPorExtenso(mes)}, o acumulado é de `,
    { forte: percentual(doAno, 2) },
  ];
  if (doAnoAnterior !== undefined) trechos.push(`; em ${anoAnterior} inteiro, foi de `, { forte: percentual(doAnoAnterior, 2) });
  trechos.push(".");
  return trechos;
}

/** "Como isso afeta o seu bolso": a taxa de hoje traduzida em reais. Sem dados: "". */
export function efeitoNoBolso(indice: Indice, dados: DadosDosIndices): string {
  const { valor, semDados } = destaqueDoIndice(indice, dados);
  if (semDados) return "";
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
export function linhaFixaDoResumo(indice: Indice, dados: DadosDosIndices): { rotulo: string; texto: string } {
  if (indice.slug === "ipca") {
    const ultimo = dados.ipcaMensal[dados.ipcaMensal.length - 1];
    if (!ultimo) return { rotulo: "IPCA do mês", texto: SEM_DADO };
    return { rotulo: `IPCA de ${mesPorExtenso(ultimo.data)}`, texto: percentual(ultimo.valor, 2) };
  }
  const { secundario } = destaqueDoIndice(indice, dados);
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

/** A tabela própria de cada taxa. Sem linha nenhuma (a fonte falhou), não há tabela: null. */
export function tabelaDoIndice(indice: Indice, dados: DadosDosIndices): TabelaDoIndice | null {
  const tabela = montarTabela(indice, dados);
  return tabela && tabela.linhas.length > 0 ? tabela : null;
}

function montarTabela(indice: Indice, dados: DadosDosIndices): TabelaDoIndice | null {
  if (indice.slug === "selic") {
    return {
      titulo: "Últimas mudanças da meta",
      subtitulo: "Cada linha é uma decisão do Copom que mudou a Selic meta. No ano: a diferença para a meta de dezembro.",
      colunas: ["Mês", "Nova meta", "Mudança", "No ano"],
      linhas: mudancasDaSelic(dados.selicMensal).map((l) => ({
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
    const ano = ultimoMesDoIpca(dados).slice(0, 4);
    return {
      titulo: `IPCA mês a mês em ${ano}`,
      subtitulo: "Cada linha é um mês, do mais recente para o mais antigo.",
      colunas: ["Mês", "No mês", `No ano de ${ano}`, "Em 12 meses"],
      linhas: mesesDoIpca(dados.ipcaMensal).map((l) => ({
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
    const mes = ultimoMesCompletoDoCdi(dados);
    return {
      titulo: "CDI ano a ano",
      subtitulo: `Cada linha é um ano. ${mes.slice(0, 4)} vai até ${mesPorExtenso(mes)}.`,
      colunas: ["Ano", "CDI no ano", "Diferença para o ano anterior", "R$ 1.000 viram"],
      linhas: anosDoCdi(cdiPorAno(dados.cdiMensal, mes)).map((l) => ({
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
export function notaDoUltimoPonto(indice: Indice, dados: DadosDosIndices): string | undefined {
  if (indice.slug !== "cdi") return undefined;
  const mes = ultimoMesCompletoDoCdi(dados);
  return mes ? `até ${mesPorExtenso(mes)}` : undefined;
}

// ---------------------------------------------------------------------------------------------
// A nota de fonte e o aviso de histórico curto.

/** A série bruta de cada índice, sem as contas do gráfico: dela vem a data do "Dados até". */
function serieDaFonte(slug: Slug, dados: DadosDosIndices): PontoSerie[] {
  if (slug === "selic") return dados.selicMensal;
  if (slug === "ipca") return dados.ipcaMensal;
  if (slug === "cdi") return dados.cdiMensal;
  return dados.pontos[slug];
}

/** "dd/mm/aaaa" para ponto diário, "mm/aaaa" para ponto mensal. */
const dataDoPonto = (data: string) => (data.length > 7 ? dataCurta(data) : mesNumerico(data));

/** "Fonte: B3 (IFIX). Dados até 19/10/2026." Sem nenhum ponto, só a fonte: a data não se inventa. */
export function notaDaFonte(indice: Indice, dados: DadosDosIndices): string {
  const fonte = `Fonte: ${indice.fonte.nome} (${indice.fonte.serie}).`;
  const ultimo = serieDaFonte(indice.slug, dados).at(-1);
  return ultimo ? `${fonte} Dados até ${dataDoPonto(ultimo.data)}.` : fonte;
}

/**
 * Índice de pontos com um único ponto gravado (o primeiro dia do IFIX, SMLL e IDIV): a ficha não
 * desenha gráfico e diz desde quando o histórico existe. Sem ponto nenhum é falha da fonte, não
 * histórico curto: quem trata é o aviso de "não conseguimos buscar".
 */
export function historicoCurtoDoIndice(indice: Indice, dados: DadosDosIndices): { desde: string } | undefined {
  if (indice.tipo !== "pontos") return undefined;
  const serie = serieDoGrafico(indice.slug, dados);
  const primeiro = serie[0];
  return serie.length === 1 && primeiro ? { desde: dataCurta(primeiro.data) } : undefined;
}
