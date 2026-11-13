"use client";

import { useState } from "react";

/*
 * "Compartilhar" da ficha de um índice, sem backend: abre o compartilhamento do aparelho (celular) ou
 * copia o link (computador).
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
      <button type="button" className={BOTAO} onClick={compartilhar}>
        Compartilhar
      </button>
      <p role="status" className="min-h-[17px] text-xs leading-[17px] text-mute">
        {aviso}
      </p>
    </div>
  );
}
