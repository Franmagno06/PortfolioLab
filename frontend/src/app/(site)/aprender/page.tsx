import type { Metadata } from "next";
import Link from "next/link";
import { ArtigoEmDestaque } from "@/components/aprender/artigo-em-destaque";
import { TopoDaPagina } from "@/components/aprender/cabecalho-da-pagina";
import { ListaDeArtigos } from "@/components/aprender/lista-de-artigos";
import { artigoEmDestaque, listarArtigos } from "@/lib/aprender/artigos";
import { ehCategoria } from "@/lib/aprender/tipos";
import { ROTAS } from "@/lib/navegacao";

export const metadata: Metadata = {
  title: "Aprender · PortfolioLab",
  description:
    "Artigos curtos, sem jargão, sobre investir de verdade: com as contas feitas em reais e as armadilhas explicadas. Conteúdo educacional, não recomendação.",
};

const ATALHOS = [
  { titulo: "Glossário", texto: "Todos os termos do site, de A a Z, com exemplo curto.", href: ROTAS.glossario },
  { titulo: "Indicadores explicados", texto: "P/L, P/VP, DY, ROE e outros: fórmula, como ler e armadilha.", href: ROTAS.indicadoresExplicados },
  { titulo: "Como o site calcula", texto: "Preço médio, proventos e aporte: as contas feitas pelo PortfolioLab.", href: ROTAS.comoCalculamos },
] as const;

/**
 * O índice dos artigos. Lê o filtro da URL no servidor (?tema= e ?todos=1), então a página não é
 * pré-renderizada: a lista é barata e o filtro funciona como link, sem JavaScript.
 */
export default async function AprenderPage({ searchParams }: { searchParams: Promise<{ tema?: string; todos?: string }> }) {
  const { tema: temaBruto, todos } = await searchParams;
  const tema = ehCategoria(temaBruto) ? temaBruto : null;
  const artigos = listarArtigos();
  const destaque = artigoEmDestaque();

  return (
    <div className="flex flex-col gap-8">
      <TopoDaPagina trilha={[{ rotulo: "Aprender" }]} voltar={{ href: ROTAS.inicio, rotulo: "Voltar para o início" }} />

      <header className="flex flex-col gap-2">
        <h1 className="pagina-titulo text-ink">Aprender</h1>
        <p className="artigo-subtitulo max-w-[760px] text-ink-2">
          Artigos curtos, sem jargão, sobre investir de verdade: com as contas feitas em reais e as armadilhas explicadas. Conteúdo
          educacional, não recomendação.
        </p>
      </header>

      {destaque && <ArtigoEmDestaque artigo={destaque} />}

      <ListaDeArtigos artigos={artigos} tema={tema} todos={todos === "1"} />

      <section aria-labelledby="titulo-consulta" className="flex flex-col gap-6">
        <h2 id="titulo-consulta" className="font-leitura text-2xl leading-[30px] font-semibold text-ink">
          Consulta rápida
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {ATALHOS.map((a) => (
            <li key={a.href} className="flex">
              <Link
                href={a.href}
                className="interativo flex w-full flex-col gap-1.5 rounded-xl border border-l-4 border-pauta bg-card p-5"
              >
                <span className="font-leitura text-base leading-[22px] font-semibold text-ink">{a.titulo}</span>
                <span className="text-[13px] leading-[19px] text-ink-2">{a.texto}</span>
                <span className="mt-auto pt-1 text-[15px] leading-[22px] font-semibold text-anotacao">
                  Abrir<span className="sr-only">: {a.titulo}</span>
                  <span aria-hidden className="seta">&nbsp;→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[13px] leading-[19px] text-mute">
        Os números de mercado mudam. Cada artigo mostra a fonte e a data do dado usado no exemplo.
      </p>
    </div>
  );
}
