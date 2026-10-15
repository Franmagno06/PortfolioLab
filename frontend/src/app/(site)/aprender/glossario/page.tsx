import type { Metadata } from "next";
import { TopoDaPagina, TituloDaPagina } from "@/components/aprender/cabecalho-da-pagina";
import { Glossario, type VerbeteDaTela } from "@/components/aprender/glossario";
import { idDoVerbete, letraDoVerbete, VERBETES } from "@/content/aprender/glossario";
import { buscarArtigo } from "@/lib/aprender/artigos";
import { ROTAS } from "@/lib/navegacao";

export const metadata: Metadata = {
  title: "Glossário · PortfolioLab",
  description: "Os termos que aparecem no site, de A a Z, com uma frase simples e o artigo onde cada um é explicado.",
};

export default function GlossarioPage() {
  // O link "Ler o artigo" só existe quando o artigo já foi publicado: nunca aponta para um 404.
  const verbetes: VerbeteDaTela[] = VERBETES.map((v) => {
    const artigo = v.artigo ? buscarArtigo(v.artigo) : undefined;
    return {
      id: idDoVerbete(v),
      termo: v.termo,
      definicao: v.definicao,
      letra: letraDoVerbete(v),
      links: [
        ...(artigo ? [{ rotulo: `Ler o artigo: ${artigo.tituloCurto ?? artigo.titulo}`, href: `${ROTAS.aprender}/${artigo.slug}` }] : []),
        ...(v.consulta ? [v.consulta] : []),
      ],
    };
  }).sort((a, b) => a.termo.localeCompare(b.termo, "pt-BR"));

  return (
    <div className="flex flex-col gap-6">
      <TopoDaPagina trilha={[{ rotulo: "Aprender", href: ROTAS.aprender }, { rotulo: "Glossário" }]} voltar={{ href: ROTAS.aprender, rotulo: "Voltar para Aprender" }} />
      <TituloDaPagina titulo="Glossário">
        Os termos que aparecem no site, de A a Z, com uma frase simples. Onde o termo tem artigo, o link leva até ele.
      </TituloDaPagina>
      <Glossario verbetes={verbetes} />
    </div>
  );
}
