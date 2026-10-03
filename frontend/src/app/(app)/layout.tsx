import { AbasDaCarteira } from "@/components/site/abas-da-carteira";
import { CabecalhoSite } from "@/components/site/cabecalho-site";

// Área logada: parte do site, e não um painel à parte. O mesmo cabeçalho da
// página inicial (com "Sair" no lugar de "Entrar") e, logo abaixo, as abas da
// carteira — como a "Carteira" do Investidor10. O menu lateral saiu.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Primeiro elemento focável da página: sem ele, quem navega por teclado
          percorre o cabeçalho e as seis abas em cada troca de tela. */}
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>
      <CabecalhoSite area="carteira" />
      <AbasDaCarteira />
      <main
        id="conteudo"
        // O destino de um salto precisa poder receber foco; sem tabIndex o
        // navegador move a âncora mas não o foco do teclado.
        tabIndex={-1}
        className="mx-auto w-full max-w-[1200px] px-6 pt-8 pb-16 outline-none"
      >
        {children}
      </main>
    </>
  );
}
