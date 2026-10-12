"use client";

import Link from "next/link";
import { ROTAS } from "@/lib/navegacao";

/**
 * Quando a API de ativos não responde (backend fora do ar, ou a leitura passou do tempo limite),
 * a página mostra isto no lugar do conteúdo; o cabeçalho e o rodapé do site continuam. Neste
 * Next, a função de tentar de novo se chama `retry`, e não `reset`.
 */
export default function ErroDosAtivos({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="max-w-[640px] rounded-md border border-line bg-card p-6">
      <h1 className="font-leitura text-2xl leading-8 font-semibold text-ink">Não conseguimos carregar esta página agora</h1>
      <p className="mt-2 text-[15px] leading-6 text-ink-2">
        Os dados de ativos vêm de fontes externas, e elas não responderam. Isso costuma passar em instantes.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center rounded bg-ink px-4 text-[15px] font-semibold text-white hover:bg-ink-lift"
        >
          Tentar de novo
        </button>
        <Link href={ROTAS.inicio} className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
