/**
 * A conta de um artigo, "A ÷ B = resultado", em caixas. Cada parte é uma <Parcela>; entre elas, um
 * <Sinal>. Lado a lado a partir do tablet; no celular as caixas empilham e o sinal fica entre elas,
 * porque três caixas de 90 px lado a lado não comportam "R$ 42,85".
 */
export function Conta({ children, rotulo }: { children: React.ReactNode; rotulo?: string }) {
  return (
    <div role="group" aria-label={rotulo ?? "Conta"} className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
      {children}
    </div>
  );
}

export function Parcela({
  rotulo,
  children,
  resultado = false,
  fundo = "card",
}: {
  rotulo: string;
  children: React.ReactNode;
  /** A caixa do resultado, em destaque. */
  resultado?: boolean;
  /** `card` (branco, com borda) nos artigos; `papel` quando a conta está dentro de um card branco. */
  fundo?: "card" | "papel";
}) {
  const estilo = resultado
    ? "bg-marca-texto"
    : fundo === "papel"
      ? "bg-paper"
      : "border border-pauta bg-card";
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-3.5 ${estilo}`}>
      <span className="text-[13px] leading-[19px] text-ink-2">{rotulo}</span>
      <span className={`tnum text-[19px] leading-[26px] font-semibold whitespace-nowrap ${resultado ? "text-anotacao" : "text-ink"}`}>{children}</span>
    </div>
  );
}

export function Sinal({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="self-center font-leitura text-xl leading-[26px] font-semibold text-mute">
      {children}
    </span>
  );
}
