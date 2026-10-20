"use client";

import { usePathname, useRouter } from "next/navigation";
import { ORDENS, type Categoria, type Ordem } from "@/lib/indices";

/**
 * "Ordenar por" da listagem. O estado fica na URL (?ordem=), como o da categoria: a página é montada
 * no servidor a partir dela, então o link compartilhado abre na mesma ordem. Sem JavaScript, o
 * formulário GET faz o mesmo com o botão "Aplicar".
 */
export function OrdenarIndices({ ordem, categoria }: { ordem: Ordem; categoria: Categoria | null }) {
  const router = useRouter();
  const caminho = usePathname();

  function aplicar(nova: string) {
    const params = new URLSearchParams();
    if (categoria) params.set("categoria", categoria);
    if (nova !== "buscados") params.set("ordem", nova);
    const busca = params.toString();
    router.replace(busca ? `${caminho}?${busca}` : caminho, { scroll: false });
  }

  return (
    <form method="get" className="flex items-center gap-3" onSubmit={(e) => e.preventDefault()}>
      {categoria && <input type="hidden" name="categoria" value={categoria} />}
      <label htmlFor="ordem-dos-indices" className="text-[15px] leading-[22px] font-semibold whitespace-nowrap text-ink">
        Ordenar por
      </label>
      <select
        id="ordem-dos-indices"
        name="ordem"
        value={ordem}
        onChange={(e) => aplicar(e.target.value)}
        className="min-h-11 rounded-full border border-pauta bg-card py-2 pr-9 pl-4 text-[15px] leading-[22px] font-medium text-ink"
      >
        {ORDENS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-sm font-semibold text-ink underline">
          Aplicar
        </button>
      </noscript>
    </form>
  );
}
