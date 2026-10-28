"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type VerbeteDaTela = {
  id: string;
  termo: string;
  definicao: string;
  letra: string;
  /** Os destinos do verbete: o artigo (se já publicado) e a página de consulta. */
  links: { rotulo: string; href: string }[];
};

const MARCAS_DE_ACENTO = /[̀-ͯ]/g;
const normalizar = (s: string) => s.normalize("NFD").replace(MARCAS_DE_ACENTO, "").toLowerCase();

/**
 * Busca, índice A–Z e a lista de verbetes. A lista inteira vem renderizada do servidor (então um
 * link como /aprender/glossario#data-ex cai no verbete mesmo antes de o JavaScript carregar) e a
 * busca só esconde o que não casa, enquanto a pessoa digita. Tudo se usa pelo teclado: o campo é
 * um <input type="search">, as letras são links âncora e cada verbete tem foco de rolagem próprio.
 */
export function Glossario({ verbetes }: { verbetes: VerbeteDaTela[] }) {
  const [busca, setBusca] = useState("");
  const consulta = normalizar(busca.trim());

  const todasAsLetras = useMemo(() => [...new Set(verbetes.map((v) => v.letra))], [verbetes]);

  const visiveis = useMemo(
    () => (consulta ? verbetes.filter((v) => normalizar(`${v.termo} ${v.definicao}`).includes(consulta)) : verbetes),
    [verbetes, consulta],
  );
  const letrasComResultado = new Set(visiveis.map((v) => v.letra));

  return (
    <div className="flex flex-col gap-6">
      <div role="search" className="flex flex-col gap-2">
        <label htmlFor="busca-do-glossario" className="sr-only">
          Buscar um termo
        </label>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-pauta bg-card px-[18px] text-mute focus-within:border-ink focus-within:ring-2 focus-within:ring-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="busca-do-glossario"
            name="busca"
            type="search"
            spellCheck={false}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar um termo (ex.: data-ex, P/VP, CDI)"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-[52px] w-full bg-transparent text-[15px] leading-[22px] text-ink outline-none placeholder:text-mute"
          />
        </div>
        <p role="status" className="sr-only">
          {consulta ? `${visiveis.length} ${visiveis.length === 1 ? "termo encontrado" : "termos encontrados"}` : ""}
        </p>
      </div>

      <nav aria-label="Ir para a letra">
        <ul className="flex flex-wrap gap-2">
          {todasAsLetras.map((letra) => {
            const ativa = letrasComResultado.has(letra);
            const base = "inline-flex size-11 items-center justify-center rounded-lg border text-[15px] leading-[22px] font-semibold";
            return (
              <li key={letra}>
                {ativa ? (
                  <a href={`#letra-${letra.toLowerCase()}`} className={`${base} toque border-pauta bg-card text-ink hover:border-ink focus-visible:border-ink`}>
                    <span aria-hidden>{letra}</span>
                    <span className="sr-only">Letra {letra}</span>
                  </a>
                ) : (
                  <span aria-disabled="true" className={`${base} border-pauta bg-paper text-mute opacity-60`}>
                    <span aria-hidden>{letra}</span>
                    <span className="sr-only">Letra {letra}, sem resultados</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-pauta bg-card p-6">
          <p className="font-leitura text-lg font-semibold text-ink">Nenhum termo encontrado para “{busca.trim()}”.</p>
          <p className="text-[15px] leading-[22px] text-ink-2">Tente outra palavra, ou procure pela letra com que o termo começa.</p>
          <button
            type="button"
            onClick={() => setBusca("")}
            className="toque inline-flex min-h-11 items-center rounded border border-ink bg-card px-[18px] text-[15px] font-semibold text-ink hover:bg-paper"
          >
            Limpar a busca
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-pauta bg-card">
          {todasAsLetras
            .filter((letra) => letrasComResultado.has(letra))
            .map((letra) => (
              <section key={letra} id={`letra-${letra.toLowerCase()}`} aria-labelledby={`titulo-letra-${letra.toLowerCase()}`} className="flex scroll-mt-24 flex-col gap-3 border-t border-pauta p-6 first:border-t-0 sm:flex-row sm:gap-6">
                <h2 id={`titulo-letra-${letra.toLowerCase()}`} className="font-leitura text-4xl leading-[44px] font-bold text-anotacao sm:w-14 sm:shrink-0">
                  {letra}
                </h2>
                <dl className="flex min-w-0 flex-1 flex-col gap-5">
                  {visiveis
                    .filter((v) => v.letra === letra)
                    .map((v) => (
                      <div key={v.id} id={v.id} className="flex scroll-mt-24 flex-col gap-1 rounded target:bg-marca-texto target:outline-8 target:outline-marca-texto">
                        <dt className="font-leitura text-base leading-[22px] font-semibold text-ink">{v.termo}</dt>
                        <dd className="flex flex-col gap-1">
                          <span className="text-[15px] leading-[22px] text-ink-2">{v.definicao}</span>
                          {v.links.length > 0 && (
                            <span className="flex flex-wrap gap-x-5">
                              {v.links.map((l) => (
                                <Link key={l.href} href={l.href} className="toque inline-flex min-h-11 items-center rounded text-[13px] leading-[19px] font-medium text-anotacao underline decoration-1 underline-offset-4">
                                  {l.rotulo}
                                  <span aria-hidden className="seta">&nbsp;→</span>
                                </Link>
                              ))}
                            </span>
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
