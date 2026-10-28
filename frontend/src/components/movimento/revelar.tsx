"use client";

import type { CSSProperties, ReactNode } from "react";
import { useVisibilidade } from "./usar-visibilidade";

// Por que existe: o leitor percebe que chegou a um bloco novo sem que nada salte; entra uma vez e
// fica, porque reanimar a cada rolada é a interface brigando com quem lê.
//
// O HTML do servidor já é o conteúdo final: nada fica invisível antes da hidratação. Só o que o
// observador viu inteiramente fora da tela espera escondido e entra ao chegar; o que já estava à
// vista (primeira dobra, âncora, troca de Suspense) nunca pisca. Mesmo assim, não envolva o topo.
export function Revelar({
  atrasoMs,
  className,
  children,
}: {
  atrasoMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const [ref, visibilidade, passouPorFora] = useVisibilidade<HTMLDivElement>(0.3);
  const esperando = passouPorFora && visibilidade === "fora";
  const classes = ["revelar", esperando && "revelar-espera", className].filter(Boolean).join(" ");
  const estilo =
    atrasoMs === undefined ? undefined : ({ "--atraso": `${atrasoMs}ms` } as CSSProperties);

  return (
    <div ref={ref} className={classes} style={estilo}>
      {children}
    </div>
  );
}
