"use client";

import { useState } from "react";

// Duas séries inventadas, só de desenho: não são dados de mercado. Começam e terminam fora
// do quadro (x de -60 a 1260) para a deriva lateral nunca mostrar a ponta da linha.
const LINHA_A =
  "M-60,300 L40,282 L130,296 L220,250 L310,262 L400,214 L490,236 L580,190 L670,206 L760,160 L850,178 L940,132 L1030,150 L1120,104 L1260,92";
const LINHA_B =
  "M-60,236 L60,252 L170,224 L280,240 L390,204 L500,226 L610,186 L720,212 L830,170 L940,196 L1050,152 L1160,174 L1260,140";

// Por que existe: um gráfico vivo ao fundo diz "aqui se fala de mercado" antes de qualquer leitura;
// fica lento e apagado para não competir com o título, e o botão de pausa é obrigatório (WCAG 2.2.2)
// porque é movimento contínuo.
//
// Uso: o pai precisa de `position: relative`; o conteúdo vem por cima em `relative z-10`. O botão de
// pausa tem `z-20` próprio (este wrapper não tem z-index, então não cria contexto de empilhamento)
// e fica acima da camada de conteúdo mesmo quando ela ocupa a largura inteira.
// O rótulo troca entre "Pausar" e "Retomar" e por isso o botão não tem aria-pressed: um rótulo
// que muda não pode ser também um botão de alternância "pressionado" (ARIA APG).
export function GraficoDeFundo({ className = "text-ink" }: { className?: string }) {
  const [pausado, setPausado] = useState(false);
  const estado = pausado ? "paused" : "running";

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Cada linha é um <svg> próprio, 60 px mais largo de cada lado, e o que anda é o
          transform dele: camada própria no compositor, sem repintar o traço a cada quadro. */}
      <svg
        aria-hidden="true"
        focusable="false"
        className="deriva-fundo-a absolute top-0 -left-15 h-full w-[calc(100%+120px)]"
        viewBox="-60 0 1320 400"
        preserveAspectRatio="none"
        style={{ animationPlayState: estado }}
      >
        <path d={LINHA_A} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.28" />
      </svg>
      <svg
        aria-hidden="true"
        focusable="false"
        className="deriva-fundo-b absolute top-0 -left-15 h-full w-[calc(100%+120px)]"
        viewBox="-60 0 1320 400"
        preserveAspectRatio="none"
        style={{ animationPlayState: estado }}
      >
        <path d={LINHA_B} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.18" />
      </svg>

      <button
        type="button"
        onClick={() => setPausado((p) => !p)}
        className="pointer-events-auto absolute right-3 bottom-3 z-20 min-h-11 touch-manipulation rounded-full border border-line bg-card/90 px-4 text-xs font-medium text-ink hover:bg-paper"
        style={{ transition: "background-color var(--duracao-rapida) var(--curva)" }}
      >
        {pausado ? "Retomar animação" : "Pausar animação"}
      </button>
    </div>
  );
}
