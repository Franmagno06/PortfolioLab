"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * Em que pé está um elemento em relação à tela:
 * - "esperando": render do servidor e primeiro render do cliente, antes da primeira leitura;
 * - "fora": a primeira leitura disse que ainda não chegou ao limiar;
 * - "entrou": chegou ao limiar (uma vez; daqui não volta);
 * - "sem-observador": o navegador não tem IntersectionObserver, então o conteúdo aparece já.
 */
export type Visibilidade = "esperando" | "fora" | "entrou" | "sem-observador";

// 21 limiares (0, 5%, …, 100%): o navegador só avisa ao cruzar um limiar, e o bloco
// mais alto que a tela precisa de leituras intermediárias para a regra da altura abaixo.
const LIMIARES = Array.from({ length: 21 }, (_, i) => i / 20);

const nadaParaAssinar = () => () => {};

/**
 * Entrou quando a fração visível chega ao limiar OU quando o pedaço visível já cobre essa
 * fração da altura da tela: um bloco de 3000 px num celular de 800 px nunca passa de 27%
 * visível, e sem a segunda regra ficaria invisível para sempre.
 */
function chegouAoLimiar(entrada: IntersectionObserverEntry, limiar: number): boolean {
  if (!entrada.isIntersecting) return false;
  if (entrada.intersectionRatio >= limiar) return true;
  const alturaDaTela = entrada.rootBounds?.height ?? window.innerHeight;
  return alturaDaTela > 0 && entrada.intersectionRect.height >= alturaDaTela * limiar;
}

/**
 * Observa um elemento até ele entrar na tela uma vez e então desliga o observador.
 * `ativo = false` adia a observação (ex.: o elemento ainda não foi renderizado).
 */
export function useVisibilidade<T extends Element>(
  limiar: number,
  ativo = true,
): [RefObject<T | null>, Visibilidade] {
  const ref = useRef<T>(null);
  const [lida, setLida] = useState<"esperando" | "fora" | "entrou">("esperando");

  // useSyncExternalStore dá `false` no servidor e na hidratação e o valor real logo depois,
  // sem setState dentro de efeito e sem diferença de HTML entre servidor e cliente.
  const semObservador = useSyncExternalStore(
    nadaParaAssinar,
    () => typeof IntersectionObserver === "undefined",
    () => false,
  );

  const jaEntrou = lida === "entrou";
  useEffect(() => {
    const alvo = ref.current;
    if (!ativo || jaEntrou || !alvo || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const entrada = entradas.find((e) => e.target === alvo) ?? entradas[0];
        if (!entrada) return;
        if (chegouAoLimiar(entrada, limiar)) {
          observador.disconnect();
          setLida("entrou");
        } else {
          // Leitura atrasada depois de entrar não pode "desver" o elemento.
          setLida((atual) => (atual === "entrou" ? atual : "fora"));
        }
      },
      { threshold: LIMIARES.includes(limiar) ? LIMIARES : [...LIMIARES, limiar] },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [ativo, jaEntrou, limiar]);

  return [ref, semObservador ? "sem-observador" : lida];
}
