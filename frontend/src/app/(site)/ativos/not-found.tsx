import Link from "next/link";
import { Migalhas } from "@/components/ativos/pecas";
import { ROTAS } from "@/lib/navegacao";

export const metadata = { title: "Ativo não encontrado | PortfolioLab" };

/** Ticker que não está no catálogo: diz o que houve e oferece o caminho de volta. */
export default function AtivoNaoEncontrado() {
  const link = "inline-flex min-h-11 items-center rounded text-[15px] font-semibold text-ink underline decoration-1 underline-offset-4";

  return (
    <>
      <Migalhas itens={[{ rotulo: "Início", href: ROTAS.inicio }, { rotulo: "Ativos" }, { rotulo: "Não encontrado" }]} />

      <div className="mt-10 max-w-[560px]">
        <h1 className="font-leitura text-[34px] leading-[42px] font-semibold tracking-[-0.01em] text-balance text-ink">
          Não encontramos esse ativo
        </h1>
        <p className="mt-3 text-base leading-[26px] text-ink-2">
          O endereço pode ter um erro de digitação, ou o ativo ainda não está na nossa lista de 15 ações e 15
          fundos imobiliários. Escolha um da lista:
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1">
          <li>
            <Link href={ROTAS.acoes} className={link}>
              Ver as ações
            </Link>
          </li>
          <li>
            <Link href={ROTAS.fiis} className={link}>
              Ver os fundos imobiliários
            </Link>
          </li>
          <li>
            <Link href={ROTAS.inicio} className={link}>
              Voltar ao início
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
