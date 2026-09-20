type Variante = "primario" | "secundario" | "acento";

const variantes: Record<Variante, string> = {
  primario: "bg-ink text-white hover:bg-ink-lift",
  secundario: "border border-line bg-card hover:bg-paper",
  acento: "bg-gain-ink text-white hover:bg-ink",
};

// Um tamanho por linha, nunca sobrescrito por className: entre px-4 e px-3
// quem vence é a ordem do CSS gerado, não a ordem na string de classes.
const tamanhos = {
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-xs",
  bloco: "w-full px-4 py-2.5 text-sm",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
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
      className={`rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantes[variante]} ${tamanhos[tamanho]} ${className}`}
    />
  );
}
