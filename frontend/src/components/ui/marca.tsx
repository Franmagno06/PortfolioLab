// Logomarca: três barras ascendentes nas cores das classes de ativo.
// Vivia duplicada na sidebar e no layout de autenticação.
export function Marca({ tamanho = 26 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 26 26" aria-hidden>
      <rect x="2" y="14" width="5" height="10" rx="1.5" fill="var(--color-fii)" />
      <rect x="10" y="9" width="5" height="15" rx="1.5" fill="var(--color-rf)" />
      <rect x="18" y="3" width="5" height="21" rx="1.5" fill="var(--color-acao)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      Portfolio<span className="text-mint">Lab</span>
    </span>
  );
}
