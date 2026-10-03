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

/**
 * A carteira antes do aporte de outubro: a "folha de setembro" da página
 * inicial. A de novembro, ponto de partida do desafio, sai dela somando
 * COMPRAS_DE_OUTUBRO (ver CARTEIRA_DE_NOVEMBRO).
 */
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

/**
 * Compras de outubro: a resposta do algoritmo real (POST /rebalance/exemplo)
 * para CARTEIRA_EXEMPLO com APORTE_DO_DESAFIO. Impressa na folha do topo da
 * página inicial e fixada em backend/src/modules/rebalance/rebalance.exemplo.test.ts:
 * se aquele teste mudar, esta constante e a página mudam junto.
 */
export const COMPRAS_DE_OUTUBRO: Compras = { TAEE11: 16, HGLG11: 2 };

/** Soma as compras às quantidades: a carteira do mês seguinte. */
export function aplicarCompras(carteira: readonly AtivoExemplo[], compras: Compras): AtivoExemplo[] {
  return carteira.map((a) => ({ ...a, quantidade: a.quantidade + (compras[a.ticker] ?? 0) }));
}

/** O ponto de partida do desafio: a carteira depois do aporte de outubro. */
export const CARTEIRA_DE_NOVEMBRO = aplicarCompras(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO);

/** Por que um ativo recebeu, ou não, parte do aporte: a coluna "Por quê" da folha. */
export type SituacaoNoAporte =
  | { tipo: "mais-longe"; atual: number; meta: number }
  | { tipo: "abaixo"; atual: number; meta: number }
  | { tipo: "ficou-para-depois"; preco: number }
  | { tipo: "acima"; atual: number; meta: number };

/**
 * Classifica o ativo no aporte a partir dos dados, e não de texto escrito à
 * mão: o percentual é o de antes das compras, a meta e o preço vêm da
 * carteira, e "mais longe" é o maior buraco (meta menos peso atual) entre
 * todos os ativos. Devolve null para ticker fora da carteira.
 */
export function situacaoNoAporte(
  carteira: readonly AtivoExemplo[],
  compras: Compras,
  ticker: string,
): SituacaoNoAporte | null {
  const antes = alocacaoDepois(carteira, {});
  const indice = carteira.findIndex((a) => a.ticker === ticker);
  const ativo = carteira[indice];
  if (!ativo) return null;

  const atual = antes[indice]?.pct ?? 0;
  const buracos = carteira.map((a, i) => a.meta - (antes[i]?.pct ?? 0));
  const maiorBuraco = Math.max(...buracos);

  if ((compras[ticker] ?? 0) > 0) {
    return buracos[indice] === maiorBuraco
      ? { tipo: "mais-longe", atual, meta: ativo.meta }
      : { tipo: "abaixo", atual, meta: ativo.meta };
  }
  return atual < ativo.meta
    ? { tipo: "ficou-para-depois", preco: ativo.preco }
    : { tipo: "acima", atual, meta: ativo.meta };
}
