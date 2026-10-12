import Link from "next/link";
import { Marca, Wordmark } from "@/components/ui/marca";
import { RODAPE, ROTAS } from "@/lib/navegacao";

/** O rodapé do site público: o mesmo na página inicial e nas páginas de ativos. */
export function RodapeSite() {
  return (
    <footer data-superficie="navy" className="border-t border-white/14 bg-ink text-white">
      <div className="mx-auto w-full max-w-[1200px] px-6 pt-14 pb-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div>
            <Link href={ROTAS.inicio} className="inline-flex items-center gap-2 rounded">
              <Marca tamanho={24} />
              <Wordmark className="text-[19px] text-white" />
            </Link>
            <p className="mt-3 font-leitura text-base text-white/78 italic">Aprenda investindo, com calma.</p>
          </div>
          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-10 gap-y-8 sm:flex sm:gap-10">
            {RODAPE.map((coluna) => (
              <div key={coluna.titulo} className="sm:w-40">
                <p className="text-sm font-semibold text-white">{coluna.titulo}</p>
                <ul className="mt-2.5 space-y-2.5">
                  {coluna.links.map((link) => (
                    <li key={link.rotulo}>
                      <Link href={link.href} className="text-sm text-white/78 hover:text-white">
                        {link.rotulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-12 border-t border-white/14 pt-5 text-[13px] text-white/62">
          Projeto educacional. Nada aqui é recomendação de investimento. Cotações da B3 via Yahoo Finance, com
          atraso; taxas do Banco Central.
        </p>
      </div>
    </footer>
  );
}
