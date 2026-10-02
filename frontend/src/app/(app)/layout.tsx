import { Sidebar, TopbarMobile } from "@/components/sidebar";

// Área logada: coluna fixa a partir de lg, gaveta abaixo disso.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Primeiro elemento focável da página: sem ele, quem navega por teclado
          percorre os sete itens da navegação em cada troca de tela. */}
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>
      <TopbarMobile />
      <Sidebar />
      <main
        id="conteudo"
        // O destino de um salto precisa poder receber foco; sem tabIndex o
        // navegador move a âncora mas não o foco do teclado.
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        {children}
      </main>
    </div>
  );
}
