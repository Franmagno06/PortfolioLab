"use client";

import { useState } from "react";

/*
 * "Seguir" e "Compartilhar" da ficha de um índice, sem backend.
 *  - Compartilhar abre o compartilhamento do aparelho (celular) ou copia o link (computador).
 *  - Seguir ainda não existe: guardar o índice exigiria conta e banco. O botão diz isso, em vez de
 *    fingir que salvou alguma coisa.
 */

const BOTAO =
  "inline-flex min-h-10 items-center gap-1.5 rounded-md border border-pauta bg-card px-3.5 text-[13px] leading-[19px] font-medium text-ink hover:border-ink";

export function BotoesDaFicha({ nome }: { nome: string }) {
  const [aviso, setAviso] = useState("");

  async function compartilhar() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${nome} | PortfolioLab`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado.");
    } catch {
      // A pessoa fechou o compartilhamento, ou o navegador não deixou copiar: nada a avisar.
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex gap-2">
        <button type="button" className={BOTAO} onClick={() => setAviso("Seguir um índice ainda não está disponível.")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
          </svg>
          Seguir
        </button>
        <button type="button" className={BOTAO} onClick={compartilhar}>
          Compartilhar
        </button>
      </div>
      <p role="status" className="min-h-[17px] text-xs leading-[17px] text-mute">
        {aviso}
      </p>
    </div>
  );
}
