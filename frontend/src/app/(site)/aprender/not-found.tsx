import Link from "next/link";
import { TopoDaPagina } from "@/components/aprender/cabecalho-da-pagina";
import { ROTAS } from "@/lib/navegacao";

/** Artigo que não existe (um slug digitado errado, ou um que ainda não foi publicado). */
export default function NaoEncontrado() {
  return (
    <div className="flex flex-col gap-8">
      <TopoDaPagina
        trilha={[{ rotulo: "Aprender", href: ROTAS.aprender }, { rotulo: "Página não encontrada" }]}
        voltar={{ href: ROTAS.aprender, rotulo: "Voltar para Aprender" }}
      />
      <div className="flex max-w-[680px] flex-col items-start gap-3">
        <h1 className="pagina-titulo text-ink">Não encontramos esse artigo</h1>
        <p className="artigo-subtitulo text-ink-2">
          O endereço pode ter um erro de digitação, ou o artigo ainda não foi publicado. Os que já estão no ar ficam na página Aprender.
        </p>
        <Link
          href={ROTAS.aprender}
          className="mt-2 inline-flex min-h-11 items-center rounded bg-ink px-[18px] text-[15px] font-semibold text-white transition-colors hover:bg-ink-lift"
        >
          Ver os artigos
        </Link>
      </div>
    </div>
  );
}
