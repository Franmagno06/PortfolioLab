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
export type CompraDeExemplo = { ticker: string; metaPct: number; deficitCentavos: Centavos; precoCentavos: Centavos; cotas: number; custoCentavos: Centavos };

/**
 * O algoritmo guloso do aporte, como em docs/algoritmo-rebalanceamento.md: déficit = meta% ×
 * (patrimônio + aporte) − posição; maior déficit primeiro (empate: menor preço, depois ticker);
 * compra ⌊min(déficit, dinheiro restante) ÷ preço⌋ cotas; ativo acima da meta não recebe.
 */
export function aporteDeExemplo(
  metas: MetaDeExemplo[],
  aporteCentavos: Centavos,
): { compras: CompraDeExemplo[]; sobraCentavos: Centavos } {
  const patrimonio = metas.reduce((soma, m) => soma + m.posicaoCentavos, 0) + aporteCentavos;
  const comDeficit = metas
    .map((m) => ({ ...m, deficitCentavos: divisaoArredondada(m.metaPct * patrimonio, 100) - m.posicaoCentavos }))
    .sort((a, b) => b.deficitCentavos - a.deficitCentavos || a.precoCentavos - b.precoCentavos || a.ticker.localeCompare(b.ticker));

  let restante = aporteCentavos;
  const compras = comDeficit.map((m): CompraDeExemplo => {
    const orcamento = m.deficitCentavos <= 0 ? 0 : Math.min(m.deficitCentavos, restante);
    const cotas = divisaoInteira(orcamento, m.precoCentavos);
    const custoCentavos = cotas * m.precoCentavos;
    restante -= custoCentavos;
    return { ticker: m.ticker, metaPct: m.metaPct, deficitCentavos: m.deficitCentavos, precoCentavos: m.precoCentavos, cotas, custoCentavos };
  });
  return { compras, sobraCentavos: restante };
}

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

export const PRESETS_GRAFICO_ARTIGO: Record<PresetGraficoArtigo, DefinicaoPresetGrafico> = {
  "juros-compostos": {
    modoPadrao: "area",
    titulo: "Evolução dos juros compostos: R$ 500/mês a 10% a.a.",
    descricao: "Comparação entre o total investido do próprio bolso e o montante gerado pelos juros sobre juros ao longo do tempo.",
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
    titulo: "Comparação de múltiplos médios entre setores da B3",
    descricao: "Setores maduros e de receita previsível ou commodities negociam a múltiplos menores do que setores de crescimento.",
    formato: "multiplicador",
    cenarios: [
      {
        id: "pl",
        rotulo: "P/L Médio",
        descricao: "Preço sobre Lucro médio estimado para empresas de cada setor da B3.",
        eixoX: "setor",
        dados: [
          { setor: "Commodities", valor: 5.8, descricao: "Petróleo, minério e celulose (alta ciclicidade)" },
          { setor: "Bancos", valor: 7.8, descricao: "Grandes bancos comerciais consolidados" },
          { setor: "Elétricas", valor: 10.2, descricao: "Transmissão e geração com receita previsível" },
          { setor: "Varejo", valor: 16.5, descricao: "Empresas com margem menor e expectativa de crescimento" },
        ],
        series: [{ chave: "valor", nome: "P/L Médio (vezes)", cor: "#5b3fd0" }],
      },
      {
        id: "pvp",
        rotulo: "P/VP Médio",
        descricao: "Preço sobre Valor Patrimonial médio dos principais setores da bolsa.",
        eixoX: "setor",
        dados: [
          { setor: "Commodities", valor: 1.1, descricao: "Intensivo em capital físico e equipamentos" },
          { setor: "Bancos", valor: 1.3, descricao: "Rentabilidade elevada (ROE) sobre o patrimônio" },
          { setor: "Elétricas", valor: 1.96, descricao: "Múltiplo da TAEE11 no exemplo de referência" },
          { setor: "Varejo", valor: 2.4, descricao: "Ativos intangíveis, logística e marca" },
        ],
        series: [{ chave: "valor", nome: "P/VP Médio (vezes)", cor: "#7359e5" }],
      },
    ],
  },

  "renda-fixa-curva": {
    modoPadrao: "area",
    titulo: "Curva de juros: taxa presente vs expectativas de mercado",
    descricao: "Como a taxa básica de hoje se compara aos contratos futuros de juros (DI) negociados para 2 e 5 anos.",
    formato: "percentual",
    cenarios: [
      {
        id: "curva-atual",
        rotulo: "Curva Atual (Em queda)",
        descricao: "O mercado projeta taxas menores no longo prazo do que a taxa Selic presente.",
        eixoX: "prazo",
        dados: [
          { prazo: "Hoje (Selic)", taxa: DADOS_PUBLICOS.selicMeta.valorPct },
          { prazo: "DI 2 anos", taxa: 12.5 },
          { prazo: "DI 5 anos", taxa: 12.1 },
        ],
        series: [{ chave: "taxa", nome: "Taxa anual (DI/Selic)", cor: "#5b3fd0" }],
      },
      {
        id: "curva-normal",
        rotulo: "Curva Normal (Em alta)",
        descricao: "Prazos mais longos exigem prêmio maior de risco e liquidez.",
        eixoX: "prazo",
        dados: [
          { prazo: "Hoje (Selic)", taxa: 10.5 },
          { prazo: "DI 2 anos", taxa: 11.8 },
          { prazo: "DI 5 anos", taxa: 12.9 },
        ],
        series: [{ chave: "taxa", nome: "Taxa anual projetada", cor: "#7359e5" }],
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
          { ativo: "ETFs de Ações", aliquota: 15, detalhe: "Não possui faixa de isenção de 20k" },
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
    ],
  },

  "fiis-proventos": {
    modoPadrao: "barras",
    titulo: "Série histórica de 12 meses: FII de Tijolo vs FII de Papel",
    descricao: "Contraste entre a estabilidade dos aluguéis de tijolo e a volatilidade dos proventos atrelados a inflação/CDI em fundos de papel.",
    formato: "moeda",
    cenarios: [
      {
        id: "comparativo",
        rotulo: "Comparativo",
        descricao: "FII de tijolo mantém pagamentos lineares; FII de papel acompanha a variação mensal da inflação e CDI.",
        eixoX: "mes",
        dados: [
          { mes: "Out/25", tijolo: 0.72, papel: 1.1 },
          { mes: "Nov/25", tijolo: 0.73, papel: 1.15 },
          { mes: "Dez/25", tijolo: 0.72, papel: 0.95 },
          { mes: "Jan/26", tijolo: 0.74, papel: 0.8 },
          { mes: "Fev/26", tijolo: 0.73, papel: 0.65 },
          { mes: "Mar/26", tijolo: 0.73, papel: 0.7 },
          { mes: "Abr/26", tijolo: 0.74, papel: 0.85 },
          { mes: "Mai/26", tijolo: 0.75, papel: 1.05 },
          { mes: "Jun/26", tijolo: 0.73, papel: 1.12 },
          { mes: "Jul/26", tijolo: 0.74, papel: 1.18 },
          { mes: "Ago/26", tijolo: 0.73, papel: 0.98 },
          { mes: "Set/26", tijolo: 0.75, papel: 0.92 },
        ],
        series: [
          { chave: "tijolo", nome: "FII Tijolo (aluguéis)", cor: "#3b6fe0" },
          { chave: "papel", nome: "FII Papel (CRIs)", cor: "#7359e5" },
        ],
      },
      {
        id: "tijolo",
        rotulo: "FII de Tijolo",
        descricao: "Foco nos proventos previsíveis com reajustes anuais por IGP-M ou IPCA.",
        eixoX: "mes",
        dados: [
          { mes: "Out/25", tijolo: 0.72 },
          { mes: "Nov/25", tijolo: 0.73 },
          { mes: "Dez/25", tijolo: 0.72 },
          { mes: "Jan/26", tijolo: 0.74 },
          { mes: "Fev/26", tijolo: 0.73 },
          { mes: "Mar/26", tijolo: 0.73 },
          { mes: "Abr/26", tijolo: 0.74 },
          { mes: "Mai/26", tijolo: 0.75 },
          { mes: "Jun/26", tijolo: 0.73 },
          { mes: "Jul/26", tijolo: 0.74 },
          { mes: "Ago/26", tijolo: 0.73 },
          { mes: "Set/26", tijolo: 0.75 },
        ],
        series: [{ chave: "tijolo", nome: "FII Tijolo (R$/cota)", cor: "#3b6fe0" }],
      },
      {
        id: "papel",
        rotulo: "FII de Papel",
        descricao: "Foco na variação direta com a marcação a mercado dos papéis e correção monetária.",
        eixoX: "mes",
        dados: [
          { mes: "Out/25", papel: 1.1 },
          { mes: "Nov/25", papel: 1.15 },
          { mes: "Dez/25", papel: 0.95 },
          { mes: "Jan/26", papel: 0.8 },
          { mes: "Fev/26", papel: 0.65 },
          { mes: "Mar/26", papel: 0.7 },
          { mes: "Abr/26", papel: 1.05 },
          { mes: "Jun/26", papel: 1.12 },
          { mes: "Jul/26", papel: 1.18 },
          { mes: "Ago/26", papel: 0.98 },
          { mes: "Set/26", papel: 0.92 },
        ],
        series: [{ chave: "papel", nome: "FII Papel (R$/cota)", cor: "#7359e5" }],
      },
    ],
  },
};
