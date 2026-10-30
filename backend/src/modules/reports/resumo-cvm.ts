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
export function lucro(d: DadosAcao): ContaCvm | undefined {
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

export function patrimonioLiquido(d: DadosAcao): ContaCvm | undefined {
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

function pctVariacao(atual: Prisma.Decimal | null, anterior: Prisma.Decimal | null): number | null {
  if (!atual || !anterior || anterior.isZero()) return null;
  return atual.minus(anterior).div(anterior.abs()).mul(CEM).toNumber();
}

/**
 * Análise determinística oficial CVM: indicadores, resumo executivo rico e
 * alertas inteligentes baseados em regras contábeis e financeiras da CVM.
 */
export function analiseSemIa(d: DadosCvm, rotulo: string): Analise {
  const indicadores = indicadoresCvm(d);
  const alertas: Analise["alertas"] = [];
  const resumoExecutivo: string[] = [];

  if (d.tipo === "ACAO") {
    const r = receita(d);
    const l = lucro(d);
    const pl = patrimonioLiquido(d);
    const at = ativoTotal(d);

    resumoExecutivo.push(`Análise Fundamentalista Oficial CVM (${d.denominacao}).`);

    if (r?.atual) {
      const v = variacao(r.atual, r.anterior);
      resumoExecutivo.push(
        `${r.conta}: ${formatarReais(r.atual)}${v ? ` (variação de ${v} YoY)` : ""}.`,
      );
    }
    if (l?.atual) {
      const nomeLucro = /controladora/i.test(l.conta) ? "Lucro líquido aos controladores" : l.conta;
      const v = variacao(l.atual, l.anterior);
      resumoExecutivo.push(
        `${nomeLucro}: ${formatarReais(l.atual)}${v ? ` (variação de ${v} YoY)` : ""}.`,
      );
    }
    if (r?.atual && l?.atual && !r.atual.isZero() && temReceitaDeVenda(r)) {
      const margem = l.atual.div(r.atual);
      resumoExecutivo.push(`Margem líquida do período: ${formatarFracao(margem, 1)}.`);
    }
    if (pl?.atual && l?.atual && !pl.atual.isZero()) {
      const roe = l.atual.div(pl.atual);
      resumoExecutivo.push(`Retorno sobre Patrimônio Líquido (ROE do período): ${formatarFracao(roe, 1)}.`);
    }
    if (pl?.atual) {
      const v = variacao(pl.atual, pl.anterior);
      resumoExecutivo.push(
        `Patrimônio Líquido: ${formatarReais(pl.atual)}${v ? ` (${v} frente à base anterior)` : ""}.`,
      );
    }
    if (at?.atual) {
      const v = variacao(at.atual, at.anterior);
      resumoExecutivo.push(
        `Ativo Total: ${formatarReais(at.atual)}${v ? ` (${v} frente à base anterior)` : ""}.`,
      );
    }

    // Alertas determinísticos inteligentes para Ações:
    if (l?.atual?.isNegative()) {
      alertas.push({
        titulo: "Prejuízo contábil no período",
        severidade: "critico",
        detalhe: `${l.conta}: ${formatarReais(l.atual)}. A empresa operou no vermelho no período reportado.`,
      });
    }

    if (r?.atual && r.anterior) {
      const varReceita = pctVariacao(r.atual, r.anterior);
      if (varReceita !== null && varReceita <= -15) {
        alertas.push({
          titulo: "Queda expressiva de receita YoY",
          severidade: "atencao",
          detalhe: `${r.conta} recuou ${Math.abs(varReceita).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% em relação ao mesmo período do ano anterior.`,
        });
      }
    }

    if (l?.atual && l.anterior && !l.atual.isNegative()) {
      const varLucro = pctVariacao(l.atual, l.anterior);
      if (varLucro !== null && varLucro <= -15) {
        alertas.push({
          titulo: "Queda acentuada de lucro YoY",
          severidade: "atencao",
          detalhe: `O lucro reportado recuou ${Math.abs(varLucro).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% na comparação anual.`,
        });
      } else if (varLucro !== null && varLucro >= 10) {
        alertas.push({
          titulo: "Crescimento consistente de lucro",
          severidade: "info",
          detalhe: `Lucro líquido avançou +${varLucro.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% frente ao período homólogo anterior.`,
        });
      }
    }

    if (r?.atual && l?.atual && !r.atual.isZero() && temReceitaDeVenda(r) && !l.atual.isNegative()) {
      const margemPct = l.atual.div(r.atual).mul(CEM).toNumber();
      if (margemPct >= 15) {
        alertas.push({
          titulo: "Margem líquida saudável",
          severidade: "info",
          detalhe: `Margem líquida robusta de ${margemPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% no período.`,
        });
      }
    }
  } else {
    // FIIs
    const m = d.mes;
    const a = d.mesAnterior;

    resumoExecutivo.push(`Análise Fundamentalista Oficial CVM (${d.nome}).`);

    if (m.patrimonioLiquido) {
      const v = a ? variacao(m.patrimonioLiquido, a.patrimonioLiquido) : null;
      resumoExecutivo.push(
        `Patrimônio Líquido: ${formatarReais(m.patrimonioLiquido)}${v ? ` (${v} MoM)` : ""}.`,
      );
    }
    if (m.valorPatrimonialCota) {
      const v = a ? variacao(m.valorPatrimonialCota, a.valorPatrimonialCota) : null;
      resumoExecutivo.push(
        `VPA por cota: ${formatarReais(m.valorPatrimonialCota)}${v ? ` (${v} MoM)` : ""}.`,
      );
    }
    if (m.dividendYieldMes) {
      resumoExecutivo.push(`Dividend Yield do mês: ${formatarFracao(m.dividendYieldMes)}.`);
    }
    if (m.rentabilidadeEfetivaMes || m.rentabilidadePatrimonialMes) {
      const ef = m.rentabilidadeEfetivaMes ? `efetiva de ${formatarFracao(m.rentabilidadeEfetivaMes)}` : "";
      const pat = m.rentabilidadePatrimonialMes ? `patrimonial de ${formatarFracao(m.rentabilidadePatrimonialMes)}` : "";
      const partes = [ef, pat].filter(Boolean).join(" e ");
      resumoExecutivo.push(`Rentabilidade no mês: ${partes}.`);
    }
    if (m.cotistas) {
      const v = a ? variacao(m.cotistas, a.cotistas) : null;
      resumoExecutivo.push(`Base de cotistas: ${inteiro(m.cotistas)}${v ? ` (${v} MoM)` : ""}.`);
    }
    if (m.cotasEmitidas) {
      resumoExecutivo.push(`Total de cotas emitidas: ${inteiro(m.cotasEmitidas)}.`);
    }

    // Composição de carteira:
    const carteira: string[] = [];
    if (m.imoveisParaRenda && !m.imoveisParaRenda.isZero()) carteira.push(`Imóveis: ${formatarReais(m.imoveisParaRenda)}`);
    if (m.cri && !m.cri.isZero()) carteira.push(`CRI: ${formatarReais(m.cri)}`);
    if (m.cotasDeFii && !m.cotasDeFii.isZero()) carteira.push(`Cotas FII: ${formatarReais(m.cotasDeFii)}`);
    if (m.disponibilidades && !m.disponibilidades.isZero()) carteira.push(`Caixa/Disponibilidades: ${formatarReais(m.disponibilidades)}`);
    if (carteira.length > 0) {
      resumoExecutivo.push(`Composição da carteira: ${carteira.join(", ")}.`);
    }

    if (m.totalPassivo && !m.totalPassivo.isZero()) {
      resumoExecutivo.push(`Passivo e obrigações totais: ${formatarReais(m.totalPassivo)}.`);
    }
    if (m.taxaAdministracaoMes) {
      resumoExecutivo.push(`Taxa de administração no mês: ${formatarFracao(m.taxaAdministracaoMes)} do PL.`);
    }

    // Alertas determinísticos inteligentes para FIIs:
    if (a?.dividendYieldMes && m.dividendYieldMes && m.dividendYieldMes.lt(a.dividendYieldMes)) {
      alertas.push({
        titulo: "Queda de DY MoM",
        severidade: "atencao",
        detalhe: `Dividend Yield mensal reduziu de ${formatarFracao(a.dividendYieldMes)} para ${formatarFracao(m.dividendYieldMes)}.`,
      });
    }

    // Alavancagem: Passivo / Ativo > 15%
    if (m.totalPassivo && m.valorAtivo && !m.valorAtivo.isZero()) {
      const alavancagem = m.totalPassivo.div(m.valorAtivo);
      if (alavancagem.gt(new Prisma.Decimal("0.15"))) {
        alertas.push({
          titulo: "Alavancagem elevada",
          severidade: "atencao",
          detalhe: `O passivo total representa ${formatarFracao(alavancagem, 1)} dos ativos do fundo.`,
        });
      }
    }

    // Queda no número de cotistas
    if (a?.cotistas && m.cotistas && m.cotistas.lt(a.cotistas)) {
      const varCotistas = a.cotistas.minus(m.cotistas);
      alertas.push({
        titulo: "Queda no número de cotistas",
        severidade: "info",
        detalhe: `Redução de ${inteiro(varCotistas)} cotistas no mês (${inteiro(a.cotistas)} para ${inteiro(m.cotistas)}).`,
      });
    }

    // Caixa apertado: Disponibilidades < 1% do Ativo (ou PL)
    if (m.disponibilidades && m.valorAtivo && !m.valorAtivo.isZero()) {
      const fracaoCaixa = m.disponibilidades.div(m.valorAtivo);
      if (fracaoCaixa.lt(new Prisma.Decimal("0.01"))) {
        alertas.push({
          titulo: "Caixa apertado",
          severidade: "info",
          detalhe: `Disponibilidades em caixa representam apenas ${formatarFracao(fracaoCaixa, 1)} do ativo total (${formatarReais(m.disponibilidades)}).`,
        });
      }
    }
  }

  return {
    tipoDocumento: tipoDocumentoCvm(d, rotulo),
    resumoExecutivo,
    alertas,
    indicadores,
  };
}
