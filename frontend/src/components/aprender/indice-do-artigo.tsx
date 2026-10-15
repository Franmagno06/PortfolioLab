"use client";

import { useEffect, useState } from "react";
import type { Titulo } from "@/lib/aprender/tipos";

/**
 * "Neste artigo". No desktop largo é uma coluna que acompanha a rolagem, com o item da seção que
 * está na tela marcado (aria-current). Abaixo disso vira um bloco recolhível no topo, para não
 * empurrar o texto para baixo. As duas versões ficam no HTML e o CSS esconde uma: a escondida sai
 * da árvore de acessibilidade, então o leitor de tela encontra um índice só.
 */
export function IndiceDoArtigo({ titulos }: { titulos: Titulo[] }) {
  const [atual, setAtual] = useState<string | null>(titulos[0]?.id ?? null);

  useEffect(() => {
    if (titulos.length === 0) return;
    // Vale a seção cujo título entrou na faixa de cima da tela (abaixo do cabeçalho fixo).
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtual(visivel.target.id);
      },
      { rootMargin: "-88px 0px -65% 0px" },
    );
    for (const t of titulos) {
      const el = document.getElementById(t.id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, [titulos]);

  if (titulos.length === 0) return null;

  const lista = (
    <ol className="flex flex-col gap-2">
      {titulos.map((t) => {
        const ehAtual = t.id === atual;
        return (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              aria-current={ehAtual ? "true" : undefined}
              onClick={() => setAtual(t.id)}
              className={`block min-h-11 border-l-2 py-2.5 pl-3 text-[15px] leading-[22px] xl:min-h-0 xl:py-1 ${
                ehAtual ? "border-anotacao font-semibold text-anotacao" : "border-pauta text-ink-2 hover:text-ink"
              }`}
            >
              {t.texto}
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <details className="rounded-xl border border-pauta bg-card px-4 xl:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center text-[15px] leading-[22px] font-semibold text-ink">
          Neste artigo
        </summary>
        <nav aria-label="Neste artigo" className="pb-3">
          {lista}
        </nav>
      </details>
      <nav aria-label="Neste artigo" className="hidden flex-col gap-3 xl:sticky xl:top-24 xl:flex">
        <p className="text-xs leading-4 font-medium tracking-wide text-mute uppercase">Neste artigo</p>
        {lista}
        <a
          href="#topo-do-artigo"
          className="mt-1 inline-flex min-h-11 items-center text-[13px] leading-[19px] font-medium text-mute hover:text-ink"
        >
          <span aria-hidden>↑&nbsp;</span>Voltar ao topo
        </a>
      </nav>
    </>
  );
}
