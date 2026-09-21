/**
 * Cabeçalho de página. O contexto à direita é um elemento próprio, não uma
 * string colada com "·" — o separador dava a três dados o peso de um só.
 */
export function PageHeader({
  titulo,
  descricao,
  contexto,
  acao,
}: {
  titulo: string;
  descricao: string;
  contexto?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-0.5 max-w-prose text-sm text-mute">{descricao}</p>
      </div>
      {(contexto || acao) && (
        <div className="flex shrink-0 items-center gap-3">
          {contexto}
          {acao}
        </div>
      )}
    </header>
  );
}

/** Pílula de contexto do cabeçalho (contagem, data, frescor do dado). */
export function Pilula({ children }: { children: React.ReactNode }) {
  return (
    <span className="tnum rounded-full border border-line bg-card px-3 py-1 font-mono text-xs text-mute">
      {children}
    </span>
  );
}
