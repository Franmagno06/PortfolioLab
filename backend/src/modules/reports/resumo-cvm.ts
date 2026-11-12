import { Prisma } from "@prisma/client";
import { VERSAO_DA_ANALISE, type Alerta, type Analise, type BlocoDoResumo, type Destaque } from "./analise.js";
import type { ContaCvm, DadosAcao, DadosFii, InformeFii } from "./cvm.provider.js";

// Transforma os números da CVM na análise que a tela mostra: indicadores com a definição de cada um,
// um resumo em blocos e três grupos de pontos (destaques do período, atenção, críticos). Tudo por
// regra fixa. Três cuidados valem para o arquivo inteiro:
// - nenhum número é escrito aqui: todos vêm de `DadosCvm` ou de uma conta feita com eles;
// - nenhuma frase julga ("saudável", "robusto", "bom sinal", "forte") nem recomenda: diz o fato, a
//   conta e a direção do número. Um destaque diz que o número subiu além de um corte; não diz que a
//   empresa vai bem. Cada ponto leva o critério que o gerou;
// - mudou o que este arquivo escreve ou calcula? Suba VERSAO_DA_ANALISE (analise.ts), ou o cache
//   continua servindo o texto antigo.

export type DadosCvm = DadosAcao | DadosFii;

type Resultado = Pick<Analise, "blocos" | "destaques" | "alertas">;

const CEM = new Prisma.Decimal(100);

/** R$ 2,59 tri / R$ 78,45 bi / R$ 312,10 mi / R$ 4.500,00. Formatação só na saída. */
export function formatarReais(valor: Prisma.Decimal): string {
  const abs = valor.abs();
  const numero = (d: Prisma.Decimal) =>
    d.toNumber().toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs.gte(1e12)) return `R$ ${numero(valor.div(1e12))} tri`;
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

/** Variação percentual de `anterior` para `atual`, como número. Null quando não há base. */
function pctVariacao(atual: Prisma.Decimal | null, anterior: Prisma.Decimal | null): Prisma.Decimal | null {
  if (!atual || !anterior || anterior.isZero()) return null;
  return atual.minus(anterior).div(anterior.abs()).mul(CEM);
}

/**
 * Variação percentual só quando as duas pontas são positivas. É a que os cortes usam: sobre base zero
 * não há conta, e sobre base negativa (prejuízo, patrimônio negativo) o percentual não diz nada.
 */
function pctSobreBasePositiva(atual: Prisma.Decimal | null | undefined, anterior: Prisma.Decimal | null | undefined) {
  if (!atual?.gt(0) || !anterior?.gt(0)) return null;
  return pctVariacao(atual, anterior);
}

/** Variação percentual de `anterior` para `atual`, com sinal: "+12,5%". Null quando não há base. */
export function variacao(atual: Prisma.Decimal | null, anterior: Prisma.Decimal | null): string | null {
  const pct = pctVariacao(atual, anterior)?.toDecimalPlaces(1);
  if (!pct) return null;
  // o que arredonda para zero sai sem sinal: "-0,0%" e "+0,0%" sugerem um movimento que não houve
  if (pct.isZero()) return "0,0%";
  const texto = pct.toNumber().toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return pct.lt(0) ? `${texto}%` : `+${texto}%`;
}

/**
 * Subiu de verdade: as duas pontas positivas e a alta aparece na casa que a tela mostra (+0,1% ou mais).
 * Alta que arredonda para "0,0%" não é movimento.
 */
function subiuNaTela(atual: Prisma.Decimal | null | undefined, anterior: Prisma.Decimal | null | undefined): boolean {
  return pctSobreBasePositiva(atual, anterior)?.toDecimalPlaces(1).gt(0) ?? false;
}

const inteiro = (d: Prisma.Decimal) => d.toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = (d: Prisma.Decimal) => d.abs().toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const semVazios = (blocos: BlocoDoResumo[]) => blocos.filter((b) => b.itens.length > 0);

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

const ehDosControladores = (l: ContaCvm) => /controladora/i.test(l.conta);
const nomeDoLucro = (l: ContaCvm) => (ehDosControladores(l) ? "Lucro líquido atribuído aos controladores" : l.conta);

/** Com o que a DRE compara: o trimestre contra o mesmo trimestre do ano anterior; a DFP, o exercício anterior. */
const baseDaDre = (d: DadosAcao) => (d.documento === "DFP" ? "o exercício anterior" : "o mesmo trimestre do ano anterior");
const periodoDaDre = (d: DadosAcao) => (d.documento === "DFP" ? "exercício" : "trimestre");

/**
 * Lucro do período sobre o patrimônio líquido da data-base, sem anualizar. No ITR é o retorno de um
 * trimestre só (perto de um quarto do ROE anual que os sites publicam); o nome do indicador diz isso.
 */
function retornoSobrePatrimonio(d: DadosAcao): Prisma.Decimal | null {
  const l = lucro(d)?.atual;
  const pl = patrimonioLiquido(d)?.atual;
  if (!l || !pl || !pl.gt(0)) return null;
  return l.div(pl);
}

function margemLiquida(d: DadosAcao): Prisma.Decimal | null {
  const r = receita(d);
  const l = lucro(d)?.atual;
  if (!r?.atual || !l || !r.atual.gt(0) || !temReceitaDeVenda(r)) return null;
  return l.div(r.atual);
}

// As definições dizem o que a conta é ou como o indicador é calculado. Nenhuma diz se o número é alto ou baixo.
const DEFINICAO = {
  receitaDeVenda:
    "Primeira linha da DRE (conta 3.01): o que a companhia vendeu no período, já sem os impostos sobre a venda, antes de custos e despesas.",
  receitaDeOutroSetor:
    "Primeira linha da DRE (conta 3.01), com o nome que o plano de contas do setor usa. Em banco, são juros e rendas de crédito, títulos e outras operações, antes do custo de captação; por isso não se calcula margem líquida sobre ela.",
  lucro: "Resultado do período depois de custos, despesas, resultado financeiro e impostos. Abaixo de zero, é prejuízo.",
  lucroDosControladores:
    "Resultado do período depois de custos, despesas, resultado financeiro e impostos, na parte que cabe aos acionistas da companhia (sem a dos sócios minoritários das controladas).",
  margem: "Lucro ÷ receita, no mesmo período.",
  retornoTrimestre: "Lucro do trimestre ÷ patrimônio líquido na data-base, sem anualizar.",
  retornoExercicio: "Lucro do exercício ÷ patrimônio líquido no fim do exercício.",
  patrimonio: "O que pertence aos acionistas: ativo total menos as obrigações com terceiros. A variação é contra o fim do exercício anterior.",
  ativo: "Tudo o que a companhia tem ou tem a receber na data-base. A variação é contra o fim do exercício anterior.",
};

function indicadoresAcao(d: DadosAcao): Analise["indicadores"] {
  const indicadores: Analise["indicadores"] = [];
  const r = receita(d);
  const l = lucro(d);
  const pl = patrimonioLiquido(d);
  const at = ativoTotal(d);
  const margem = margemLiquida(d);
  const retorno = retornoSobrePatrimonio(d);

  if (r) {
    indicadores.push({
      nome: r.conta,
      valor: comVariacao(r),
      definicao: temReceitaDeVenda(r) ? DEFINICAO.receitaDeVenda : DEFINICAO.receitaDeOutroSetor,
    });
  }
  if (l) {
    indicadores.push({
      nome: nomeDoLucro(l),
      valor: comVariacao(l),
      definicao: ehDosControladores(l) ? DEFINICAO.lucroDosControladores : DEFINICAO.lucro,
    });
  }
  if (margem) indicadores.push({ nome: "Margem líquida", valor: formatarFracao(margem, 1), definicao: DEFINICAO.margem });
  if (retorno) {
    indicadores.push({
      nome: `Retorno sobre o patrimônio no ${periodoDaDre(d)}`,
      valor: formatarFracao(retorno, 1),
      definicao: d.documento === "DFP" ? DEFINICAO.retornoExercicio : DEFINICAO.retornoTrimestre,
    });
  }
  if (pl) indicadores.push({ nome: "Patrimônio líquido", valor: comVariacao(pl), definicao: DEFINICAO.patrimonio });
  if (at?.atual) indicadores.push({ nome: "Ativo total", valor: comVariacao(at), definicao: DEFINICAO.ativo });
  return indicadores;
}

/** Variação, em %, a partir da qual receita ou lucro viram destaque (para cima) ou atenção (para baixo). Um corte fixo, não um juízo. */
const CORTE_DE_VARIACAO = 15;

function blocosAcao(d: DadosAcao): BlocoDoResumo[] {
  const r = receita(d);
  const l = lucro(d);
  const pl = patrimonioLiquido(d);
  const at = ativoTotal(d);
  const margem = margemLiquida(d);
  const retorno = retornoSobrePatrimonio(d);
  const base = baseDaDre(d);

  const documento = [
    `${d.denominacao}: demonstrações ${d.consolidado ? "consolidadas" : "individuais"} do ${periodoDaDre(d)} ` +
      `encerrado em ${dataPorExtenso(d.dataReferencia)}. O resultado é comparado com ${base}; ` +
      `o balanço, com o fim do exercício anterior.`,
    d.documento === "DFP"
      ? "As Demonstrações Financeiras Padronizadas (DFP) reúnem o exercício inteiro e são auditadas por auditor independente registrado na CVM. A DRE mostra receitas, custos e lucro do exercício; o balanço, o que a companhia tem (ativo) e o que deve (passivo) no fim dele."
      : "As Informações Trimestrais (ITR) são as demonstrações que a companhia aberta entrega à CVM a cada trimestre. A DRE mostra receitas, custos e lucro do trimestre; o balanço, o que a companhia tem (ativo) e o que deve (passivo) na data-base.",
    d.consolidado
      ? "Consolidadas: somam a companhia e as controladas como um grupo só."
      : "Individuais: só a companhia, sem somar as controladas.",
  ];

  const resultado: string[] = [];
  if (r?.atual) {
    const v = variacao(r.atual, r.anterior);
    resultado.push(`${r.conta}: ${formatarReais(r.atual)}${v ? `, ${v} contra ${base}` : ""}.`);
  }
  if (l?.atual) {
    const v = variacao(l.atual, l.anterior);
    resultado.push(`${nomeDoLucro(l)}: ${formatarReais(l.atual)}${v ? `, ${v} contra ${base}` : ""}.`);
  }
  if (margem) {
    resultado.push(`Margem líquida (lucro dividido pela receita): ${formatarFracao(margem, 1)}.`);
  }
  if (retorno) {
    resultado.push(
      d.documento === "DFP"
        ? `Retorno sobre o patrimônio no exercício (lucro dividido pelo patrimônio líquido): ${formatarFracao(retorno, 1)}.`
        : `Retorno sobre o patrimônio no trimestre (lucro do trimestre dividido pelo patrimônio líquido, sem anualizar): ${formatarFracao(retorno, 1)}.`,
    );
  }

  const balanco: string[] = [];
  if (pl?.atual) {
    const v = variacao(pl.atual, pl.anterior);
    balanco.push(`Patrimônio líquido: ${formatarReais(pl.atual)}${v ? `, ${v} desde o fim do exercício anterior` : ""}.`);
  }
  if (at?.atual) {
    const v = variacao(at.atual, at.anterior);
    balanco.push(`Ativo total: ${formatarReais(at.atual)}${v ? `, ${v} desde o fim do exercício anterior` : ""}.`);
  }
  // identidade contábil: ativo = passivo com terceiros + patrimônio líquido. Só com ativo positivo (divisão protegida).
  if (at?.atual?.gt(0) && pl?.atual) {
    const terceiros = at.atual.minus(pl.atual);
    if (!terceiros.lt(0)) {
      balanco.push(
        `Obrigações com terceiros (ativo total menos patrimônio líquido): ${formatarReais(terceiros)}, ${formatarFracao(terceiros.div(at.atual), 1)} do ativo.`,
      );
    }
  }

  return semVazios([
    { titulo: "O documento", itens: documento },
    { titulo: `Resultado do ${periodoDaDre(d)}`, itens: resultado },
    { titulo: "Balanço na data-base", itens: balanco },
  ]);
}

function destaquesAcao(d: DadosAcao): Destaque[] {
  const destaques: Destaque[] = [];
  const r = receita(d);
  const l = lucro(d);
  const pl = patrimonioLiquido(d);
  const base = baseDaDre(d);

  const varReceita = pctSobreBasePositiva(r?.atual, r?.anterior);
  if (r && varReceita?.gte(CORTE_DE_VARIACAO)) {
    destaques.push({
      titulo: `Receita ${CORTE_DE_VARIACAO}% ou mais acima da base de comparação`,
      detalhe: `${r.conta} subiu ${umaCasa(varReceita)}% contra ${base}.`,
      criterio: `receita ${CORTE_DE_VARIACAO}% ou mais acima da base de comparação`,
    });
  }

  if (l?.atual?.gt(0)) {
    const naBase = l.anterior && !l.anterior.gt(0) ? ` Na base de comparação, o resultado foi de ${formatarReais(l.anterior)}.` : "";
    destaques.push({
      titulo: "Lucro no período",
      detalhe: `${nomeDoLucro(l)}: ${formatarReais(l.atual)}.${naBase}`,
      criterio: "lucro do período acima de zero",
    });

    const varLucro = pctSobreBasePositiva(l.atual, l.anterior);
    if (varLucro?.gte(CORTE_DE_VARIACAO)) {
      destaques.push({
        titulo: `Lucro ${CORTE_DE_VARIACAO}% ou mais acima da base de comparação`,
        detalhe: `${nomeDoLucro(l)} subiu ${umaCasa(varLucro)}% contra ${base}.`,
        criterio: `lucro ${CORTE_DE_VARIACAO}% ou mais acima da base de comparação, com lucro nos dois períodos`,
      });
    }
  }

  if (pl?.atual && pl.anterior && subiuNaTela(pl.atual, pl.anterior)) {
    destaques.push({
      titulo: "Patrimônio líquido maior que no fim do exercício anterior",
      detalhe: `De ${formatarReais(pl.anterior)} para ${formatarReais(pl.atual)} (${variacao(pl.atual, pl.anterior)}).`,
      criterio: "patrimônio líquido acima do fim do exercício anterior",
    });
  }

  return destaques;
}

function alertasAcao(d: DadosAcao): Alerta[] {
  const alertas: Alerta[] = [];
  const r = receita(d);
  const l = lucro(d);
  const pl = patrimonioLiquido(d);
  const base = baseDaDre(d);

  if (l?.atual?.lt(0)) {
    alertas.push({
      titulo: "Prejuízo no período",
      severidade: "critico",
      detalhe: `${nomeDoLucro(l)}: ${formatarReais(l.atual)}.`,
      criterio: "lucro do período abaixo de zero",
    });
  }

  if (pl?.atual?.lt(0)) {
    alertas.push({
      titulo: "Patrimônio líquido negativo",
      severidade: "critico",
      detalhe: `O passivo supera o ativo: patrimônio líquido de ${formatarReais(pl.atual)}.`,
      criterio: "patrimônio líquido abaixo de zero",
    });
  }

  // receita com base zero ou negativa não tem variação que se compare
  const varReceita = r?.anterior?.gt(0) ? pctVariacao(r.atual, r.anterior) : null;
  if (r && varReceita?.lte(-CORTE_DE_VARIACAO)) {
    alertas.push({
      titulo: `Receita ${CORTE_DE_VARIACAO}% ou mais abaixo da base de comparação`,
      severidade: "atencao",
      detalhe: `${r.conta} recuou ${umaCasa(varReceita)}% contra ${base}.`,
      criterio: `receita ${CORTE_DE_VARIACAO}% ou mais abaixo da base de comparação`,
    });
  }

  // lucro que virou prejuízo já tem o alerta de cima; variação sobre base negativa não diz nada
  if (l?.atual && l.anterior && !l.atual.lt(0) && l.anterior.gt(0)) {
    const varLucro = pctVariacao(l.atual, l.anterior);
    if (varLucro?.lte(-CORTE_DE_VARIACAO)) {
      alertas.push({
        titulo: `Lucro ${CORTE_DE_VARIACAO}% ou mais abaixo da base de comparação`,
        severidade: "atencao",
        detalhe: `${nomeDoLucro(l)} recuou ${umaCasa(varLucro)}% contra ${base}.`,
        criterio: `lucro ${CORTE_DE_VARIACAO}% ou mais abaixo da base de comparação, com lucro nos dois períodos`,
      });
    }
  }

  return alertas;
}

function analiseAcao(d: DadosAcao): Resultado {
  return { blocos: blocosAcao(d), destaques: destaquesAcao(d), alertas: alertasAcao(d) };
}

// ---------------------------------------------------------------------------
// FIIs
// ---------------------------------------------------------------------------

type CampoFii = {
  nome: string;
  valor: (i: InformeFii) => Prisma.Decimal | null;
  formato: "reais" | "fracao" | "inteiro";
  definicao: string;
};

// Os campos do informe que viram indicador na tela, na ordem em que aparecem. As taxas (DY e
// rentabilidade) são calculadas pelo administrador do fundo; a definição não inventa a fórmula dele.
const INDICADORES_FII: CampoFii[] = [
  { nome: "Patrimônio líquido", valor: (i) => i.patrimonioLiquido, formato: "reais", definicao: "Ativo do fundo menos o passivo." },
  {
    nome: "Valor patrimonial por cota",
    valor: (i) => i.valorPatrimonialCota,
    formato: "reais",
    definicao: "Patrimônio líquido ÷ número de cotas emitidas.",
  },
  {
    nome: "Dividend yield do mês",
    valor: (i) => i.dividendYieldMes,
    formato: "fracao",
    definicao: "Percentual de rendimento do mês, calculado e informado pelo próprio fundo à CVM.",
  },
  {
    nome: "Rentabilidade efetiva do mês",
    valor: (i) => i.rentabilidadeEfetivaMes,
    formato: "fracao",
    definicao: "Rentabilidade do mês, calculada e informada pelo próprio fundo à CVM.",
  },
  {
    nome: "Número de cotistas",
    valor: (i) => i.cotistas,
    formato: "inteiro",
    definicao: "Quantidade de investidores com cotas do fundo no fim do mês.",
  },
];

function formatarCampo(valor: Prisma.Decimal, formato: CampoFii["formato"]): string {
  if (formato === "reais") return formatarReais(valor);
  if (formato === "fracao") return formatarFracao(valor);
  return inteiro(valor);
}

function indicadoresFii(d: DadosFii): Analise["indicadores"] {
  return INDICADORES_FII.flatMap((c) => {
    const atual = c.valor(d.mes);
    if (!atual) return [];
    // variação percentual de uma taxa (DY, rentabilidade) confunde: fica só o valor do mês
    const v = c.formato === "fracao" || !d.mesAnterior ? null : variacao(atual, c.valor(d.mesAnterior));
    const texto = formatarCampo(atual, c.formato);
    return [{ nome: c.nome, valor: v ? `${texto} (${v} no mês)` : texto, definicao: c.definicao }];
  });
}

/** Passivo acima desta fração do ativo vira ponto de atenção no informe do fundo. */
const PASSIVO_QUE_VIRA_ALERTA = new Prisma.Decimal("0.15");
/** Grupo da carteira abaixo desta fração do ativo não entra na frase da composição. */
const FATIA_QUE_ENTRA_NA_COMPOSICAO = new Prisma.Decimal("0.005");

/**
 * Taxa do mês contra a do mês anterior, na precisão que a tela mostra (duas casas do percentual, quatro
 * da fração). Diferença que some no arredondamento não é movimento: "1,00% para 1,00%" não é queda.
 * -1, 0 ou 1; null sem as duas taxas.
 */
function compararTaxa(atual: Prisma.Decimal | null, anterior: Prisma.Decimal | null | undefined): -1 | 0 | 1 | null {
  if (!atual || !anterior) return null;
  const a = atual.toDecimalPlaces(4);
  const b = anterior.toDecimalPlaces(4);
  return a.gt(b) ? 1 : a.lt(b) ? -1 : 0;
}

/**
 * Os grandes grupos do ativo do fundo, com a fatia de cada um. Usa os totais que somam várias colunas
 * do informe (os mesmos da composição das páginas de ativos) e cai na coluna isolada quando o total
 * não veio. Fica de fora o que é resíduo: a coluna "disponibilidades" de um fundo grande costuma
 * trazer centavos, porque o caixa de verdade está em aplicações de liquidez.
 */
function composicaoDoAtivo(m: InformeFii): string[] {
  const grupos: [string, Prisma.Decimal | null][] = [
    ["imóveis", m.imoveisTotal ?? m.imoveisParaRenda],
    ["títulos de crédito imobiliário (CRI, LCI e similares)", m.papelTotal ?? m.cri],
    ["cotas de outros FIIs", m.cotasDeFii],
    ["caixa e aplicações de liquidez", m.liquidezTotal ?? m.disponibilidades],
  ];
  const ativo = m.valorAtivo?.gt(0) ? m.valorAtivo : null;
  return grupos.flatMap(([nome, valor]) => {
    if (!valor?.gt(0)) return [];
    if (!ativo) return [`${nome}, ${formatarReais(valor)}`];
    const fatia = valor.div(ativo);
    return fatia.lt(FATIA_QUE_ENTRA_NA_COMPOSICAO) ? [] : [`${nome}, ${formatarReais(valor)} (${formatarFracao(fatia, 1)} do ativo)`];
  });
}

function blocosFii(d: DadosFii, rotulo: string): BlocoDoResumo[] {
  const m = d.mes;
  const a = d.mesAnterior;
  const contraOMesAnterior = (atual: Prisma.Decimal, anterior: Prisma.Decimal | null | undefined) => {
    const v = variacao(atual, anterior ?? null);
    return v ? `, ${v} contra o mês anterior` : "";
  };

  const perfil = [d.segmento && `segmento ${d.segmento}`, d.mandato && `mandato ${d.mandato}`, d.tipoGestao && `gestão ${d.tipoGestao}`]
    .filter(Boolean)
    .join(", ");
  const informe = [
    `${d.nome}: informe mensal de ${rotulo}${perfil ? ` (${perfil})` : ""}.`,
    "O Informe Mensal é o documento que o fundo imobiliário entrega à CVM todo mês, com patrimônio, cotas, rendimento e a composição da carteira. As variações são contra o informe do mês anterior.",
  ];

  const cotas: string[] = [];
  if (m.patrimonioLiquido) {
    cotas.push(`Patrimônio líquido: ${formatarReais(m.patrimonioLiquido)}${contraOMesAnterior(m.patrimonioLiquido, a?.patrimonioLiquido)}.`);
  }
  if (m.valorPatrimonialCota) {
    cotas.push(
      `Valor patrimonial por cota: ${formatarReais(m.valorPatrimonialCota)}${contraOMesAnterior(m.valorPatrimonialCota, a?.valorPatrimonialCota)}.`,
    );
  }
  if (m.cotistas) {
    cotas.push(`Cotistas: ${inteiro(m.cotistas)}${contraOMesAnterior(m.cotistas, a?.cotistas)}.`);
  }
  if (m.cotasEmitidas) {
    const mudou = a?.cotasEmitidas && !a.cotasEmitidas.eq(m.cotasEmitidas) ? ` (eram ${inteiro(a.cotasEmitidas)} no mês anterior)` : "";
    const emitiu = a?.cotasEmitidas && m.cotasEmitidas.gt(a.cotasEmitidas)
      ? " Emissão de cotas aumenta o patrimônio e divide os rendimentos por mais cotas."
      : "";
    cotas.push(`Cotas emitidas: ${inteiro(m.cotasEmitidas)}${mudou}.${emitiu}`);
  }

  const rendimento: string[] = [];
  if (m.dividendYieldMes) {
    const antes = a?.dividendYieldMes ? ` (${formatarFracao(a.dividendYieldMes)} no mês anterior)` : "";
    rendimento.push(`Dividend yield do mês, como o fundo informa à CVM: ${formatarFracao(m.dividendYieldMes)}${antes}.`);
  }
  if (m.rentabilidadeEfetivaMes || m.rentabilidadePatrimonialMes) {
    const partes = [
      m.rentabilidadeEfetivaMes && `efetiva de ${formatarFracao(m.rentabilidadeEfetivaMes)}`,
      m.rentabilidadePatrimonialMes && `patrimonial de ${formatarFracao(m.rentabilidadePatrimonialMes)}`,
    ].filter(Boolean);
    rendimento.push(`Rentabilidade no mês: ${partes.join(" e ")}.`);
  }
  if (m.taxaAdministracaoMes) {
    rendimento.push(`Taxa de administração paga no mês: ${formatarFracao(m.taxaAdministracaoMes)} do patrimônio líquido.`);
  }

  const carteira: string[] = [];
  const composicao = composicaoDoAtivo(m);
  if (composicao.length > 0) carteira.push(`Composição do ativo: ${composicao.join("; ")}.`);
  if (m.totalPassivo?.gt(0)) carteira.push(`Total do passivo: ${formatarReais(m.totalPassivo)}.`);

  return semVazios([
    { titulo: "O informe", itens: informe },
    { titulo: "Patrimônio e cotas", itens: cotas },
    { titulo: "Rendimento do mês", itens: rendimento },
    { titulo: "Carteira e passivo", itens: carteira },
  ]);
}

function destaquesFii(d: DadosFii): Destaque[] {
  const destaques: Destaque[] = [];
  const m = d.mes;
  const a = d.mesAnterior;
  if (!a) return destaques;

  if (m.dividendYieldMes && a.dividendYieldMes && compararTaxa(m.dividendYieldMes, a.dividendYieldMes) === 1) {
    destaques.push({
      titulo: "Dividend yield maior que no mês anterior",
      detalhe: `Passou de ${formatarFracao(a.dividendYieldMes)} para ${formatarFracao(m.dividendYieldMes)}.`,
      criterio: "dividend yield do mês acima do informado no mês anterior",
    });
  }

  if (m.rentabilidadeEfetivaMes && a.rentabilidadeEfetivaMes && compararTaxa(m.rentabilidadeEfetivaMes, a.rentabilidadeEfetivaMes) === 1) {
    destaques.push({
      titulo: "Rentabilidade efetiva maior que no mês anterior",
      detalhe: `Passou de ${formatarFracao(a.rentabilidadeEfetivaMes)} para ${formatarFracao(m.rentabilidadeEfetivaMes)}.`,
      criterio: "rentabilidade efetiva do mês acima da informada no mês anterior",
    });
  }

  if (m.valorPatrimonialCota && a.valorPatrimonialCota && subiuNaTela(m.valorPatrimonialCota, a.valorPatrimonialCota)) {
    destaques.push({
      titulo: "Valor patrimonial por cota maior que no mês anterior",
      detalhe: `De ${formatarReais(a.valorPatrimonialCota)} para ${formatarReais(m.valorPatrimonialCota)} (${variacao(m.valorPatrimonialCota, a.valorPatrimonialCota)}).`,
      criterio: "valor patrimonial por cota acima do informado no mês anterior",
    });
  }

  return destaques;
}

function alertasFii(d: DadosFii): Alerta[] {
  const alertas: Alerta[] = [];
  const m = d.mes;
  const a = d.mesAnterior;

  if (a?.dividendYieldMes && m.dividendYieldMes && compararTaxa(m.dividendYieldMes, a.dividendYieldMes) === -1) {
    alertas.push({
      titulo: "Dividend yield menor que no mês anterior",
      severidade: "atencao",
      detalhe: `Passou de ${formatarFracao(a.dividendYieldMes)} para ${formatarFracao(m.dividendYieldMes)}.`,
      criterio: "dividend yield do mês abaixo do informado no mês anterior",
    });
  }

  if (m.totalPassivo && m.valorAtivo?.gt(0)) {
    const fracao = m.totalPassivo.div(m.valorAtivo);
    if (fracao.gt(PASSIVO_QUE_VIRA_ALERTA)) {
      alertas.push({
        titulo: `Passivo acima de ${formatarFracao(PASSIVO_QUE_VIRA_ALERTA, 0)} do ativo`,
        severidade: "atencao",
        detalhe: `O passivo total (${formatarReais(m.totalPassivo)}) equivale a ${formatarFracao(fracao, 1)} do ativo do fundo. O passivo inclui rendimentos a distribuir e obrigações por aquisição de imóveis, além de dívida.`,
        criterio: `passivo total acima de ${formatarFracao(PASSIVO_QUE_VIRA_ALERTA, 0)} do ativo do fundo`,
      });
    }
  }

  // Menos cotistas e novas cotas emitidas eram "para saber" até a versão 2. Não são corte de atenção
  // nem destaque: ficam no bloco "Patrimônio e cotas", com os dois números.
  // Sem alerta de "caixa baixo": a coluna de disponibilidades fica perto de zero em quase todo fundo
  // (o caixa mora em aplicações de liquidez), então o aviso dispararia sempre e não diria nada.

  return alertas;
}

function analiseFii(d: DadosFii, rotulo: string): Resultado {
  return { blocos: blocosFii(d, rotulo), destaques: destaquesFii(d), alertas: alertasFii(d) };
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-03-31" vira "31 de março de 2026". Data que não vier nesse formato sai como veio. */
function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  return m && mes ? `${Number(m[3])} de ${mes} de ${m[1]}` : iso;
}

export function indicadoresCvm(d: DadosCvm): Analise["indicadores"] {
  return d.tipo === "ACAO" ? indicadoresAcao(d) : indicadoresFii(d);
}

export function tipoDocumentoCvm(d: DadosCvm): string {
  if (d.tipo === "FII") return "Informe Mensal de FII";
  return d.documento === "DFP" ? "Demonstrações Financeiras Padronizadas (DFP)" : "Informações Trimestrais (ITR)";
}

/**
 * A análise de um período, montada só com os números entregues à CVM. `rotulo` é o período como a
 * tela o escreve ("1T26", "março de 2026").
 */
export function montarAnalise(d: DadosCvm, rotulo: string): Analise {
  const { blocos, destaques, alertas } = d.tipo === "ACAO" ? analiseAcao(d) : analiseFii(d, rotulo);
  return {
    versao: VERSAO_DA_ANALISE,
    tipoDocumento: tipoDocumentoCvm(d),
    blocos,
    destaques,
    alertas,
    indicadores: indicadoresCvm(d),
    dataReferencia: d.dataReferencia,
    link: d.tipo === "ACAO" ? d.link : null,
  };
}
