import Link from "next/link";
import { dataCurta } from "@/lib/format";
import { caixaAlta } from "@/lib/aprender/texto";
import { rotuloDaCategoria, type Artigo } from "@/lib/aprender/tipos";

/** A folha de caderno do destaque: pauta, margem roxa, a conta em duas linhas e uma anotação. */
function FolhaDeCaderno({ linhas, nota }: { linhas: readonly [string, string]; nota: string }) {
  return (
    <div aria-hidden className="relative h-[220px] overflow-hidden rounded-[10px] bg-paper md:h-[260px]">
      {[30, 60, 90, 120, 150, 180, 210, 240].map((topo) => (
        <div key={topo} className="absolute right-0 left-0 h-px bg-pauta" style={{ top: topo }} />
      ))}
      <div className="absolute top-0 bottom-0 left-10 w-0.5 bg-anotacao-margem md:left-14" />
      <p className="tnum absolute top-12 left-14 text-2xl leading-9 font-semibold text-ink md:top-[62px] md:left-20 md:text-[30px]">{linhas[0]}</p>
      <p className="tnum absolute top-[90px] left-14 text-2xl leading-9 font-semibold text-anotacao md:top-[108px] md:left-20 md:text-[30px]">{linhas[1]}</p>
      <p className="absolute right-4 bottom-8 left-14 text-sm leading-[22px] font-medium text-anotacao md:right-auto md:bottom-auto md:left-20 md:top-[186px] md:text-[15px]">
        <span>↳ </span>
        {nota}
      </p>
    </div>
  );
}

/** O artigo que abre o índice: texto à esquerda, folha de caderno à direita (empilhados no celular). */
export function ArtigoEmDestaque({ artigo }: { artigo: Artigo }) {
  return (
    <section aria-labelledby="titulo-destaque" className="interativo grid items-center gap-8 rounded-2xl border border-pauta bg-card p-6 md:p-10 lg:grid-cols-[1fr_480px] lg:gap-12">
      <div className="flex flex-col items-start gap-4">
        <p className="rounded-full bg-marca-texto px-3 py-1 text-xs leading-4 font-medium tracking-wide text-anotacao">
          {caixaAlta(`Em destaque · ${rotuloDaCategoria(artigo.categoria)}`)}
        </p>
        <h2 id="titulo-destaque" className="font-leitura text-[26px] leading-9 font-semibold text-balance text-ink md:text-[28px]">
          {artigo.titulo}
        </h2>
        <p className="artigo-subtitulo text-ink-2">{artigo.subtitulo}</p>
        <p className="artigo-meta text-mute">
          {artigo.tempoLeitura} min de leitura · Atualizado em {dataCurta(artigo.atualizadoEm)}
        </p>
        <Link
          href={`/aprender/${artigo.slug}`}
          className="inline-flex min-h-11 items-center justify-center rounded bg-ink px-[18px] py-[11px] text-[15px] leading-[22px] font-semibold text-white transition-colors hover:bg-ink-lift"
        >
          Ler o artigo<span className="sr-only">: {artigo.titulo}</span>
          <span aria-hidden className="seta">&nbsp;→</span>
        </Link>
      </div>
      {artigo.ilustracao && <FolhaDeCaderno linhas={artigo.ilustracao.linhas} nota={artigo.ilustracao.nota} />}
    </section>
  );
}
