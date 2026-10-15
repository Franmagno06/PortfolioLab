import { slugify } from "@/lib/aprender/texto";
import type { SLUGS_PLANEJADOS } from "@/lib/aprender/tipos";

/**
 * Os verbetes do glossário. Cada um tem a definição em uma frase e, quando há, para onde ir para
 * aprender mais: um artigo (`artigo`, só aparece o link se o artigo já foi publicado) ou uma página
 * de consulta (`consulta`).
 *
 * Duas regras de escrita: o verbete diz o que o termo SIGNIFICA, nunca se algo é bom ou ruim para
 * investir (Resolução CVM 20); e número que muda (taxa, limite, alíquota) não entra aqui, mas no
 * artigo, onde cada um leva fonte e data.
 *
 * O id da âncora (#data-ex) sai do termo; `id` só é preciso quando o termo tem símbolos demais.
 */
export type Verbete = {
  termo: string;
  id?: string;
  definicao: string;
  artigo?: (typeof SLUGS_PLANEJADOS)[number];
  consulta?: { rotulo: string; href: string };
};

export const VERBETES: Verbete[] = [
  { termo: "Ação", definicao: "Fração do capital de uma empresa de capital aberto. Quem tem ações é sócio da empresa, na proporção do que possui." },
  { termo: "Benchmark", definicao: "Referência para comparar retorno, como o CDI, o Ibovespa ou o IFIX.", artigo: "selic-cdi-sem-misterio" },
  {
    termo: "Bonificação e desdobramento",
    definicao: "Mudam a quantidade de ações sem mudar o valor total, e por isso afetam o preço médio.",
    artigo: "preco-medio",
  },
  {
    termo: "CDB, LCI e LCA",
    id: "cdb-lci-lca",
    definicao:
      "Títulos que os bancos emitem para captar dinheiro. O CDB é o mais comum; LCI e LCA têm lastro em crédito imobiliário e do agronegócio. O imposto de cada um é tratado no artigo, com fonte e data.",
    artigo: "cdb-lci-lca-e-fgc",
  },
  { termo: "CDI", definicao: "Taxa das operações entre bancos. É a referência da renda fixa e fica muito próxima da Selic.", artigo: "selic-cdi-sem-misterio" },
  { termo: "Copom", definicao: "Comitê do Banco Central que define a meta da taxa Selic.", artigo: "selic-cdi-sem-misterio" },
  { termo: "Cota", definicao: "Fração de um fundo, como um FII ou um ETF.", artigo: "etfs-uma-cota-varios-ativos" },
  { termo: "Curva de juros", definicao: "Taxas de juros futuros por prazo: mostra o que o mercado espera para a Selic.", artigo: "tesouro-direto" },
  { termo: "Data-com", definicao: "Último dia para ter o ativo e ter direito ao provento.", artigo: "dividend-yield" },
  {
    termo: "Data-ex",
    definicao: "Primeiro dia em que o ativo negocia sem o direito ao provento: é o pregão seguinte à data-com.",
    artigo: "dividend-yield",
  },
  { termo: "DI futuro", definicao: "Contrato negociado na B3 que reflete a taxa de juros que o mercado espera para o futuro." },
  { termo: "Diversificação", definicao: "Dividir o dinheiro entre ativos diferentes para não depender de um só risco.", artigo: "rebalancear-com-aportes" },
  {
    termo: "Dividend yield (DY)",
    id: "dividend-yield",
    definicao: "Proventos dos últimos 12 meses ÷ preço atual.",
    artigo: "dividend-yield",
    consulta: { rotulo: "Indicadores explicados", href: "/aprender/indicadores#dy" },
  },
  {
    termo: "Dividendo e JCP",
    id: "dividendo-e-jcp",
    definicao:
      "Partes do lucro distribuídas aos acionistas. Dividendo e juros sobre capital próprio (JCP) têm tratamento de imposto diferente: confira a regra vigente na Receita Federal.",
    artigo: "dividend-yield",
  },
  { termo: "ETF", definicao: "Fundo de índice negociado em bolsa: uma cota reúne uma cesta de ativos.", artigo: "etfs-uma-cota-varios-ativos" },
  {
    termo: "FGC",
    definicao:
      "Fundo Garantidor de Créditos: protege parte do dinheiro aplicado em alguns produtos de bancos, até um limite por pessoa e por instituição.",
    artigo: "cdb-lci-lca-e-fgc",
  },
  {
    termo: "FII",
    definicao: "Fundo de investimento imobiliário: reúne o dinheiro de vários cotistas para investir em imóveis ou em títulos ligados a eles.",
    artigo: "fiis-tijolo-ou-papel",
    consulta: { rotulo: "Indicadores de FII", href: "/aprender/indicadores#fii" },
  },
  { termo: "Free float", definicao: "Parcela das ações de uma empresa que está disponível para negociação em bolsa." },
  {
    termo: "IFIX e Ibovespa",
    id: "ifix-e-ibovespa",
    definicao: "Índices da B3: o Ibovespa acompanha as ações mais negociadas e o IFIX, os fundos imobiliários mais negociados.",
    artigo: "etfs-uma-cota-varios-ativos",
  },
  { termo: "IGP-M", definicao: "Índice de preços da FGV, muito usado no reajuste de aluguéis e contratos." },
  {
    termo: "Inflação, IPCA e INPC",
    id: "inflacao-ipca-inpc",
    definicao: "Inflação é a alta geral dos preços. O IPCA é o índice oficial, calculado pelo IBGE; o INPC mede a inflação para famílias de renda mais baixa.",
    artigo: "por-que-o-dinheiro-parado-perde-valor",
  },
  {
    termo: "Juro real",
    definicao: "Juro depois de descontar a inflação: (1 + juro) ÷ (1 + inflação) − 1.",
    artigo: "por-que-o-dinheiro-parado-perde-valor",
    consulta: { rotulo: "Como o site calcula", href: "/aprender/como-calculamos#juro-real" },
  },
  { termo: "Liquidez", definicao: "Facilidade de vender um ativo sem mexer no preço.", artigo: "reserva-de-emergencia" },
  {
    termo: "Lote padrão e fracionário",
    id: "lote-padrao-e-fracionario",
    definicao: "Na B3, o lote padrão tem 100 unidades; de 1 a 99 é o mercado fracionário, e o código do ativo ganha um F no final.",
  },
  { termo: "Marcação a mercado", definicao: "Atualização diária do preço de um título; ele pode cair antes do vencimento.", artigo: "tesouro-direto" },
  {
    termo: "P/L",
    id: "pl",
    definicao: "Preço ÷ lucro por ação: quantos anos de lucro “pagam” o preço da ação.",
    artigo: "pl-e-pvp",
    consulta: { rotulo: "Indicadores explicados", href: "/aprender/indicadores#pl" },
  },
  {
    termo: "P/VP",
    id: "pvp",
    definicao: "Preço ÷ patrimônio por ação: 1,0 quer dizer pagar exatamente o patrimônio da empresa.",
    artigo: "pl-e-pvp",
    consulta: { rotulo: "Indicadores explicados", href: "/aprender/indicadores#pvp" },
  },
  { termo: "Preço médio (PM)", id: "preco-medio", definicao: "Custo médio ponderado das compras, incluindo as taxas.", artigo: "preco-medio" },
  {
    termo: "Provento",
    definicao: "Nome genérico para o que o ativo paga a quem o possui: dividendos, JCP e rendimentos de FII.",
    artigo: "dividend-yield",
  },
  { termo: "Rebalancear", definicao: "Levar a carteira de volta aos pesos-alvo.", artigo: "rebalancear-com-aportes" },
  {
    termo: "Renda fixa e renda variável",
    artigo: "selic-cdi-sem-misterio",
    id: "renda-fixa-e-renda-variavel",
    definicao: "Na renda fixa o retorno é previsível pela regra do título; na renda variável ele é incerto.",
  },
  {
    termo: "Reserva de emergência",
    definicao: "Dinheiro líquido e seguro, guardado para imprevistos.",
    artigo: "reserva-de-emergencia",
  },
  { termo: "Retorno total", definicao: "Retorno que inclui os proventos reinvestidos, além da variação de preço.", artigo: "etfs-uma-cota-varios-ativos" },
  {
    termo: "ROA",
    definicao: "Lucro líquido ÷ ativo total: quanto a empresa gera de lucro com tudo o que tem.",
    artigo: "roe-margem-e-endividamento",
    consulta: { rotulo: "Indicadores explicados", href: "/aprender/indicadores#roa" },
  },
  {
    termo: "ROE",
    definicao: "Lucro líquido ÷ patrimônio líquido: quanto a empresa rende sobre o dinheiro dos acionistas.",
    artigo: "roe-margem-e-endividamento",
    consulta: { rotulo: "Indicadores explicados", href: "/aprender/indicadores#roe" },
  },
  {
    termo: "Selic",
    definicao:
      "Taxa básica de juros da economia, definida pelo Copom. A meta é o alvo que o Copom fixa; a Selic over é a taxa efetiva do dia.",
    artigo: "selic-cdi-sem-misterio",
  },
  { termo: "Tracking error", definicao: "Diferença entre o retorno de um ETF e o do índice que ele copia.", artigo: "etfs-uma-cota-varios-ativos" },
  {
    termo: "Vacância",
    definicao: "Parcela dos imóveis de um fundo que está sem inquilino.",
    artigo: "fiis-tijolo-ou-papel",
    consulta: { rotulo: "Indicadores explicados", href: "/aprender/indicadores#vacancia" },
  },
];

/** A âncora do verbete: #data-ex, #pl, #dividend-yield. */
export function idDoVerbete(v: Verbete): string {
  return v.id ?? slugify(v.termo);
}

/** A letra sob a qual o verbete aparece: a inicial sem acento, maiúscula ("Ação" → "A", "P/L" → "P"). */
export function letraDoVerbete(v: Verbete): string {
  return v.termo.normalize("NFD").replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase();
}
