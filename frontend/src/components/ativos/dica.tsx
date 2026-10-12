"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { DICAS, type IdDaDica } from "@/lib/indicadores-explicados";

/*
 * O "?" que explica um indicador em uma ou duas frases.
 *
 * Abre de quatro jeitos, todos com o mesmo botão:
 *  - mouse: passar por cima abre; clicar fixa aberto (senão o clique de quem já
 *    está com o mouse em cima fecharia o que o hover acabou de abrir);
 *  - toque: tocar abre e fixa; tocar fora fecha. Não existe hover no toque;
 *  - teclado: Enter ou Espaço no botão; Esc fecha; sair com Tab também fecha;
 *  - leitor de tela: o texto está sempre no DOM, ligado ao botão por
 *    aria-describedby, e é lido mesmo com o balão fechado.
 *
 * O botão tem 44 px de área, mas ocupa 20 px de layout (margem negativa): cabe
 * numa linha de tabela sem aumentá-la.
 */

type Modo = "fechado" | "passando" | "fixo";

const MARGEM_DA_TELA = 8;

export function Dica({ id, rotulo }: { id: IdDaDica; rotulo?: string }) {
  const dica = DICAS[id];
  const nome = rotulo ?? dica.rotulo;
  const idDoTexto = useId();
  const [modo, setModo] = useState<Modo>("fechado");
  const raiz = useRef<HTMLSpanElement>(null);
  const balao = useRef<HTMLSpanElement>(null);
  const aberto = modo !== "fechado";

  // Fora da tela, o balão se desloca para dentro dela. Mexe direto no estilo:
  // é uma medida do DOM, e guardá-la em estado só causaria outra renderização.
  useLayoutEffect(() => {
    const el = balao.current;
    if (!aberto || !el) return;
    el.style.transform = "translateX(-50%)";
    const caixa = el.getBoundingClientRect();
    const sobraEsquerda = MARGEM_DA_TELA - caixa.left;
    const sobraDireita = window.innerWidth - MARGEM_DA_TELA - caixa.right;
    const deslocamento = sobraEsquerda > 0 ? sobraEsquerda : sobraDireita < 0 ? sobraDireita : 0;
    el.style.transform = `translateX(calc(-50% + ${deslocamento}px))`;
  }, [aberto]);

  // Tocar ou clicar fora fecha, e Esc também, estando o foco onde estiver.
  useEffect(() => {
    if (!aberto) return;
    const aoTocarFora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setModo("fechado");
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModo("fechado");
    };
    document.addEventListener("pointerdown", aoTocarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoTocarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <span
      ref={raiz}
      className="relative inline-flex align-middle"
      onPointerEnter={(e) => e.pointerType === "mouse" && setModo((m) => (m === "fechado" ? "passando" : m))}
      onPointerLeave={(e) => e.pointerType === "mouse" && setModo((m) => (m === "passando" ? "fechado" : m))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setModo("fechado");
      }}
    >
      <button
        type="button"
        aria-label={`O que é ${nome}?`}
        aria-describedby={idDoTexto}
        onClick={() => setModo((m) => (m === "fixo" ? "fechado" : "fixo"))}
        className="group -m-3 grid h-11 w-11 touch-manipulation place-items-center rounded-full focus-visible:outline-none"
      >
        <span
          aria-hidden
          className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] leading-none font-semibold transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink ${
            aberto ? "border-ink bg-ink text-white" : "border-mute text-mute hover:border-ink hover:text-ink"
          }`}
        >
          ?
        </span>
      </button>

      {/* Sempre no DOM, para o aria-describedby: `hidden` esconde da vista e o
          leitor de tela ainda lê o conteúdo referenciado. */}
      <span
        ref={balao}
        id={idDoTexto}
        role="tooltip"
        hidden={!aberto}
        className="absolute top-full left-1/2 z-40 mt-3 w-64 max-w-[calc(100vw-16px)] rounded-md bg-ink px-3 py-2.5 text-left text-[13px] leading-[19px] font-normal whitespace-normal text-white shadow-folha"
        style={{ transform: "translateX(-50%)" }}
      >
        {dica.texto}
      </span>
    </span>
  );
}
