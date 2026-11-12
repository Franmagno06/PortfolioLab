/**
 * As contas dos exemplos de /aprender, feitas em código e não à mão. A página "Como o site calcula"
 * mostra o resultado destas funções, então o número na tela e a regra não têm como divergir; e
 * exemplos.test.ts confere cada número que os artigos escrevem em texto.
 *
 * Dinheiro aqui é número inteiro de CENTAVOS, nunca ponto flutuante: 0,1 + 0,2 não é 0,3 em
 * binário. (O backend usa Prisma.Decimal; o front não tem Decimal, e um exemplo didático não
 * precisa de mais que centavos inteiros.)
 */

export type Centavos = number;

export const emCentavos = (reais: number): Centavos => Math.round(reais * 100);

/** Divisão inteira, sem passar por ponto flutuante: o resto é descartado. */
function divisaoInteira(a: number, b: number): number {
  return (a - (a % b)) / b;
}

/** Divisão que arredonda para o centavo mais próximo (metade sobe). */
function divisaoArredondada(a: number, b: number): number {
  return divisaoInteira(2 * a + b, 2 * b);
}

export type Posicao = { quantidade: number; pmCentavos: Centavos };

/**
 * Preço médio depois de uma compra, pela regra da Receita Federal: a taxa entra no custo.
 * PM = (qtd × PM + qtdCompra × preço + taxa) ÷ (qtd + qtdCompra).
 */
export function depoisDaCompra(
  antes: Posicao,
  compra: { quantidade: number; precoCentavos: Centavos; taxaCentavos: Centavos },
): Posicao {
  const quantidade = antes.quantidade + compra.quantidade;
  const custoTotal = antes.quantidade * antes.pmCentavos + compra.quantidade * compra.precoCentavos + compra.taxaCentavos;
  return { quantidade, pmCentavos: divisaoArredondada(custoTotal, quantidade) };
}

/** Uma venda reduz a quantidade e NÃO mexe no preço médio. Se zerar a posição, o PM volta a zero. */
export function depoisDaVenda(antes: Posicao, quantidade: number): Posicao {
  if (quantidade > antes.quantidade) throw new Error("Não dá para vender mais do que se tem.");
  const restante = antes.quantidade - quantidade;
  return { quantidade: restante, pmCentavos: restante === 0 ? 0 : antes.pmCentavos };
}

/** Dividend yield em %: proventos dos últimos 12 meses ÷ preço. */
export function dividendYieldPct(proventos12mCentavos: Centavos, precoCentavos: Centavos): number {
  return (proventos12mCentavos / precoCentavos) * 100;
}

export type MetaDeExemplo = { ticker: string; metaPct: number; precoCentavos: Centavos; posicaoCentavos: Centavos };
export type CompraDeExemplo = {
  ticker: string;
  metaPct: number;
  /** meta% × (patrimônio + aporte) − posição. Negativo ou zero: o ativo está na meta ou acima dela. */
  deficitCentavos: Centavos;
  /** A fatia do aporte proporcional ao déficit (aporte × déficit ÷ soma dos déficits), arredondada ao centavo. 0 para quem não tem déficit. */
  fatiaCentavos: Centavos;
  precoCentavos: Centavos;
  /** Cotas compradas na primeira passada, com a fatia. */
  cotasNaFatia: number;
  /** Cotas compradas na segunda passada, com o troco. */
  cotasNoTroco: number;
  cotas: number;
  custoCentavos: Centavos;
};

/**
 * O aporte como o backend calcula (backend/src/modules/rebalance/rebalance.service.ts, calcularAporte):
 *
 * 1. patrimônio projetado = patrimônio atual + aporte;
 * 2. déficit de cada ativo = meta% × patrimônio projetado − posição atual. Quem tem déficit ≤ 0 (na meta ou acima)
 *    não recebe nada;
 * 3. ordem: maior déficit primeiro; empate, menor preço; depois o ticker;
 * 4. primeira passada, na fatia proporcional: cada ativo com déficit recebe aporte × déficit ÷ soma dos déficits,
 *    limitada ao próprio déficit e ao dinheiro que sobrou, e compra ⌊fatia ÷ preço⌋ cotas inteiras;
 * 5. segunda passada, no troco: enquanto der, o ativo com o maior déficit que ainda falta (déficit − o que já
 *    recebeu), entre os que ainda cabem uma cota no déficit e no dinheiro, compra ⌊min(o que falta, troco) ÷ preço⌋
 *    cotas. O mesmo desempate da ordem inicial.
 *
 * Tudo em centavos inteiros: ⌊min(a, b, c) ÷ p⌋ = min(⌊a ÷ p⌋, ⌊b ÷ p⌋, ⌊c ÷ p⌋), então a fatia fracionária
 * (aporte × déficit ÷ soma) entra como a fração exata, sem arredondar antes de dividir pelo preço.
 */
export function aporteDeExemplo(
  metas: readonly MetaDeExemplo[],
  aporteCentavos: Centavos,
): { compras: CompraDeExemplo[]; sobraCentavos: Centavos } {
  const patrimonio = metas.reduce((soma, m) => soma + m.posicaoCentavos, 0) + aporteCentavos;
  const ordem = (a: { d: number; precoCentavos: number; ticker: string }, b: { d: number; precoCentavos: number; ticker: string }) =>
    b.d - a.d || a.precoCentavos - b.precoCentavos || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0);

  const comDeficit = metas
    .map((m) => ({ ...m, deficitCentavos: divisaoArredondada(m.metaPct * patrimonio, 100) - m.posicaoCentavos }))
    .map((m) => ({ ...m, d: m.deficitCentavos }))
    .sort(ordem);

  const elegiveis = comDeficit.filter((m) => m.precoCentavos > 0 && m.deficitCentavos > 0);
  const deficitTotal = elegiveis.reduce((soma, m) => soma + m.deficitCentavos, 0);

  let restante = aporteCentavos;
  const gasto = new Map<string, Centavos>(elegiveis.map((m) => [m.ticker, 0]));
  const naFatia = new Map<string, number>();
  const noTroco = new Map<string, number>();

  // Primeira passada: a fatia proporcional ao déficit.
  for (const m of elegiveis) {
    if (deficitTotal === 0) break;
    const cotas = Math.min(
      divisaoInteira(aporteCentavos * m.deficitCentavos, deficitTotal * m.precoCentavos),
      divisaoInteira(m.deficitCentavos, m.precoCentavos),
      divisaoInteira(restante, m.precoCentavos),
    );
    naFatia.set(m.ticker, cotas);
    restante -= cotas * m.precoCentavos;
    gasto.set(m.ticker, cotas * m.precoCentavos);
  }

  // Segunda passada: o troco vai para quem continua mais longe da meta.
  const falta = (m: (typeof elegiveis)[number]) => m.deficitCentavos - (gasto.get(m.ticker) ?? 0);
  for (;;) {
    const alvo = elegiveis
      .filter((m) => falta(m) >= m.precoCentavos && restante >= m.precoCentavos)
      .map((m) => ({ ...m, d: falta(m) }))
      .sort(ordem)[0];
    if (!alvo) break;
    const cotas = divisaoInteira(Math.min(falta(alvo), restante), alvo.precoCentavos);
    if (cotas <= 0) break;
    noTroco.set(alvo.ticker, (noTroco.get(alvo.ticker) ?? 0) + cotas);
    restante -= cotas * alvo.precoCentavos;
    gasto.set(alvo.ticker, (gasto.get(alvo.ticker) ?? 0) + cotas * alvo.precoCentavos);
  }

  const compras = comDeficit.map((m): CompraDeExemplo => {
    const elegivel = gasto.has(m.ticker);
    const cotasNaFatia = naFatia.get(m.ticker) ?? 0;
    const cotasNoTroco = noTroco.get(m.ticker) ?? 0;
    const cotas = cotasNaFatia + cotasNoTroco;
    return {
      ticker: m.ticker,
      metaPct: m.metaPct,
      deficitCentavos: m.deficitCentavos,
      fatiaCentavos: elegivel && deficitTotal > 0 ? divisaoArredondada(aporteCentavos * m.deficitCentavos, deficitTotal) : 0,
      precoCentavos: m.precoCentavos,
      cotasNaFatia,
      cotasNoTroco,
      cotas,
      custoCentavos: cotas * m.precoCentavos,
    };
  });
  return { compras, sobraCentavos: restante };
}

/**
 * O exemplo de aporte dos textos (artigo rebalancear-com-aportes e /aprender/como-calculamos): R$ 1.000 numa
 * carteira de R$ 7.000 com metas de 50%, 30% e 20%. Ativos fictícios, com nomes genéricos.
 */
export const EXEMPLO_DE_APORTE = {
  aporteCentavos: emCentavos(1000),
  metas: [
    { ticker: "Ativo A", metaPct: 50, precoCentavos: emCentavos(30), posicaoCentavos: emCentavos(3000) },
    { ticker: "Ativo B", metaPct: 30, precoCentavos: emCentavos(50), posicaoCentavos: emCentavos(3000) },
    { ticker: "Ativo C", metaPct: 20, precoCentavos: emCentavos(100), posicaoCentavos: emCentavos(1000) },
  ] satisfies MetaDeExemplo[],
} as const;

/** Valor depois de `periodos` períodos a `taxaPct` por período, com juros sobre juros. */
export function jurosCompostos(inicialCentavos: Centavos, taxaPct: number, periodos: number): Centavos {
  return Math.round(inicialCentavos * (1 + taxaPct / 100) ** periodos);
}

/** Rendimento bruto de um ano a uma taxa anual: a conta simples dos artigos (sem dia útil nem IOF). */
export function rendimentoDeUmAno(aplicadoCentavos: Centavos, taxaAnualPct: number): Centavos {
  return Math.round((aplicadoCentavos * taxaAnualPct) / 100);
}

/** Quanto um valor de hoje compra depois de uma inflação acumulada de `inflacaoPct`. */
export function poderDeCompra(valorCentavos: Centavos, inflacaoPct: number): Centavos {
  return Math.round(valorCentavos / (1 + inflacaoPct / 100));
}

/**
 * Alíquota do IR sobre o rendimento da renda fixa (CDB, Tesouro), pela tabela regressiva da Lei 11.033/2004,
 * art. 1º: 22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720 e 15% acima de 720.
 */
export function aliquotaDeIrNaRendaFixa(dias: number): number {
  if (dias <= 180) return 22.5;
  if (dias <= 360) return 20;
  if (dias <= 720) return 17.5;
  return 15;
}

/** IR retido e rendimento líquido, para um rendimento bruto mantido por `dias` dias. */
export function rendimentoLiquido(rendimentoCentavos: Centavos, dias: number): { aliquotaPct: number; irCentavos: Centavos; liquidoCentavos: Centavos } {
  const aliquotaPct = aliquotaDeIrNaRendaFixa(dias);
  const irCentavos = Math.round((rendimentoCentavos * aliquotaPct) / 100);
  return { aliquotaPct, irCentavos, liquidoCentavos: rendimentoCentavos - irCentavos };
}

/** O % do CDI que um CDB precisa pagar para empatar com um título isento (LCI, LCA) que paga `isentoPctDoCdi`. */
export function cdbEquivalente(isentoPctDoCdi: number, aliquotaPct: number): number {
  return isentoPctDoCdi / (1 - aliquotaPct / 100);
}

/** Taxa total de um título "inflação + juro": (1 + inflação) × (1 + juro) − 1, em %. */
export function inflacaoMaisJuro(inflacaoPct: number, juroPct: number): number {
  return ((1 + inflacaoPct / 100) * (1 + juroPct / 100) - 1) * 100;
}

/** Uma razão em %, para os indicadores: parte ÷ todo × 100. */
export function razaoPct(parte: number, todo: number): number {
  return (parte / todo) * 100;
}

/**
 * Dados públicos usados nos exemplos, com fonte e data. Conferidos em 15/10/2026 na API aberta do Banco Central
 * (https://api.bcb.gov.br/dados/serie/bcdata.sgs.<série>/dados/ultimos/N?formato=json) e no site do FGC.
 * Números de mercado mudam: ao atualizar, troque o valor E a data, nunca só o valor.
 *
 * A série 432 (Selic meta) lista dias FUTUROS, até a próxima reunião do Copom: a data do último ponto não é a
 * data da consulta. Por isso aqui vai a data em que o número foi conferido.
 */
export const DADOS_PUBLICOS = {
  selicMeta: { valorPct: 13.75, fonte: "Banco Central, série SGS 432", conferidoEm: "2026-10-15" },
  cdi: { valorPct: 13.65, fonte: "Banco Central, série SGS 4389", em: "2026-10-14" },
  ipca12m: { valorPct: 4.58, referencia: "setembro de 2026", fonte: "IBGE, via Banco Central, série SGS 13522" },
  ipcaMensal: { valorPct: 0.82, referencia: "setembro de 2026", fonte: "IBGE, via Banco Central, série SGS 433" },
  fgc: {
    porInstituicaoReais: 250_000,
    tetoGlobalReais: 1_000_000,
    janelaAnos: 4,
    fonte: "FGC, Sobre a garantia",
    url: "https://www.fgc.org.br/sobre-garantia-fgc",
    conferidoEm: "2026-10-15",
  },
} as const;


/** Ponto da simulação de juros compostos com aportes mensais regulares. */
export type PontoJurosCompostos = {
  ano: number;
  rotulo: string;
  investido: number;
  juros: number;
  total: number;
};

/**
 * Simula a evolução patrimonial com aportes mensais constantes a uma taxa anual fixa.
 * O aporte mensal é capitalizado todo mês pela taxa efetiva mensal equivalente: i = (1 + taxaAnual)^(1/12) - 1.
 */
export function simularJurosCompostosAportes(
  aporteMensalCentavos: Centavos,
  taxaAnualPct: number,
  anos: number,
): PontoJurosCompostos[] {
  const taxaMensal = (1 + taxaAnualPct / 100) ** (1 / 12) - 1;
  const aporteReais = aporteMensalCentavos / 100;
  const pontos: PontoJurosCompostos[] = [
    { ano: 0, rotulo: "Ano 0", investido: 0, juros: 0, total: 0 },
  ];

  let acumulado = 0;
  for (let ano = 1; ano <= anos; ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      acumulado = (acumulado + aporteReais) * (1 + taxaMensal);
    }
    const investido = Math.round(ano * 12 * aporteReais);
    const total = Math.round(acumulado);
    const juros = Math.max(0, total - investido);
    pontos.push({
      ano,
      rotulo: `Ano ${ano}`,
      investido,
      juros,
      total,
    });
  }

  return pontos;
}

/** Proventos INVENTADOS de dois fundos imaginários, mês a mês, por cota: não são de nenhum fundo real. */
export const PROVENTOS_HIPOTETICOS_DE_FII = [
  { mes: "Mês 1", tijolo: 0.72, papel: 1.1 },
  { mes: "Mês 2", tijolo: 0.73, papel: 1.15 },
  { mes: "Mês 3", tijolo: 0.72, papel: 0.95 },
  { mes: "Mês 4", tijolo: 0.74, papel: 0.8 },
  { mes: "Mês 5", tijolo: 0.73, papel: 0.65 },
  { mes: "Mês 6", tijolo: 0.73, papel: 0.7 },
  { mes: "Mês 7", tijolo: 0.74, papel: 0.85 },
  { mes: "Mês 8", tijolo: 0.75, papel: 1.05 },
  { mes: "Mês 9", tijolo: 0.73, papel: 1.12 },
  { mes: "Mês 10", tijolo: 0.74, papel: 1.18 },
  { mes: "Mês 11", tijolo: 0.73, papel: 0.98 },
  { mes: "Mês 12", tijolo: 0.75, papel: 0.92 },
] as const;

export type PresetGraficoArtigo =
  | "juros-compostos"
  | "pl-setorial"
  | "renda-fixa-curva"
  | "ir-aliquotas"
  | "fiis-proventos";

export type ModoGraficoArtigo = "area" | "barras";
export type FormatoGraficoArtigo = "moeda" | "percentual" | "multiplicador" | "numero";

export type SerieGraficoArtigo = {
  chave: string;
  nome: string;
  cor: string;
};

export type CenarioGraficoArtigo = {
  id: string;
  rotulo: string;
  descricao?: string;
  dados: Record<string, unknown>[];
  series: SerieGraficoArtigo[];
  eixoX: string;
};

export type DefinicaoPresetGrafico = {
  modoPadrao: ModoGraficoArtigo;
  titulo: string;
  descricao: string;
  formato: FormatoGraficoArtigo;
  cenarios: CenarioGraficoArtigo[];
};

/**
 * IR dos ETFs de renda fixa (Lei 13.043/2014, art. 2º, conferida no Planalto em 12/11/2026): retido na fonte, pelo
 * prazo médio de repactuação da carteira do fundo, e não pelo tempo que a pessoa ficou com a cota.
 */
export const ALIQUOTAS_ETF_RENDA_FIXA = { ate180: 25, ate720: 20, acima720: 15 } as const;

export const PRESETS_GRAFICO_ARTIGO: Record<PresetGraficoArtigo, DefinicaoPresetGrafico> = {
  "juros-compostos": {
    modoPadrao: "area",
    titulo: "Evolução dos juros compostos: R$ 500/mês a 10% a.a. (taxa hipotética)",
    descricao: "Taxa hipotética de 10% ao ano, antes de imposto e inflação. Comparação entre o total investido do próprio bolso e o montante gerado pelos juros sobre juros ao longo do tempo.",
    formato: "moeda",
    cenarios: [
      {
        id: "10-anos",
        rotulo: "10 anos",
        descricao: "Em 10 anos, os juros acumulados já começam a se aproximar do total investido.",
        eixoX: "rotulo",
        dados: simularJurosCompostosAportes(emCentavos(500), 10, 10),
        series: [
          { chave: "investido", nome: "Total investido", cor: "#5d6b7f" },
          { chave: "juros", nome: "Juros acumulados", cor: "#1e9e63" },
          { chave: "total", nome: "Patrimônio total", cor: "#5b3fd0" },
        ],
      },
      {
        id: "20-anos",
        rotulo: "20 anos",
        descricao: "Em 20 anos, os juros acumulados ultrapassam o dobro de todo o valor investido.",
        eixoX: "rotulo",
        dados: simularJurosCompostosAportes(emCentavos(500), 10, 20),
        series: [
          { chave: "investido", nome: "Total investido", cor: "#5d6b7f" },
          { chave: "juros", nome: "Juros acumulados", cor: "#1e9e63" },
          { chave: "total", nome: "Patrimônio total", cor: "#5b3fd0" },
        ],
      },
      {
        id: "30-anos",
        rotulo: "30 anos",
        descricao: "Em 30 anos, mais de 80% do patrimônio final é composto exclusivamente de juros acumulados.",
        eixoX: "rotulo",
        dados: simularJurosCompostosAportes(emCentavos(500), 10, 30),
        series: [
          { chave: "investido", nome: "Total investido", cor: "#5d6b7f" },
          { chave: "juros", nome: "Juros acumulados", cor: "#1e9e63" },
          { chave: "total", nome: "Patrimônio total", cor: "#5b3fd0" },
        ],
      },
    ],
  },

  "pl-setorial": {
    modoPadrao: "barras",
    titulo: "Múltiplos por tipo de setor (exemplo hipotético)",
    descricao:
      "Números inventados para mostrar a ideia, não são médias de setores da B3: o mesmo P/L quer dizer coisas diferentes conforme o lucro do setor oscila mais ou menos.",
    formato: "multiplicador",
    cenarios: [
      {
        id: "pl",
        rotulo: "P/L (hipotético)",
        descricao: "P/L de três setores imaginários. No setor cíclico, o lucro do ano está no pico, e o P/L sai baixo por isso.",
        eixoX: "setor",
        dados: [
          { setor: "Setor A (cíclico, lucro no pico)", valor: 5, descricao: "Exemplo hipotético: lucro do ano acima do normal do ciclo" },
          { setor: "Setor B (receita regulada)", valor: 10, descricao: "Exemplo hipotético: lucro que varia pouco de um ano para o outro" },
          { setor: "Setor C (crescimento esperado)", valor: 20, descricao: "Exemplo hipotético: o preço já embute um lucro maior no futuro" },
        ],
        series: [{ chave: "valor", nome: "P/L (vezes, hipotético)", cor: "#5b3fd0" }],
      },
      {
        id: "pvp",
        rotulo: "P/VP (hipotético)",
        descricao: "P/VP dos mesmos três setores imaginários. O patrimônio contábil pesa diferente em cada negócio.",
        eixoX: "setor",
        dados: [
          { setor: "Setor A (cíclico, lucro no pico)", valor: 1, descricao: "Exemplo hipotético: muito capital físico no balanço" },
          { setor: "Setor B (receita regulada)", valor: 1.5, descricao: "Exemplo hipotético" },
          { setor: "Setor C (crescimento esperado)", valor: 3, descricao: "Exemplo hipotético: marca e tecnologia quase não aparecem no patrimônio" },
        ],
        series: [{ chave: "valor", nome: "P/VP (vezes, hipotético)", cor: "#7359e5" }],
      },
    ],
  },

  "renda-fixa-curva": {
    modoPadrao: "area",
    titulo: "Formatos da curva de juros (exemplo hipotético)",
    descricao:
      "Taxas inventadas para mostrar os dois formatos mais comuns da curva: não são as taxas de hoje nem as do DI futuro negociado na B3.",
    formato: "percentual",
    cenarios: [
      {
        id: "curva-invertida",
        rotulo: "Curva invertida (hipotética)",
        descricao: "Exemplo hipotético: as taxas dos prazos longos ficam abaixo da taxa curta, como quando o mercado espera juros menores à frente.",
        eixoX: "prazo",
        dados: [
          { prazo: "Prazo curto", taxa: 14 },
          { prazo: "2 anos", taxa: 12.5 },
          { prazo: "5 anos", taxa: 12 },
        ],
        series: [{ chave: "taxa", nome: "Taxa anual (hipotética)", cor: "#5b3fd0" }],
      },
      {
        id: "curva-positiva",
        rotulo: "Curva positiva (hipotética)",
        descricao: "Exemplo hipotético: prazos mais longos pagam taxas maiores, pelo risco e pela liquidez de ficar mais tempo emprestando.",
        eixoX: "prazo",
        dados: [
          { prazo: "Prazo curto", taxa: 10 },
          { prazo: "2 anos", taxa: 11.5 },
          { prazo: "5 anos", taxa: 12.5 },
        ],
        series: [{ chave: "taxa", nome: "Taxa anual (hipotética)", cor: "#7359e5" }],
      },
    ],
  },

  "ir-aliquotas": {
    modoPadrao: "barras",
    titulo: "Tabela comparativa de alíquotas de Imposto de Renda",
    descricao: "As alíquotas aplicadas sobre o ganho de capital e rendimentos em cada classe de investimento.",
    formato: "percentual",
    cenarios: [
      {
        id: "renda-variavel",
        rotulo: "Renda Variável",
        descricao: "Tributação sobre o ganho de capital líquido na alienação de ativos.",
        eixoX: "ativo",
        dados: [
          { ativo: "Ações (até 20k/mês)", aliquota: 0, detalhe: "Isenção para vendas totais até R$ 20.000 no mês" },
          { ativo: "Ações (> 20k/mês)", aliquota: 15, detalhe: "Swing trade com vendas acima de R$ 20.000 no mês" },
          { ativo: "ETFs de Ações", aliquota: 15, detalhe: "Não possui faixa de isenção de 20k; pago por DARF" },
          { ativo: "FIIs (alienação)", aliquota: 20, detalhe: "Venda de cotas com ganho de capital" },
          { ativo: "Day Trade", aliquota: 20, detalhe: "Qualquer operação iniciada e zerada no mesmo dia" },
        ],
        series: [{ chave: "aliquota", nome: "Alíquota de IR (%)", cor: "#d94f5c" }],
      },
      {
        id: "renda-fixa",
        rotulo: "Renda Fixa (Prazo)",
        descricao: "Tabela regressiva pela Lei 11.033/2004 para títulos não isentos (CDB, Tesouro Direto).",
        eixoX: "ativo",
        dados: [
          { ativo: "Até 180 dias", aliquota: aliquotaDeIrNaRendaFixa(180), detalhe: "Prazo mais curto, alíquota máxima" },
          { ativo: "181 a 360 dias", aliquota: aliquotaDeIrNaRendaFixa(300), detalhe: "De 6 meses a 1 ano" },
          { ativo: "361 a 720 dias", aliquota: aliquotaDeIrNaRendaFixa(500), detalhe: "De 1 a 2 anos" },
          { ativo: "Acima de 720 dias", aliquota: aliquotaDeIrNaRendaFixa(800), detalhe: "Alíquota mínima definitiva após 2 anos" },
        ],
        series: [{ chave: "aliquota", nome: "Alíquota de IR (%)", cor: "#7a5af8" }],
      },
      {
        id: "etf-renda-fixa",
        rotulo: "ETF de Renda Fixa",
        descricao:
          "Lei 13.043/2014, art. 2º: IR retido na fonte, sem DARF. A alíquota segue o prazo médio da carteira do fundo, e não o tempo que a pessoa ficou com a cota.",
        eixoX: "ativo",
        dados: [
          { ativo: "Prazo médio até 180 dias", aliquota: ALIQUOTAS_ETF_RENDA_FIXA.ate180, detalhe: "Carteira de prazo médio curto" },
          { ativo: "181 a 720 dias", aliquota: ALIQUOTAS_ETF_RENDA_FIXA.ate720, detalhe: "Carteira de prazo médio intermediário" },
          { ativo: "Acima de 720 dias", aliquota: ALIQUOTAS_ETF_RENDA_FIXA.acima720, detalhe: "Carteira de prazo médio longo" },
        ],
        series: [{ chave: "aliquota", nome: "Alíquota de IR (%)", cor: "#5d6b7f" }],
      },
    ],
  },

  "fiis-proventos": {
    modoPadrao: "barras",
    titulo: "Proventos mensais de dois fundos imaginários (exemplo hipotético, não é de nenhum fundo)",
    descricao:
      "Valores inventados, por cota, para mostrar a diferença de mecanismo: o aluguel muda pouco de um mês para o outro; o juro de títulos atrelados a CDI ou inflação muda com esses índices. Não descreve nenhum fundo real nem o que um tipo de fundo vai pagar.",
    formato: "moeda",
    cenarios: [
      {
        id: "comparativo",
        rotulo: "Comparativo",
        descricao: "Exemplo hipotético: no fundo imaginário de tijolo, o provento varia pouco; no de papel, acompanha a variação do CDI e da inflação no mês.",
        eixoX: "mes",
        dados: PROVENTOS_HIPOTETICOS_DE_FII.map(({ mes, tijolo, papel }) => ({ mes, tijolo, papel })),
        series: [
          { chave: "tijolo", nome: "Fundo imaginário de tijolo (aluguéis)", cor: "#3b6fe0" },
          { chave: "papel", nome: "Fundo imaginário de papel (CRIs)", cor: "#7359e5" },
        ],
      },
      {
        id: "tijolo",
        rotulo: "Tijolo (hipotético)",
        descricao: "Exemplo hipotético: o aluguel costuma ser reajustado uma vez por ano, pelo índice de inflação previsto no contrato.",
        eixoX: "mes",
        dados: PROVENTOS_HIPOTETICOS_DE_FII.map(({ mes, tijolo }) => ({ mes, tijolo })),
        series: [{ chave: "tijolo", nome: "Tijolo, hipotético (R$/cota)", cor: "#3b6fe0" }],
      },
      {
        id: "papel",
        rotulo: "Papel (hipotético)",
        descricao: "Exemplo hipotético: o juro dos títulos acompanha o CDI ou a inflação de cada mês.",
        eixoX: "mes",
        dados: PROVENTOS_HIPOTETICOS_DE_FII.map(({ mes, papel }) => ({ mes, papel })),
        series: [{ chave: "papel", nome: "Papel, hipotético (R$/cota)", cor: "#7359e5" }],
      },
    ],
  },
};
