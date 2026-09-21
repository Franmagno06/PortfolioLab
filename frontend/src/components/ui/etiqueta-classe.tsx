import { coresClasse, nomesClasse } from "@/lib/format";

/**
 * Classe do ativo: ponto na cor da classe + rótulo em tinta cheia.
 * A versão anterior pintava o texto na cor da classe sobre um fundo de 10%
 * dela — o laranja de ETF dava 2.9:1, abaixo de AA. O ponto carrega a cor,
 * o texto carrega a legibilidade.
 */
export function EtiquetaClasse({ tipo }: { tipo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: coresClasse[tipo] ?? "var(--color-mute)" }}
      />
      {nomesClasse[tipo] ?? tipo}
    </span>
  );
}
