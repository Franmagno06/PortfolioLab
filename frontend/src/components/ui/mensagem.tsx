/** Erro: o que aconteceu, no tom da interface. Uma única aparência no app. */
export function MensagemErro({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-loss-ink/20 bg-loss/6 px-4 py-3 text-sm text-loss-ink"
    >
      {children}
    </p>
  );
}

/** Aviso: a tela funciona, mas há uma condição que muda a leitura do número. */
export function MensagemAviso({
  titulo,
  children,
}: {
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-etf/30 bg-etf/7 p-4 text-sm">
      <p className="font-semibold text-ink">{titulo}</p>
      {children && <div className="mt-1 text-xs leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}
