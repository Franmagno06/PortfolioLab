type Variante = "primario" | "secundario" | "acento" | "perigo";

const variantes: Record<Variante, string> = {
  primario: "bg-ink text-white hover:bg-ink-lift focus-visible:bg-ink-lift",
  secundario: "border border-line bg-card hover:bg-paper focus-visible:bg-paper",
  acento: "bg-gain-ink text-white hover:bg-ink focus-visible:bg-ink",
  // ação destrutiva e irreversível (apagar): cor de perda, nunca a do botão comum
  perigo: "bg-loss-ink text-white hover:bg-ink focus-visible:bg-ink",
};

// Um tamanho por linha, nunca sobrescrito por className: entre px-4 e px-3
// quem vence é a ordem do CSS gerado, não a ordem na string de classes.
const tamanhos = {
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-xs",
  bloco: "w-full px-4 py-2.5 text-sm",
};

type Props = React.ComponentProps<"button"> & {
  variante?: Variante;
  tamanho?: keyof typeof tamanhos;
};

export function Botao({
  variante = "primario",
  tamanho = "md",
  className = "",
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`rounded font-semibold toque disabled:cursor-not-allowed disabled:opacity-60 ${variantes[variante]} ${tamanhos[tamanho]} ${className}`}
    />
  );
}
