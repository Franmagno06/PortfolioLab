import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardArtigo } from "@/components/aprender/card-artigo";
import { TopoDaPagina } from "@/components/aprender/cabecalho-da-pagina";
import { EmResumo } from "@/components/aprender/em-resumo";
import { IndiceDoArtigo } from "@/components/aprender/indice-do-artigo";
import { buscarArtigo, listarArtigos } from "@/lib/aprender/artigos";
import { carregarConteudo } from "@/lib/aprender/conteudo";
import { caixaAlta } from "@/lib/aprender/texto";
import { rotuloDaCategoria } from "@/lib/aprender/tipos";
import { dataCurta } from "@/lib/format";
import { ROTAS } from "@/lib/navegacao";

// Os artigos publicados são gerados no build. Um slug que não está na lista cai no notFound() da
// página, que mostra o not-found.tsx de /aprender (com cabeçalho e saída), e não o 404 genérico do
// Next: com dynamicParams = false o Next nem chegava a rodar a página.

export function generateStaticParams() {
  return listarArtigos().map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artigo = buscarArtigo(slug);
  if (!artigo) return {};
  return {
    title: `${artigo.titulo} · PortfolioLab`,
    description: artigo.subtitulo,
    openGraph: {
      type: "article",
      locale: "pt_BR",
      siteName: "PortfolioLab",
      title: artigo.titulo,
      description: artigo.subtitulo,
      modifiedTime: artigo.atualizadoEm,
      section: rotuloDaCategoria(artigo.categoria),
    },
  };
}

export default async function ArtigoPage({ params }: Props) {
  const { slug } = await params;
  const artigo = buscarArtigo(slug);
  if (!artigo) notFound();

  const Conteudo = await carregarConteudo(artigo.slug);
  const relacionados = artigo.relacionados.flatMap((s) => buscarArtigo(s) ?? []);
  const categoria = rotuloDaCategoria(artigo.categoria);

  return (
    <div className="flex flex-col gap-6">
      <TopoDaPagina
        trilha={[
          { rotulo: "Aprender", href: ROTAS.aprender },
          { rotulo: categoria, href: `${ROTAS.aprender}?tema=${artigo.categoria}` },
          { rotulo: artigo.tituloCurto ?? artigo.titulo },
        ]}
        voltar={{ href: ROTAS.aprender, rotulo: "Voltar para Aprender" }}
      />

      {/* minmax(0, 1fr): sem ele, a coluna do grid cresce até a largura de uma tabela larga e a página rola
          para o lado no celular. Com ele, a tabela rola dentro da própria caixa. */}
      <article className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[220px_680px_220px] xl:gap-10">
        <div className="mx-auto w-full max-w-[680px] xl:mx-0 xl:max-w-none">
          <IndiceDoArtigo titulos={artigo.indice} />
        </div>

        <div className="mx-auto flex w-full min-w-0 max-w-[680px] flex-col gap-6 xl:mx-0">
          <header id="topo-do-artigo" className="flex flex-col items-start gap-6">
            <Link
              href={`${ROTAS.aprender}?tema=${artigo.categoria}`}
              className="rounded-full bg-marca-texto px-3 py-1 text-xs leading-4 font-medium tracking-wide text-anotacao"
            >
              {caixaAlta(categoria)}
            </Link>
            <h1 className="artigo-titulo text-ink">{artigo.titulo}</h1>
            <p className="artigo-subtitulo text-ink-2">{artigo.subtitulo}</p>
            <div className="artigo-meta flex w-full items-center gap-2.5 border-y border-pauta py-3 text-ink-2">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white">
                P
              </span>
              <p>
                Equipe PortfolioLab<span aria-hidden>{"  ·  "}</span>
                <span className="sr-only">, </span>
                {artigo.tempoLeitura} min de leitura<span aria-hidden>{"  ·  "}</span>
                <span className="sr-only">, </span>
                Atualizado em {dataCurta(artigo.atualizadoEm)}
              </p>
            </div>
          </header>

          <EmResumo itens={artigo.resumo} />

          <Conteudo />

          <footer className="flex flex-col gap-1 text-[13px] leading-[19px] text-mute">
            <p>
              Fontes:{" "}
              {artigo.fontes.map((f, i) => (
                <span key={f.rotulo}>
                  {i > 0 && ". "}
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="rounded underline decoration-1 underline-offset-4">
                      {f.rotulo}
                    </a>
                  ) : (
                    f.rotulo
                  )}
                </span>
              ))}
              . Conteúdo educacional, não é recomendação de investimento.
            </p>
          </footer>
        </div>
      </article>

      {relacionados.length > 0 && (
        <section aria-labelledby="continue-lendo" className="flex flex-col gap-4 pt-6">
          <h2 id="continue-lendo" className="font-leitura text-2xl leading-[30px] font-semibold text-ink">
            Continue lendo
          </h2>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {relacionados.slice(0, 3).map((r) => (
              <li key={r.slug} className="flex [&>article]:flex-1">
                <CardArtigo artigo={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
