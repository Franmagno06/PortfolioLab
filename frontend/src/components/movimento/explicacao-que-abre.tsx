"use client";

import { useState, type ReactNode } from "react";

// Por que existe: o número e a frase curta ficam sempre à vista para quem só quer o essencial;
// a conta e a armadilha se abrem para quem quer entender, sem empurrar a página de uma vez.
export function ExplicacaoQueAbre({
  id,
  rotulo,
  valor,
  resumo,
  children,
}: {
  id: string;
  rotulo: ReactNode;
  valor?: ReactNode;
  resumo: ReactNode;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const transicao = "var(--duracao-media) var(--curva)";

  return (
    <div>
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls={id}
        onClick={() => setAberta((a) => !a)}
        className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] touch-manipulation items-center gap-3 rounded-lg px-2 text-left hover:bg-caderno"
        style={{ transition: "background-color var(--duracao-rapida) var(--curva)" }}
      >
        <span className="font-semibold text-ink">{rotulo}</span>
        <span className="ml-auto flex items-center gap-2">
          {valor !== undefined && <span className="tnum font-semibold text-ink">{valor}</span>}
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            className="shrink-0 text-mute"
            style={{ transform: aberta ? "rotate(180deg)" : "none", transition: `transform ${transicao}` }}
          >
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div className="text-sm text-mute">{resumo}</div>

      {/* grid-template-rows 0fr → 1fr abre até a altura do conteúdo sem medir em JS; é a exceção
          de layout aceita para sanfona. Fechado, `inert` tira o corpo do Tab e do leitor de tela. */}
      <div
        id={id}
        className="grid"
        inert={!aberta}
        aria-hidden={aberta ? undefined : true}
        style={{ gridTemplateRows: aberta ? "1fr" : "0fr", transition: `grid-template-rows ${transicao}` }}
      >
        <div
          className="min-h-0 overflow-hidden"
          style={{ opacity: aberta ? 1 : 0, transition: `opacity ${transicao}` }}
        >
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
