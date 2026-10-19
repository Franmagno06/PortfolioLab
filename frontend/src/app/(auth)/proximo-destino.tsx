"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { comNext } from "@/lib/navegacao";

// O `?next=` das telas de login e cadastro: a página que o visitante pediu
// antes de ser mandado para cá (src/proxy.ts) ou em que a sessão caiu
// (lib/api.ts). Quem decide se ele vale é `destinoDepoisDoLogin`.
//
// useSearchParams() fica só nestes pedaços, cada um sob <Suspense>, pelo mesmo
// motivo do AvisoSessaoExpirada: na árvore da página inteira, ele a tornaria
// dinâmica e /login e /registro deixariam de ser prerenderizadas.

function LerNext({ aoLer }: { aoLer: (next: string | null) => void }) {
  const next = useSearchParams().get("next");
  useEffect(() => aoLer(next), [next, aoLer]);
  return null;
}

/** Entrega o `next` cru da URL ao formulário, que o valida na hora de redirecionar. */
export function GuardarNext({ aoLer }: { aoLer: (next: string | null) => void }) {
  return (
    <Suspense fallback={null}>
      <LerNext aoLer={aoLer} />
    </Suspense>
  );
}

type PropsLink = { rota: string; className?: string; children: ReactNode };

function LinkComNextLido({ rota, className, children }: PropsLink) {
  return (
    <Link href={comNext(rota, useSearchParams().get("next"))} className={className}>
      {children}
    </Link>
  );
}

/**
 * Link entre login e cadastro que leva o `next` junto, só se ele for válido.
 * O fallback é o mesmo link sem `next`: o HTML prerenderizado já sai com ele.
 */
export function LinkComNext(props: PropsLink) {
  const semNext = (
    <Link href={props.rota} className={props.className}>
      {props.children}
    </Link>
  );
  return (
    <Suspense fallback={semNext}>
      <LinkComNextLido {...props} />
    </Suspense>
  );
}
