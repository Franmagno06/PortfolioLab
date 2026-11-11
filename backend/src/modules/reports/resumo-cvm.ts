import { Prisma } from "@prisma/client";
import { VERSAO_DA_ANALISE, type Analise } from "./analise.js";
import type { ContaCvm, DadosAcao, DadosFii, InformeFii } from "./cvm.provider.js";

// Transforma os números da CVM na análise que a tela mostra: indicadores, um resumo em frases e
// pontos de atenção. Tudo por regra fixa. Três cuidados valem para o arquivo inteiro:
// - nenhum número é escrito aqui: todos vêm de `DadosCvm` ou de uma conta feita com eles;
// - nenhuma frase julga ("saudável", "robusto", "preocupante") nem recomenda: diz o fato e a conta;
// - mudou o que este arquivo escreve ou calcula? Suba VERSAO_DA_ANALISE (analise.ts), ou o cache
//   continua servindo o texto antigo.

export type DadosCvm = DadosAcao | DadosFii;

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

/** Variação percentual de `anterior` para `atual`, com sinal: "+12,5%". Null quando não há base. */
export function variacao(atual: Prisma.Decimal | null, anterior: Prisma.Decimal | null): string | null {
  const pct = pctVariacao(atual, anterior)?.toDecimalPlaces(1);
  if (!pct) return null;
  // o que arredonda para zero sai sem sinal: "-0,0%" e "+0,0%" sugerem um movimento que não houve
  if (pct.isZero()) return "0,0%";
  const texto = pct.toNumber().toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return pct.isNegative() ? `${texto}%` : `+${texto}%`;
}

const inteiro = (d: Prisma.Decimal) => d.toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = (d: Prisma.Decimal) => d.abs().toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 1 });

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

const nomeDoLucro = (l: ContaCvm) => (/controladora/i.test(l.conta) ? "Lucro líquido atribuído aos controladores" : l.conta);

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
  if (!l || !pl || !pl.isPositive()) return null;
  return l.div(pl);
}

function margemLiquida(d: DadosAcao): Prisma.Decimal | null {
  const r = receita(d);
  const l = lucro(d)?.atual;
  if (!r?.atual || !l || !r.atual.isPositive() || !temReceitaDeVenda(r)) return null;
  return l.div(r.atual);
}

function indicadoresAcao(d: DadosAcao): Analise["indicadores"] {
  const indicadores: Analise["indicadores"] = [];
  const r = receita(d);
  const l = lucro(d);
  const pl = patrimonioLiquido(d);
  const at = ativoTotal(d);
  const margem = margemLiquida(d);
  const retorno = retornoSobrePatrimonio(d);

  if (r) indicadores.push({ nome: r.conta, valor: comVariacao(r) });
  if (l) indicadores.push({ nome: nomeDoLucro(l), valor: comVariacao(l) });
  if (margem) indicadores.push({ nome: "Margem líquida", valor: formatarFracao(margem, 1) });
  if (retorno) {
    indicadores.push({ nome: `Retorno sobre o patrimônio no ${periodoDaDre(d)}`, valor: formatarFracao(retorno, 1) });
  }
  if (pl) indicadores.push({ nome: "Patrimônio líquido", valor: comVariacao(pl) });
  if (at?.atual) indicadores.push({ nome: "Ativo total", valor: comVariacao(at) });
  return indicadores;
}

function analiseAcao(d: DadosAcao): Pick<Analise, "resumoExecutivo" | "alertas"> {
  const resumoExecutivo: string[] = [];
  const alertas: Analise["alertas"] = [];
  const r = receita(d);
  const l = lucro(d);
  const pl = patrimonioLiquido(d);
  const at = ativoTotal(d);
  const margem = margemLiquida(d);
  const retorno = retornoSobrePatrimonio(d);
  const base = baseDaDre(d);

  resumoExecutivo.push(
    `${d.denominacao}: demonstrações ${d.consolidado ? "consolidadas" : "individuais"} do ${periodoDaDre(d)} ` +
      `encerrado em ${dataPorExtenso(d.dataReferencia)}. O resultado é comparado com ${base}; ` +
      `o balanço, com o fim do exercício anterior.`,
  );

  if (r?.atual) {
    const v = variacao(r.atual, r.anterior);
    resumoExecutivo.push(`${r.conta}: ${formatarReais(r.atual)}${v ? `, ${v} contra ${base}` : ""}.`);
  }
  if (l?.atual) {
    const v = variacao(l.atual, l.anterior);
    resumoExecutivo.push(`${nomeDoLucro(l)}: ${formatarReais(l.atual)}${v ? `, ${v} contra ${base}` : ""}.`);
  }
  if (margem) {
    resumoExecutivo.push(`Margem líquida (lucro dividido pela receita): ${formatarFracao(margem, 1)}.`);
  }
  if (retorno) {
    resumoExecutivo.push(
      d.documento === "DFP"
        ? `Retorno sobre o patrimônio no exercício (lucro dividido pelo patrimônio líquido): ${formatarFracao(retorno, 1)}.`
        : `Retorno sobre o patrimônio no trimestre (lucro do trimestre dividido pelo patrimônio líquido, sem anualizar): ${formatarFracao(retorno, 1)}.`,
    );
  }
  if (pl?.atual) {
    const v = variacao(pl.atual, pl.anterior);
    resumoExecutivo.push(`Patrimônio líquido: ${formatarReais(pl.atual)}${v ? `, ${v} desde o fim do exercício anterior` : ""}.`);
  }
  if (at?.atual) {
    const v = variacao(at.atual, at.anterior);
    resumoExecutivo.push(`Ativo total: ${formatarReais(at.atual)}${v ? `, ${v} desde o fim do exercício anterior` : ""}.`);
  }

  if (l?.atual?.isNegative()) {
    alertas.push({
      titulo: "Prejuízo no período",
      severidade: "critico",
      detalhe: `${nomeDoLucro(l)}: ${formatarReais(l.atual)}.`,
    });
  }

  if (pl?.atual?.isNegative()) {
    alertas.push({
      titulo: "Patrimônio líquido negativo",
      severidade: "critico",
      detalhe: `O passivo supera o ativo: patrimônio líquido de ${formatarReais(pl.atual)}.`,
    });
  }

  const varReceita = pctVariacao(r?.atual ?? null, r?.anterior ?? null);
  if (r && varReceita && varReceita.lte(-QUEDA_QUE_VIRA_ALERTA)) {
    alertas.push({
      titulo: `Receita ${QUEDA_QUE_VIRA_ALERTA}% ou mais abaixo da base de comparação`,
      severidade: "atencao",
      detalhe: `${r.conta} recuou ${umaCasa(varReceita)}% contra ${base}.`,
    });
  }

  // lucro que virou prejuízo já tem o alerta de cima; variação sobre base negativa não diz nada
  if (l?.atual && l.anterior && !l.atual.isNegative() && l.anterior.isPositive()) {
    const varLucro = pctVariacao(l.atual, l.anterior);
    if (varLucro && varLucro.lte(-QUEDA_QUE_VIRA_ALERTA)) {
      alertas.push({
        titulo: `Lucro ${QUEDA_QUE_VIRA_ALERTA}% ou mais abaixo da base de comparação`,
        severidade: "atencao",
        detalhe: `${nomeDoLucro(l)} recuou ${umaCasa(varLucro)}% contra ${base}.`,
      });
    }
  }

  return { resumoExecutivo, alertas };
}

/** Queda, em %, a partir da qual receita ou lucro viram ponto de atenção. Um corte fixo, não um juízo. */
const QUEDA_QUE_VIRA_ALERTA = 15;

// ---------------------------------------------------------------------------
// FIIs
// ---------------------------------------------------------------------------

type CampoFii = {
  nome: string;
  valor: (i: InformeFii) => Prisma.Decimal | null;
  formato: "reais" | "fracao" | "inteiro";
};

// Os campos do informe que viram indicador na tela, na ordem em que aparecem.
const INDICADORES_FII: CampoFii[] = [
  { nome: "Patrimônio líquido", valor: (i) => i.patrimonioLiquido, formato: "reais" },
  { nome: "Valor patrimonial por cota", valor: (i) => i.valorPatrimonialCota, formato: "reais" },
  { nome: "Dividend yield do mês", valor: (i) => i.dividendYieldMes, formato: "fracao" },
  { nome: "Rentabilidade efetiva do mês", valor: (i) => i.rentabilidadeEfetivaMes, formato: "fracao" },
  { nome: "Número de cotistas", valor: (i) => i.cotistas, formato: "inteiro" },
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
    return [{ nome: c.nome, valor: v ? `${texto} (${v} no mês)` : texto }];
  });
}

/** Passivo acima desta fração do ativo vira ponto de atenção no informe do fundo. */
const PASSIVO_QUE_VIRA_ALERTA = new Prisma.Decimal("0.15");
/** Grupo da carteira abaixo desta fração do ativo não entra na frase da composição. */
const FATIA_QUE_ENTRA_NA_COMPOSICAO = new Prisma.Decimal("0.005");

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
  const ativo = m.valorAtivo?.isPositive() ? m.valorAtivo : null;
  return grupos.flatMap(([nome, valor]) => {
    if (!valor?.isPositive()) return [];
    if (!ativo) return [`${nome}, ${formatarReais(valor)}`];
    const fatia = valor.div(ativo);
    return fatia.lt(FATIA_QUE_ENTRA_NA_COMPOSICAO) ? [] : [`${nome}, ${formatarReais(valor)} (${formatarFracao(fatia, 1)} do ativo)`];
  });
}

function analiseFii(d: DadosFii, rotulo: string): Pick<Analise, "resumoExecutivo" | "alertas"> {
  const resumoExecutivo: string[] = [];
  const alertas: Analise["alertas"] = [];
  const m = d.mes;
  const a = d.mesAnterior;
  const contraOMesAnterior = (atual: Prisma.Decimal, anterior: Prisma.Decimal | null | undefined) => {
    const v = variacao(atual, anterior ?? null);
    return v ? `, ${v} contra o mês anterior` : "";
  };

  const perfil = [d.segmento && `segmento ${d.segmento}`, d.mandato && `mandato ${d.mandato}`, d.tipoGestao && `gestão ${d.tipoGestao}`]
    .filter(Boolean)
    .join(", ");
  resumoExecutivo.push(`${d.nome}: informe mensal de ${rotulo}${perfil ? ` (${perfil})` : ""}.`);

  if (m.patrimonioLiquido) {
    resumoExecutivo.push(
      `Patrimônio líquido: ${formatarReais(m.patrimonioLiquido)}${contraOMesAnterior(m.patrimonioLiquido, a?.patrimonioLiquido)}.`,
    );
  }
  if (m.valorPatrimonialCota) {
    resumoExecutivo.push(
      `Valor patrimonial por cota: ${formatarReais(m.valorPatrimonialCota)}${contraOMesAnterior(m.valorPatrimonialCota, a?.valorPatrimonialCota)}.`,
    );
  }
  if (m.dividendYieldMes) {
    const antes = a?.dividendYieldMes ? ` (${formatarFracao(a.dividendYieldMes)} no mês anterior)` : "";
    resumoExecutivo.push(`Dividend yield do mês, como o fundo informa à CVM: ${formatarFracao(m.dividendYieldMes)}${antes}.`);
  }
  if (m.rentabilidadeEfetivaMes || m.rentabilidadePatrimonialMes) {
    const partes = [
      m.rentabilidadeEfetivaMes && `efetiva de ${formatarFracao(m.rentabilidadeEfetivaMes)}`,
      m.rentabilidadePatrimonialMes && `patrimonial de ${formatarFracao(m.rentabilidadePatrimonialMes)}`,
    ].filter(Boolean);
    resumoExecutivo.push(`Rentabilidade no mês: ${partes.join(" e ")}.`);
  }
  if (m.cotistas) {
    resumoExecutivo.push(`Cotistas: ${inteiro(m.cotistas)}${contraOMesAnterior(m.cotistas, a?.cotistas)}.`);
  }
  if (m.cotasEmitidas) {
    const mudou = a?.cotasEmitidas && !a.cotasEmitidas.eq(m.cotasEmitidas) ? ` (eram ${inteiro(a.cotasEmitidas)} no mês anterior)` : "";
    resumoExecutivo.push(`Cotas emitidas: ${inteiro(m.cotasEmitidas)}${mudou}.`);
  }

  const carteira = composicaoDoAtivo(m);
  if (carteira.length > 0) resumoExecutivo.push(`Composição do ativo: ${carteira.join("; ")}.`);

  if (m.totalPassivo?.isPositive()) resumoExecutivo.push(`Total do passivo: ${formatarReais(m.totalPassivo)}.`);
  if (m.taxaAdministracaoMes) {
    resumoExecutivo.push(`Taxa de administração paga no mês: ${formatarFracao(m.taxaAdministracaoMes)} do patrimônio líquido.`);
  }

  if (a?.dividendYieldMes && m.dividendYieldMes && m.dividendYieldMes.lt(a.dividendYieldMes)) {
    alertas.push({
      titulo: "Dividend yield menor que no mês anterior",
      severidade: "atencao",
      detalhe: `Passou de ${formatarFracao(a.dividendYieldMes)} para ${formatarFracao(m.dividendYieldMes)}.`,
    });
  }

  if (m.totalPassivo && m.valorAtivo?.isPositive()) {
    const fracao = m.totalPassivo.div(m.valorAtivo);
    if (fracao.gt(PASSIVO_QUE_VIRA_ALERTA)) {
      alertas.push({
        titulo: `Passivo acima de ${formatarFracao(PASSIVO_QUE_VIRA_ALERTA, 0)} do ativo`,
        severidade: "atencao",
        detalhe: `O passivo total (${formatarReais(m.totalPassivo)}) equivale a ${formatarFracao(fracao, 1)} do ativo do fundo. O passivo inclui rendimentos a distribuir e obrigações por aquisição de imóveis, além de dívida.`,
      });
    }
  }

  if (a?.cotistas && m.cotistas && m.cotistas.lt(a.cotistas)) {
    alertas.push({
      titulo: "Menos cotistas que no mês anterior",
      severidade: "info",
      detalhe: `De ${inteiro(a.cotistas)} para ${inteiro(m.cotistas)}: ${inteiro(a.cotistas.minus(m.cotistas))} a menos.`,
    });
  }

  if (a?.cotasEmitidas && m.cotasEmitidas && m.cotasEmitidas.gt(a.cotasEmitidas)) {
    alertas.push({
      titulo: "Novas cotas emitidas no mês",
      severidade: "info",
      detalhe: `De ${inteiro(a.cotasEmitidas)} para ${inteiro(m.cotasEmitidas)} cotas. Emissão aumenta o patrimônio e divide os rendimentos por mais cotas.`,
    });
  }

  // Sem alerta de "caixa baixo": a coluna de disponibilidades fica perto de zero em quase todo fundo
  // (o caixa mora em aplicações de liquidez), então o aviso dispararia sempre e não diria nada.

  return { resumoExecutivo, alertas };
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
  const { resumoExecutivo, alertas } = d.tipo === "ACAO" ? analiseAcao(d) : analiseFii(d, rotulo);
  return {
    versao: VERSAO_DA_ANALISE,
    tipoDocumento: tipoDocumentoCvm(d),
    resumoExecutivo,
    alertas,
    indicadores: indicadoresCvm(d),
    dataReferencia: d.dataReferencia,
    link: d.tipo === "ACAO" ? d.link : null,
  };
}
