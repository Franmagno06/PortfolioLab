import { razaoPct } from "@/lib/aprender/exemplos";
import { numero, percentual } from "@/lib/format";
import type { IdDaDica } from "@/lib/indicadores-explicados";
import { ATIVO_DE_EXEMPLO } from "@/lib/site-dados";

/**
 * Os indicadores de /aprender/indicadores: o que mede, a fórmula, como ler e onde engana. Os de ações usam o
 * ATIVO_DE_EXEMPLO (src/lib/site-dados.ts), o mesmo da página inicial: se o dado do mês mudar, esta página
 * muda junto. Os que o exemplo não tem (ROA, margem, vacância, FII) usam uma conta hipotética, rotulada como
 * tal e calculada por razaoPct, que tem teste. Regra de escrita: o texto diz como LER o número e nunca se o
 * ativo é bom, barato ou uma oportunidade (Resolução CVM 20).
 *
 * `id` é a âncora (#pl) para a qual as fichas de ativos, o glossário e os artigos apontam.
 */
export type IndicadorExplicado = {
  id: "pl" | "pvp" | "dy" | "roe" | "roa" | "margem" | "divida" | "vacancia" | "fii";
  nome: string;
  formula: string;
  comoLer: string;
  armadilha: string;
  /** De onde vem o exemplo: o ativo de exemplo ou uma conta hipotética. */
  exemploRotulo: string;
  /** O valor do exemplo, já formatado. "—" quando o exemplo não tem o dado. */
  exemplo: string;
};

const NO_EXEMPLO = `No exemplo (${ATIVO_DE_EXEMPLO.ticker})`;
const HIPOTETICO = "Exemplo hipotético";

export const INDICADORES: IndicadorExplicado[] = [
  {
    id: "pl",
    nome: "Preço/lucro (P/L)",
    formula: "Preço ÷ Lucro por ação",
    comoLer: "Quantos anos de lucro “pagam” o preço da ação.",
    armadilha: "Lucro pontual distorce o P/L. Compare sempre dentro do mesmo setor.",
    exemploRotulo: NO_EXEMPLO,
    exemplo: numero(ATIVO_DE_EXEMPLO.pl, 2),
  },
  {
    id: "pvp",
    nome: "Preço/valor patrimonial (P/VP)",
    formula: "Preço ÷ Patrimônio por ação",
    comoLer: "1,0 = você paga o patrimônio; abaixo de 1 = você paga menos que ele.",
    armadilha: "Não vale para todo setor: serve mais para bancos, seguradoras e FIIs.",
    exemploRotulo: NO_EXEMPLO,
    exemplo: numero(ATIVO_DE_EXEMPLO.pvp, 2),
  },
  {
    id: "dy",
    nome: "Dividend yield (DY)",
    formula: "Proventos dos últimos 12 meses ÷ Preço",
    comoLer: "Quanto você recebeu em proventos para cada R$ 100 investidos.",
    armadilha: "DY alto pode ser o preço caindo, não o provento subindo.",
    exemploRotulo: NO_EXEMPLO,
    exemplo: `${percentual(ATIVO_DE_EXEMPLO.dy12m, 2)} (R$ ${numero(ATIVO_DE_EXEMPLO.proventos12m.porUnidade, 4)} em ${ATIVO_DE_EXEMPLO.proventos12m.pagamentos} pagamentos)`,
  },
  {
    id: "roe",
    nome: "ROE",
    formula: "Lucro líquido ÷ Patrimônio líquido",
    comoLer:
      "Quanto a empresa rende sobre o dinheiro dos acionistas. Acima de ~15% de forma consistente é bom sinal (regra prática).",
    armadilha: "Dívida alta infla o ROE: alto demais pode ser alavancagem, não qualidade.",
    exemploRotulo: NO_EXEMPLO,
    exemplo: percentual(ATIVO_DE_EXEMPLO.roe, 2),
  },
  {
    id: "roa",
    nome: "ROA",
    formula: "Lucro líquido ÷ Ativo total",
    comoLer: "Quanto a empresa gera de lucro com tudo o que tem, inclusive o que comprou com dívida. É o mais comparável entre bancos.",
    armadilha: "Banco trabalha com muito ativo e tem ROA naturalmente baixo: compare só dentro do mesmo setor.",
    exemploRotulo: HIPOTETICO,
    exemplo: `${percentual(razaoPct(2, 100), 1)} (lucro de R$ 2 bi ÷ ativo de R$ 100 bi)`,
  },
  {
    id: "margem",
    nome: "Margem líquida",
    formula: "Lucro líquido ÷ Receita líquida",
    comoLer: "De cada R$ 100 vendidos, quanto sobra de lucro depois de custos, despesas e impostos. Leia a tendência de vários anos.",
    armadilha: "Não se aplica bem a bancos, e um lucro pontual infla a margem de um ano só.",
    exemploRotulo: HIPOTETICO,
    exemplo: `${percentual(razaoPct(15, 120), 1)} (lucro de R$ 15 mi ÷ receita de R$ 120 mi)`,
  },
  {
    id: "divida",
    nome: "Dívida líquida/EBITDA",
    formula: "Dívida líquida ÷ EBITDA",
    comoLer: "Quantos anos de caixa operacional seriam necessários para quitar a dívida.",
    armadilha: "As faixas variam por setor e por fonte: use como referência, não como regra.",
    exemploRotulo: HIPOTETICO,
    exemplo: `${numero(600 / 300, 1)}x (dívida líquida de R$ 600 mi ÷ EBITDA de R$ 300 mi)`,
  },
  {
    id: "vacancia",
    nome: "Vacância (FII de tijolo)",
    formula: "Área vaga ÷ Área total",
    comoLer: "Quanto dos imóveis do fundo está sem inquilino. Menor é melhor: imóvel vazio não paga aluguel e ainda gera custo.",
    armadilha: "Contratos que vencem no mesmo ano podem fazer a vacância pular de uma vez. Leia o relatório gerencial.",
    exemploRotulo: HIPOTETICO,
    exemplo: `${percentual(razaoPct(1500, 20000), 1)} (1.500 m² vagos ÷ 20.000 m²)`,
  },
  {
    id: "fii",
    nome: "DY e P/VP de FII",
    formula: "Rendimentos de 12 meses ÷ Preço da cota · Preço da cota ÷ Patrimônio por cota",
    comoLer: "As mesmas contas das ações, com a cota no lugar da ação. P/VP perto de 1 quer dizer pagar o valor dos imóveis e títulos do fundo.",
    armadilha: "P/VP abaixo de 1 com DY muito alto pede cuidado: o rendimento pode ter um ganho que não se repete.",
    exemploRotulo: HIPOTETICO,
    exemplo: `DY ${percentual(razaoPct(1.1, 10), 1)} e P/VP ${numero(9.5 / 10, 2)} (cota de R$ 9,50, patrimônio de R$ 10,00 por cota)`,
  },
];

/**
 * Para onde cada "?" das fichas aponta em /aprender/indicadores. Só as dicas que têm cartão lá; o resto
 * (espécie, tipo de fundo, gestão, taxa) segue sem link.
 */
export const ANCORA_DA_DICA: Partial<Record<IdDaDica, IndicadorExplicado["id"]>> = {
  pl: "pl",
  pvp: "pvp",
  dy12m: "dy",
  dyEtf: "dy",
  roe: "roe",
  roa: "roa",
  margemLiquida: "margem",
  dividaEbitda: "divida",
  pvpFii: "fii",
  dyFii: "fii",
  dyMensal: "fii",
};
