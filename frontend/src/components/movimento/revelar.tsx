"use client";

import type { CSSProperties, ReactNode } from "react";
import { useVisibilidade } from "./usar-visibilidade";

// Por que existe: o leitor percebe que chegou a um bloco novo sem que nada salte; entra uma vez e
// fica, porque reanimar a cada rolada é a interface brigando com quem lê.
export function Revelar({
  atrasoMs,
  className,
  children,
}: {
  atrasoMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const [ref, visibilidade] = useVisibilidade<HTMLDivElement>(0.3);
  const visivel = visibilidade === "entrou" || visibilidade === "sem-observador";
  const classes = ["revelar", visivel && "visivel", className].filter(Boolean).join(" ");
  const estilo =
    atrasoMs === undefined ? undefined : ({ "--atraso": `${atrasoMs}ms` } as CSSProperties);

  return (
    <div ref={ref} className={classes} style={estilo}>
      {children}
    </div>
  );
}
