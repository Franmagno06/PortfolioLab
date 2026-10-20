"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROTAS } from "@/lib/navegacao";

/**
 * Faixa logo abaixo das abas da carteira, só na conta de demonstração: avisa
 * antes de o visitante tentar gravar algo e receber o 403 do servidor.
 *
 * Enquanto consulta (e em qualquer erro, ou conta normal) não renderiza nada
 * nem reserva espaço: a página nunca espera por este aviso. Uma consulta por
 * montagem — o layout da área logada permanece montado entre as abas.
 *
 * Um 401 aqui significa sessão morta, e `api()` já a encerra (a mesma coisa
 * que as páginas da área fazem na primeira chamada); encerrarSessao é
 * idempotente, então a corrida entre elas termina no mesmo /login.
 */
export function AvisoDemo() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let ativo = true;
    api<{ demo: boolean }>("/auth/me")
      .then((eu) => {
        if (ativo) setDemo(eu.demo === true);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  if (!demo) return null;

  return (
    <div role="status" className="border-b border-etf/30 bg-etf/7">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-1 px-6 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p>
          Você está na carteira de demonstração: dá para olhar tudo e simular aportes, mas não
          gravar operações.
        </p>
        <Link
          href={ROTAS.registro}
          className="shrink-0 font-semibold text-ink underline underline-offset-2 hover:text-ink-2"
        >
          Criar minha conta
        </Link>
      </div>
    </div>
  );
}
