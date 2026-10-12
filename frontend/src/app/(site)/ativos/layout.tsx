import { CabecalhoSite } from "@/components/site/cabecalho-site";
import { RodapeSite } from "@/components/site/rodape-site";

/**
 * Moldura das quatro páginas de ativos: o mesmo cabeçalho e o mesmo rodapé da
 * página inicial, em todas. Ficam aqui, e não em cada página, para não haver
 * como uma delas sair diferente. O fundo é o papel do caderno: as fichas são
 * folhas brancas sobre ele.
 */
export default function AtivosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper">
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>
      <CabecalhoSite />
      <main id="conteudo" className="mx-auto min-h-[70vh] w-full max-w-[1200px] px-6 pt-8 pb-20">
        {children}
      </main>
      <RodapeSite />
    </div>
  );
}
