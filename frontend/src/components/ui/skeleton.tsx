export function Skeleton({ className = "" }: { className?: string }) {
  // Sem raio próprio: quem usa escolhe, senão rounded-xl e rounded-lg colidiriam.
  return <div className={`animate-pulse bg-line ${className}`} aria-hidden />;
}

/** Esqueleto padrão: cabeçalho + bloco principal. Era copiado em cada página. */
export function SkeletonPagina({ blocos = 1 }: { blocos?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <Skeleton className="h-8 w-48 rounded-lg" />
      {Array.from({ length: blocos }, (_, i) => (
        <Skeleton key={i} className={`rounded-xl ${i === 0 ? "h-44" : "h-64"}`} />
      ))}
    </div>
  );
}
