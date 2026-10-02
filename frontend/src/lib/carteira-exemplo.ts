/**
 * Carteira de exemplo do desafio da página inicial.
 *
 * Os tickers são reais; os preços são uma referência fixa (fechamento de
 * outubro de 2026) e as quantidades são inventadas para a carteira começar
 * desequilibrada — FII acima da meta, ações e ETF abaixo —, que é o caso em
 * que a escolha do aporte faz diferença.
 *
 * Esta tela só calcula a PRÉ-VISUALIZAÇÃO do que o visitante monta. A
 * sugestão oficial vem do backend (POST /rebalance/exemplo), que roda o mesmo
 * algoritmo da simulação de verdade, em Decimal.
 */
export type AtivoExemplo = {
  ticker: string;
  nome: string;
  classe: "FII" | "ACAO" | "ETF";
  preco: number;
  quantidade: number;
  /** meta de alocação, em % */
  meta: number;
};

export const APORTE_DO_DESAFIO = 1000;

export const CARTEIRA_EXEMPLO: readonly AtivoExemplo[] = [
  { ticker: "MXRF11", nome: "Maxi Renda", classe: "FII", preco: 9.08, quantidade: 400, meta: 20 },
  { ticker: "HGLG11", nome: "CSHG Logística", classe: "FII", preco: 147.6, quantidade: 10, meta: 20 },
  { ticker: "BBAS3", nome: "Banco do Brasil", classe: "ACAO", preco: 23.6, quantidade: 100, meta: 15 },
  { ticker: "TAEE11", nome: "Taesa", classe: "ACAO", preco: 42.74, quantidade: 20, meta: 15 },
  { ticker: "BOVA11", nome: "ETF do Ibovespa", classe: "ETF", preco: 187.58, quantidade: 10, meta: 15 },
  { ticker: "IVVB11", nome: "ETF do S&P 500", classe: "ETF", preco: 455.12, quantidade: 2, meta: 15 },
];

export type Compras = Record<string, number>;

export function custoDasCompras(carteira: readonly AtivoExemplo[], compras: Compras): number {
  return carteira.reduce((soma, a) => soma + (compras[a.ticker] ?? 0) * a.preco, 0);
}

/** Percentual de cada ativo na carteira, depois das compras. */
export function alocacaoDepois(
  carteira: readonly AtivoExemplo[],
  compras: Compras,
): { ticker: string; pct: number }[] {
  const valores = carteira.map((a) => ({
    ticker: a.ticker,
    valor: (a.quantidade + (compras[a.ticker] ?? 0)) * a.preco,
  }));
  const total = valores.reduce((soma, v) => soma + v.valor, 0);
  return valores.map((v) => ({ ticker: v.ticker, pct: total === 0 ? 0 : (v.valor / total) * 100 }));
}

/**
 * Quantos pontos percentuais da carteira estão fora do lugar. Soma das
 * distâncias de cada ativo à meta, dividida por dois: o que sobra num ativo é
 * exatamente o que falta noutro, e sem a divisão cada desvio contaria duas
 * vezes. Zero é a carteira idêntica às metas.
 */
export function desvioDasMetas(carteira: readonly AtivoExemplo[], compras: Compras): number {
  const depois = alocacaoDepois(carteira, compras);
  const soma = carteira.reduce(
    (total, a, i) => total + Math.abs((depois[i]?.pct ?? 0) - a.meta),
    0,
  );
  return soma / 2;
}

/** Peso de cada classe na carteira, para a fita do topo da página. */
export function pesoPorClasse(
  carteira: readonly AtivoExemplo[],
): { classe: AtivoExemplo["classe"]; atual: number; meta: number }[] {
  const depois = alocacaoDepois(carteira, {});
  const classes: AtivoExemplo["classe"][] = ["FII", "ACAO", "ETF"];
  return classes.map((classe) => ({
    classe,
    atual: carteira.reduce(
      (s, a, i) => (a.classe === classe ? s + (depois[i]?.pct ?? 0) : s),
      0,
    ),
    meta: carteira.reduce((s, a) => (a.classe === classe ? s + a.meta : s), 0),
  }));
}
