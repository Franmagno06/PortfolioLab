export type PosicaoClassificada = { ticker: string; type: string; valorAtual: number };

export type FatiaDePosicao = { ticker: string; type: string; valor: number; percentual: number };

export type MaioresPosicoes = {
  itens: FatiaDePosicao[];
  /** O que sobra fora das maiores, agrupado; null quando cabe tudo em `itens`. */
  outros: { quantidade: number; valor: number; percentual: number } | null;
  total: number;
};

/**
 * Maiores posições da carteira, ou de uma classe só. O percentual é sobre o
 * recorte escolhido: com `classe` definida, os FIIs somam 100% entre si.
 */
export function maioresPosicoes(
  posicoes: PosicaoClassificada[],
  classe: string | null,
  limite = 5,
): MaioresPosicoes {
  const recorte = posicoes
    .filter((p) => p.valorAtual > 0 && (classe === null || p.type === classe))
    .sort((a, b) => b.valorAtual - a.valorAtual);

  const total = recorte.reduce((soma, p) => soma + p.valorAtual, 0);
  const percentualDe = (valor: number) => (total === 0 ? 0 : (valor / total) * 100);

  const itens = recorte.slice(0, limite).map((p) => ({
    ticker: p.ticker,
    type: p.type,
    valor: p.valorAtual,
    percentual: percentualDe(p.valorAtual),
  }));

  const resto = recorte.slice(limite);
  const valorResto = resto.reduce((soma, p) => soma + p.valorAtual, 0);

  return {
    itens,
    outros:
      resto.length === 0
        ? null
        : { quantidade: resto.length, valor: valorResto, percentual: percentualDe(valorResto) },
    total,
  };
}
