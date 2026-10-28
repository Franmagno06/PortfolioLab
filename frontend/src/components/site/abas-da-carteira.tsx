"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  IconeCalculo,
  IconeDocumento,
  IconeGrade,
  IconeIndicadores,
  IconeJornal,
  IconePasta,
} from "@/components/ui/icones";
import { ABAS_DA_CARTEIRA, type AbaDaCarteira } from "@/lib/navegacao";

const ICONES: Record<AbaDaCarteira["id"], () => React.ReactElement> = {
  resumo: () => <IconeGrade />,
  posicoes: () => <IconePasta />,
  simulacao: () => <IconeCalculo />,
  relatorios: () => <IconeDocumento />,
  indicadores: () => <IconeIndicadores />,
  noticias: () => <IconeJornal />,
};

/**
 * Abas da área logada, logo abaixo do cabeçalho do site. São links entre
 * páginas, e não um tablist: cada aba é uma rota, e aria-current marca a atual.
 * No celular a fila rola para o lado, e a aba atual entra na tela sozinha.
 * Cada aba usa .interativo com o modificador .interativo-aba: não sobe nem ganha sombra (o nav
 * cortaria os dois), só o traço escurece no hover e no foco; o da aba atual fica na cor da tinta (globals.css).
 */
export function AbasDaCarteira() {
  const rota = usePathname();
  const atual = useRef<HTMLAnchorElement>(null);

  // Efeito de DOM, e não de estado: só rola a fila até a aba da página.
  useEffect(() => {
    atual.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [rota]);

  return (
    <nav aria-label="Minha carteira" className="border-b border-pauta bg-card">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <ul role="list" className="-mb-px flex gap-7 overflow-x-auto [scrollbar-width:none]">
          {ABAS_DA_CARTEIRA.map((aba) => {
            const ativa = rota === aba.href || rota.startsWith(`${aba.href}/`);
            const Icone = ICONES[aba.id];
            return (
              <li key={aba.id} className="shrink-0">
                <Link
                  ref={ativa ? atual : undefined}
                  href={aba.href}
                  aria-current={ativa ? "page" : undefined}
                  className={`interativo interativo-aba flex min-h-11 items-center gap-2 border-b-2 py-4 text-[15px] font-medium whitespace-nowrap ${
                    ativa
                      ? "border-ink text-ink"
                      : "border-transparent text-ink-2 hover:text-ink focus-visible:text-ink"
                  }`}
                >
                  <span className={ativa ? "text-ink" : "text-mute"}>
                    <Icone />
                  </span>
                  {aba.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
