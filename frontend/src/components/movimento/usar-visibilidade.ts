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
 *
 * O terceiro valor, `passouPorFora`, diz se alguma leitura viu o elemento inteiramente fora da
 * tela (nenhum pixel visível) antes de ele entrar. Só nesse caso faz sentido animar a chegada: o que já estava à vista na
 * primeira leitura foi visto com o valor final, e animar daria um "pisca" (some e volta).
 */
export function useVisibilidade<T extends Element>(
  limiar: number,
  ativo = true,
): [RefObject<T | null>, Visibilidade, boolean] {
  const ref = useRef<T>(null);
  const [lida, setLida] = useState<"esperando" | "fora" | "entrou">("esperando");
  const [passouPorFora, setPassouPorFora] = useState(false);

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
    // Leitura atrasada depois de entrar (o navegador pode entregar uma após o disconnect) é
    // ignorada: não pode "desver" o elemento nem marcar que ele passou por fora.
    let entrou = false;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entrou) return;
        const entrada = entradas.find((e) => e.target === alvo) ?? entradas[0];
        if (!entrada) return;
        if (chegouAoLimiar(entrada, limiar)) {
          entrou = true;
          observador.disconnect();
          setLida("entrou");
        } else {
          setLida("fora");
          // Só conta como "visto fora" o que não aparece NADA na tela. Um elemento parcialmente
          // visível (ex.: na dobra, 40% com limiar de 50%) já foi visto com o valor final.
          if (!entrada.isIntersecting) setPassouPorFora(true);
        }
      },
      { threshold: LIMIARES.includes(limiar) ? LIMIARES : [...LIMIARES, limiar] },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [ativo, jaEntrou, limiar]);

  return [ref, semObservador ? "sem-observador" : lida, !semObservador && passouPorFora];
}
