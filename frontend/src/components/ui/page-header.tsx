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
        {/* Literata, como os títulos do site: a área logada é parte dele */}
        <h1 className="font-leitura text-[30px] leading-9 font-semibold tracking-[-0.01em]">{titulo}</h1>
        <p className="mt-1 max-w-prose text-[15px] text-ink-2">{descricao}</p>
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
    <span className="tnum rounded border border-line bg-card px-2.5 py-1 text-xs text-mute">
      {children}
    </span>
  );
}
