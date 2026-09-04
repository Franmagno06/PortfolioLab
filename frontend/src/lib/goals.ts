// Soma as metas editadas na tela de simulação — pura, sem estado do React,
// para ser fácil de testar e de reusar (ver src/app/(app)/simulacao/page.tsx).
export function somarMetas(edicao: Record<string, string>): number {
  return Object.values(edicao).reduce((soma, valor) => soma + (Number(valor) || 0), 0);
}
