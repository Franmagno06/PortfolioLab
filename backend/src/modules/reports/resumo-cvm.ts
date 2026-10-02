import { Prisma } from "@prisma/client";
import type { ContaCvm, DadosAcao, DadosFii, InformeFii } from "./cvm.provider.js";
import type { Analise } from "./gemini.js";

// Transforma os números da CVM em três coisas:
// - os indicadores da análise, calculados aqui e nunca pela IA — a IA não
//   inventa número que o código já sabe;
// - o texto que a IA lê para escrever o resumo e os alertas;
// - uma análise só com template, para quando a IA não responde.

export type DadosCvm = DadosAcao | DadosFii;

const CEM = new Prisma.Decimal(100);

/** R$ 78,45 bi / R$ 312,10 mi / R$ 4.500,00. Formatação só na saída. */
export function formatarReais(valor: Prisma.Decimal): string {
  const abs = valor.abs();
  const numero = (d: Prisma.Decimal) =>
    d.toNumber().toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs.gte(1e9)) return `R$ ${numero(valor.div(1e9))} bi`;
  if (abs.gte(1e6)) return `R$ ${numero(valor.div(1e6))} mi`;
  return `R$ ${numero(valor)}`;
}

/** Fração da CVM (0.004342) em percentual legível (0,43%). */
export function formatarFracao(fracao: Prisma.Decimal, casas = 2): string {
  return `${fracao.mul(CEM).toNumber().toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** Variação percentual de `anterior` para `atual`. Null quando não há base. */
export function variacao(atual: Prisma.Decimal | null, anterior: Prisma.Decimal | null): string | null {
  if (!atual || !anterior || anterior.isZero()) return null;
  const pct = atual.minus(anterior).div(anterior.abs()).mul(CEM);
  const texto = pct.toNumber().toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return pct.isNegative() ? `${texto}%` : `+${texto}%`;
}

const inteiro = (d: Prisma.Decimal) => d.toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 0 });

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

/**
 * O plano de contas da CVM muda com o setor: indústria abre a DRE com
 * "Receita de Venda de Bens e/ou Serviços", banco com "Receitas de
 * Intermediação Financeira", seguradora com prêmios. A primeira conta da DRE
 * (3.01) é a receita em todos eles, com o nome que o setor usa.
 */
function receita(d: DadosAcao): ContaCvm | undefined {
  return d.resultado.find((c) => c.codigo === "3.01");
}

/**
 * Lucro dos controladores quando existe — é o número do mercado, e a conta
 * se chama só "Atribuído a Sócios da Empresa Controladora". Senão, a última
 * conta de lucro do período, que é o lucro líquido.
 */
function lucro(d: DadosAcao): ContaCvm | undefined {
  return (
    d.resultado.find((c) => /controladora/i.test(c.conta)) ??
    d.resultado.filter((c) => /^3\.\d{2}$/.test(c.codigo) && /lucro|preju[ií]zo/i.test(c.conta)).at(-1)
  );
}

/**
 * Margem líquida só faz sentido sobre receita de venda. Em banco a conta 3.01
 * é receita de intermediação, bruta de captação — lucro sobre ela não é a
 * margem que o mercado usa.
 */
const temReceitaDeVenda = (r: ContaCvm) => /venda|servi[cç]os/i.test(r.conta);

function patrimonioLiquido(d: DadosAcao): ContaCvm | undefined {
  return d.balanco.find((c) => /^2\.\d{2}$/.test(c.codigo) && /patrim[oô]nio l[ií]quido/i.test(c.conta));
}

function ativoTotal(d: DadosAcao): ContaCvm | undefined {
  return d.balanco.find((c) => c.codigo === "1");
}

function comVariacao(conta: ContaCvm): string {
  if (!conta.atual) return "não informado";
  const v = variacao(conta.atual, conta.anterior);
  return v ? `${formatarReais(conta.atual)} (${v})` : formatarReais(conta.atual);
}

function indicadoresAcao(d: DadosAcao): Analise["indicadores"] {
  const indicadores: Analise["indicadores"] = [];
  const r = receita(d);
  const l = lucro(d);
  const pl = patrimonioLiquido(d);
  const at = ativoTotal(d);

  if (r) indicadores.push({ nome: r.conta, valor: comVariacao(r) });
  if (l) {
    const nome = /controladora/i.test(l.conta) ? "Lucro líquido atribuído aos controladores" : l.conta;
    indicadores.push({ nome, valor: comVariacao(l) });
  }
  if (r?.atual && l?.atual && !r.atual.isZero() && temReceitaDeVenda(r)) {
    indicadores.push({ nome: "Margem líquida", valor: formatarFracao(l.atual.div(r.atual), 1) });
  }
  if (pl) indicadores.push({ nome: pl.conta, valor: comVariacao(pl) });
  if (at?.atual) indicadores.push({ nome: "Ativo total", valor: formatarReais(at.atual) });
  return indicadores;
}

function linhaDeConta(c: ContaCvm): string {
  const atual = c.atual ? formatarReais(c.atual) : "não informado";
  const anterior = c.anterior ? formatarReais(c.anterior) : "não informado";
  const v = variacao(c.atual, c.anterior);
  return `- ${c.codigo} ${c.conta}: ${atual} | base de comparação: ${anterior}${v ? ` | variação: ${v}` : ""}`;
}

function contextoAcao(d: DadosAcao, rotulo: string): string {
  const periodo =
    d.documento === "DFP"
      ? `exercício encerrado em ${d.dataReferencia} (DFP), comparado com o exercício anterior`
      : `trimestre encerrado em ${d.dataReferencia} (ITR, ${rotulo}), comparado com o mesmo trimestre do ano anterior`;
  return [
    `Companhia: ${d.denominacao}`,
    `Documento: ${d.documento === "DFP" ? "Demonstrações Financeiras Padronizadas" : "Informações Trimestrais"} entregues à CVM, ${d.consolidado ? "consolidadas" : "individuais"}.`,
    `Período: ${periodo}.`,
    "Valores em reais, com o sinal da CVM: despesa é negativa. A variação é calculada sobre o valor com sinal — despesa que cresce aparece como variação negativa.",
    "",
    "Demonstração do resultado:",
    ...d.resultado.map(linhaDeConta),
    "",
    "Balanço patrimonial (data-base contra o fim do exercício anterior):",
    ...d.balanco.map(linhaDeConta),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// FIIs
// ---------------------------------------------------------------------------

type CampoFii = {
  nome: string;
  valor: (i: InformeFii) => Prisma.Decimal | null;
  formato: "reais" | "fracao" | "inteiro";
};

const CAMPOS_FII: CampoFii[] = [
  { nome: "Patrimônio líquido", valor: (i) => i.patrimonioLiquido, formato: "reais" },
  { nome: "Valor patrimonial por cota", valor: (i) => i.valorPatrimonialCota, formato: "reais" },
  { nome: "Dividend yield do mês", valor: (i) => i.dividendYieldMes, formato: "fracao" },
  { nome: "Rentabilidade efetiva do mês", valor: (i) => i.rentabilidadeEfetivaMes, formato: "fracao" },
  { nome: "Rentabilidade patrimonial do mês", valor: (i) => i.rentabilidadePatrimonialMes, formato: "fracao" },
  { nome: "Número de cotistas", valor: (i) => i.cotistas, formato: "inteiro" },
  { nome: "Cotas emitidas", valor: (i) => i.cotasEmitidas, formato: "inteiro" },
  { nome: "Valor do ativo", valor: (i) => i.valorAtivo, formato: "reais" },
  { nome: "Total investido", valor: (i) => i.totalInvestido, formato: "reais" },
  { nome: "Imóveis para renda acabados", valor: (i) => i.imoveisParaRenda, formato: "reais" },
  { nome: "CRI", valor: (i) => i.cri, formato: "reais" },
  { nome: "Cotas de outros FIIs", valor: (i) => i.cotasDeFii, formato: "reais" },
  { nome: "Disponibilidades", valor: (i) => i.disponibilidades, formato: "reais" },
  { nome: "Rendimentos a distribuir", valor: (i) => i.rendimentosADistribuir, formato: "reais" },
  { nome: "Total do passivo", valor: (i) => i.totalPassivo, formato: "reais" },
  { nome: "Taxa de administração no mês (% do PL)", valor: (i) => i.taxaAdministracaoMes, formato: "fracao" },
  { nome: "Amortização de cotas no mês", valor: (i) => i.amortizacaoMes, formato: "fracao" },
];

// Os que viram indicador na tela. O resto só vai para a IA.
const INDICADORES_FII = new Set([
  "Patrimônio líquido",
  "Valor patrimonial por cota",
  "Dividend yield do mês",
  "Rentabilidade efetiva do mês",
  "Número de cotistas",
]);

function formatarCampo(valor: Prisma.Decimal, formato: CampoFii["formato"]): string {
  if (formato === "reais") return formatarReais(valor);
  if (formato === "fracao") return formatarFracao(valor);
  return inteiro(valor);
}

function indicadoresFii(d: DadosFii): Analise["indicadores"] {
  return CAMPOS_FII.filter((c) => INDICADORES_FII.has(c.nome)).flatMap((c) => {
    const atual = c.valor(d.mes);
    if (!atual) return [];
    // variação de fração (DY, rentabilidade) em % confunde; vai para a IA, não para o card
    const v = c.formato === "fracao" || !d.mesAnterior ? null : variacao(atual, c.valor(d.mesAnterior));
    const texto = formatarCampo(atual, c.formato);
    return [{ nome: c.nome, valor: v ? `${texto} (${v} no mês)` : texto }];
  });
}

function contextoFii(d: DadosFii, rotulo: string): string {
  const linhas = CAMPOS_FII.flatMap((c) => {
    const atual = c.valor(d.mes);
    if (!atual) return [];
    const anterior = d.mesAnterior ? c.valor(d.mesAnterior) : null;
    const base = anterior ? ` | mês anterior: ${formatarCampo(anterior, c.formato)}` : "";
    return [`- ${c.nome}: ${formatarCampo(atual, c.formato)}${base}`];
  });
  return [
    `Fundo: ${d.nome}`,
    `Documento: Informe Mensal Estruturado entregue à CVM, competência ${rotulo}.`,
    d.segmento ? `Segmento de atuação: ${d.segmento}` : null,
    d.mandato ? `Mandato: ${d.mandato}` : null,
    d.tipoGestao ? `Gestão: ${d.tipoGestao}` : null,
    "",
    "Números do mês:",
    ...linhas,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

export function indicadoresCvm(d: DadosCvm): Analise["indicadores"] {
  return d.tipo === "ACAO" ? indicadoresAcao(d) : indicadoresFii(d);
}

/** O que a IA lê: os números oficiais, já formatados e com a base de comparação. */
export function contextoParaIa(d: DadosCvm, rotulo: string): string {
  return d.tipo === "ACAO" ? contextoAcao(d, rotulo) : contextoFii(d, rotulo);
}

export function tipoDocumentoCvm(d: DadosCvm, rotulo: string): string {
  if (d.tipo === "FII") return `Informe Mensal de FII (CVM) — ${rotulo}`;
  return d.documento === "DFP"
    ? `Demonstrações financeiras anuais (DFP/CVM) — ${rotulo}`
    : `Informações trimestrais (ITR/CVM) — ${rotulo}`;
}

/**
 * Análise sem IA: os indicadores e tópicos montados por template. É o que o
 * usuário recebe quando a IA está fora do ar ou sem cota — os números
 * oficiais já foram baixados, não faz sentido falhar o upload por causa do
 * texto corrido.
 */
export function analiseSemIa(d: DadosCvm, rotulo: string): Analise {
  const indicadores = indicadoresCvm(d);
  const alertas: Analise["alertas"] = [];

  if (d.tipo === "ACAO") {
    const l = lucro(d);
    if (l?.atual?.isNegative()) {
      alertas.push({
        titulo: "Prejuízo no período",
        severidade: "critico",
        detalhe: `${l.conta}: ${formatarReais(l.atual)}.`,
      });
    }
  } else if (d.mesAnterior) {
    const dyAtual = d.mes.dividendYieldMes;
    const dyAnterior = d.mesAnterior.dividendYieldMes;
    if (dyAtual && dyAnterior && dyAtual.lt(dyAnterior)) {
      alertas.push({
        titulo: "Dividend yield menor que no mês anterior",
        severidade: "atencao",
        detalhe: `${formatarFracao(dyAtual)} contra ${formatarFracao(dyAnterior)} no mês anterior.`,
      });
    }
  }

  alertas.push({
    titulo: "Resumo sem leitura da IA",
    severidade: "info",
    detalhe:
      "A IA não respondeu no momento do envio. Os números acima vêm direto da CVM; envie o relatório de novo mais tarde para receber a análise comentada.",
  });

  return {
    tipoDocumento: tipoDocumentoCvm(d, rotulo),
    resumoExecutivo: indicadores.map((i) => `${i.nome}: ${i.valor}.`),
    alertas,
    indicadores,
  };
}
