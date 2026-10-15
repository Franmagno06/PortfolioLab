import { Migalhas, Voltar, type Migalha } from "@/components/ativos/pecas";
import { ROTAS } from "@/lib/navegacao";

/**
 * O alto de toda página de Aprender: trilha de navegação e "Voltar". As páginas de consulta
 * (glossário, indicadores, como calculamos) acrescentam o <TituloDaPagina>; o artigo monta o
 * título à sua maneira e usa só o início.
 */
export function TopoDaPagina({ trilha, voltar }: { trilha: Migalha[]; voltar: { href: string; rotulo: string } }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Migalhas itens={[{ rotulo: "Início", href: ROTAS.inicio }, ...trilha]} />
      <Voltar href={voltar.href} rotulo={voltar.rotulo} />
    </div>
  );
}

export function TituloDaPagina({
  titulo,
  children,
  anotacao,
}: {
  titulo: string;
  children?: React.ReactNode;
  anotacao?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="pagina-titulo text-ink">{titulo}</h1>
      {children && <p className="max-w-[720px] text-[15px] leading-[22px] text-ink-2">{children}</p>}
      {anotacao && (
        <p className="max-w-[720px] text-[15px] leading-[22px] font-medium text-anotacao">
          <span aria-hidden>↳ </span>
          {anotacao}
        </p>
      )}
    </header>
  );
}
