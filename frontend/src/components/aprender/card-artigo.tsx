import Link from "next/link";
import { caixaAlta } from "@/lib/aprender/texto";
import { rotuloDaCategoria, type Artigo } from "@/lib/aprender/tipos";

export type ResumoDeArtigo = Pick<Artigo, "slug" | "titulo" | "subtitulo" | "categoria" | "tempoLeitura">;

/**
 * O card de um artigo, no índice e em "Continue lendo". O card inteiro é o link, com o título como
 * texto dele: o leitor de tela anuncia o título, e quem usa mouse clica em qualquer ponto.
 */
export function CardArtigo({ artigo }: { artigo: ResumoDeArtigo }) {
  return (
    <article className="group relative flex flex-col gap-2.5 rounded-xl border border-pauta bg-card p-6 transition-colors focus-within:border-ink hover:border-ink">
      <p className="text-xs leading-4 font-medium tracking-wide text-anotacao">{caixaAlta(rotuloDaCategoria(artigo.categoria))}</p>
      <h3 className="font-leitura text-xl leading-[26px] font-semibold text-balance text-ink">
        <Link href={`/aprender/${artigo.slug}`} className="rounded after:absolute after:inset-0 after:rounded-xl after:content-['']">
          {artigo.titulo}
        </Link>
      </h3>
      <p className="text-[15px] leading-[22px] text-ink-2">{artigo.subtitulo}</p>
      <p className="artigo-meta mt-auto pt-1 text-mute">{artigo.tempoLeitura} min de leitura</p>
    </article>
  );
}
