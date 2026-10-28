"use client";

import { caminhoDaAreaDoMinigrafico, caminhoDoMinigrafico, pontoFinalDoMinigrafico } from "@/lib/movimento";
import { useVisibilidade } from "./usar-visibilidade";

// Por que existe: a linha correndo da esquerda para a direita conta a história do período na ordem
// em que ela aconteceu; desenha uma vez, ao chegar à tela, e depois fica parada para ser lida.
// A área sob a linha aparece junto dela e o ponto final surge quando o traço termina: o olho
// termina a leitura no valor mais recente.
//
// O traço usa pathLength="1": o dasharray/dashoffset trabalham em frações do caminho, sem medir
// o comprimento em JS. Antes da primeira leitura do observador (e sem observador) tudo fica
// inteiro; só some se o observador disser que está fora da tela, e então se desenha ao entrar.
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

  const area = caminhoDaAreaDoMinigrafico(valores, largura, altura);
  const ponto = pontoFinalDoMinigrafico(valores, largura, altura);

  // Só se desenha o que foi visto fora da tela antes: o que já estava à vista na primeira
  // leitura fica inteiro, sem sumir e redesenhar.
  const animando = passouPorFora && (visibilidade === "fora" || visibilidade === "entrou");
  const espera = animando && visibilidade === "fora";
  const entrando = animando && visibilidade === "entrou";

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
        data-area
        d={area}
        className={espera ? "area-espera" : entrando ? "area-aparece" : undefined}
        fill="currentColor"
        fillOpacity="0.16"
        stroke="none"
      />
      <path
        data-linha
        d={d}
        pathLength={1}
        className={espera ? "tracar-espera" : entrando ? "tracar" : undefined}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {ponto && (
        <circle
          data-ponto
          cx={ponto.x}
          cy={ponto.y}
          r="3"
          className={espera ? "ponto-espera" : entrando ? "ponto-aparece" : undefined}
          fill="currentColor"
        />
      )}
    </svg>
  );
}
