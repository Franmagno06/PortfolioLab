import { CabecalhoSite } from "@/components/site/cabecalho-site";
import { RodapeSite } from "@/components/site/rodape-site";

/**
 * Moldura de toda a aba Aprender: o mesmo cabeçalho e rodapé da página inicial e dos ativos, sem
 * nenhuma aba do menu marcada como atual. O miolo tem 1200 px úteis (1248 menos o respiro de 24
 * de cada lado): é a largura em que o artigo cabe em três colunas, 220 + 40 + 680 + 40 + 220. A
 * coluna de leitura de 680 px é a medida de ~70 caracteres por linha que a Literata pede.
 */
export default function AprenderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper">
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>
      <CabecalhoSite />
      <main id="conteudo" className="mx-auto min-h-[70vh] w-full max-w-[1248px] px-6 pt-8 pb-20">
        {children}
      </main>
      <RodapeSite />
    </div>
  );
}
