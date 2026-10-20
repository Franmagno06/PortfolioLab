"use client";

import { caminhoDoMinigrafico } from "@/lib/movimento";
import { useVisibilidade } from "./usar-visibilidade";

// Por que existe: a linha correndo da esquerda para a direita conta a história do período na ordem
// em que ela aconteceu; desenha uma vez, ao chegar à tela, e depois fica parada para ser lida.
//
// O traço usa pathLength="1": o dasharray/dashoffset trabalham em frações do caminho, sem medir
// o comprimento em JS. Antes da primeira leitura do observador (e sem observador) a linha fica
// inteira; só some se o observador disser que está fora da tela, e então se desenha ao entrar.
export function Minigrafico({
  valores,
  largura = 120,
  altura = 36,
  rotulo,
}: {
  valores: number[];
  largura?: number;
  altura?: number;
  rotulo: string;
}) {
  const d = caminhoDoMinigrafico(valores, largura, altura);
  const [ref, visibilidade, passouPorFora] = useVisibilidade<SVGSVGElement>(0.5, d !== "");
  if (d === "") return null;

  // Só se desenha o que foi visto fora da tela antes: a linha que já estava à vista na primeira
  // leitura fica inteira, sem sumir e redesenhar.
  const classeDoTraco = !passouPorFora
    ? undefined
    : visibilidade === "fora"
      ? "tracar-espera"
      : visibilidade === "entrou"
        ? "tracar"
        : undefined;

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={rotulo}
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      overflow="visible"
      className="block"
    >
      <path
        d={d}
        pathLength={1}
        className={classeDoTraco}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
