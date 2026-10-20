import Link from "next/link";
import { Migalhas } from "@/components/ativos/pecas";
import { INDICES, rotaDoIndice } from "@/lib/indices";
import { ROTAS } from "@/lib/navegacao";

export const metadata = { title: "Índice não encontrado | PortfolioLab" };

/** Endereço de índice que não existe: diz o que houve e lista os oito que existem. */
export default function IndiceNaoEncontrado() {
  const link = "inline-flex min-h-11 items-center rounded text-[15px] font-semibold text-ink underline decoration-1 underline-offset-4";

  return (
    <>
      <Migalhas
        itens={[
          { rotulo: "Início", href: ROTAS.inicio },
          { rotulo: "Ativos" },
          { rotulo: "Índices", href: ROTAS.indices },
          { rotulo: "Não encontrado" },
        ]}
      />

      <div className="mt-10 max-w-[560px]">
        <h1 className="font-leitura text-[34px] leading-[42px] font-semibold tracking-[-0.01em] text-balance text-ink">
          Não encontramos esse índice
        </h1>
        <p className="mt-3 text-base leading-[26px] text-ink-2">
          O endereço pode ter um erro de digitação, ou o índice ainda não está na nossa lista. Estes são os que existem:
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1">
          {INDICES.map((i) => (
            <li key={i.slug}>
              <Link href={rotaDoIndice(i.slug)} className={link}>
                {i.nome}
              </Link>
            </li>
          ))}
          <li>
            <Link href={ROTAS.indices} className={link}>
              Ver todos os índices
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
