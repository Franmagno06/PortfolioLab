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
