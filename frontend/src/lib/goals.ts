// Soma as metas editadas na tela de simulação — pura, sem estado do React,
// para ser fácil de testar e de reusar (ver src/app/(app)/simulacao/page.tsx).
export function somarMetas(edicao: Record<string, string>): number {
  return Object.values(edicao).reduce((soma, valor) => soma + (Number(valor) || 0), 0);
}

export type MetaDeAtivo = { ticker: string; targetWeight: number };
export type PosicaoDeAtivo = { ticker: string; valorAtual: number };

export type DesvioDeMeta = {
  ticker: string;
  alvoPct: number;
  atualPct: number;
  /** Positivo = acima da meta. Negativo = abaixo, é onde o aporte entra. */
  desvioPct: number;
};

export type Rebalanceamento = {
  desvios: DesvioDeMeta[];
  /** Patrimônio dos ativos COM meta — o mesmo denominador da simulação. */
  patrimonioConsiderado: number;
  /** Maior desvio absoluto em pontos percentuais: o "quão longe" da meta. */
  maiorDesvioPct: number;
  /** O ativo mais abaixo da meta, ou null se nenhum está. */
  maiorDeficit: DesvioDeMeta | null;
  somaMetas: number;
};

/**
 * Distância entre a carteira e as metas, em pontos percentuais.
 *
 * O denominador é o patrimônio dos ativos QUE TÊM META, igual ao que
 * rebalance.service.ts usa no backend: você rebalanceia a parte da carteira
 * que decidiu gerenciar, não o total. Somar o resto aqui daria um desvio
 * inflado e um número diferente do que a tela de simulação mostra.
 *
 * Pura: recebe metas e posições, devolve o resultado.
 */
export function calcularDesvios(
  metas: MetaDeAtivo[],
  posicoes: PosicaoDeAtivo[],
): Rebalanceamento {
  const valorPorTicker = new Map(posicoes.map((p) => [p.ticker, p.valorAtual]));

  const patrimonioConsiderado = metas.reduce(
    (soma, m) => soma + (valorPorTicker.get(m.ticker) ?? 0),
    0,
  );

  const desvios = metas
    .map((m) => {
      const valor = valorPorTicker.get(m.ticker) ?? 0;
      // Carteira zerada: toda meta está 100% do seu alvo abaixo dela, não 0.
      const atualPct = patrimonioConsiderado === 0 ? 0 : (valor / patrimonioConsiderado) * 100;
      return {
        ticker: m.ticker,
        alvoPct: m.targetWeight,
        atualPct,
        desvioPct: atualPct - m.targetWeight,
      };
    })
    .sort((a, b) => a.desvioPct - b.desvioPct);

  const abaixo = desvios.filter((d) => d.desvioPct < 0);

  return {
    desvios,
    patrimonioConsiderado,
    maiorDesvioPct: desvios.reduce((max, d) => Math.max(max, Math.abs(d.desvioPct)), 0),
    maiorDeficit: abaixo[0] ?? null,
    somaMetas: metas.reduce((soma, m) => soma + m.targetWeight, 0),
  };
}
