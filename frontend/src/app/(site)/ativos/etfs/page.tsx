import type { Metadata } from "next";
import { ListaDeEtfs } from "@/components/ativos/lista-de-ativos";
import { Anotacao, Migalhas } from "@/components/ativos/pecas";
import { listarEtfs } from "@/lib/ativos-api";
import { ROTAS } from "@/lib/navegacao";

export const metadata: Metadata = {
  title: "ETFs: 10 fundos de índice para olhar de perto | PortfolioLab",
  description:
    "Uma lista de 10 ETFs da B3 com categoria, índice acompanhado, preço, variação em 12 meses e dividend yield, cada indicador explicado em uma frase.",
};

// Montada a cada visita; a resposta do backend fica 2 min no cache do Next (ver ativos-api.ts).
// Sem isso o Next tentaria montar a página no build, quando o backend pode nem estar no ar.
export const revalidate = 0;

export default async function EtfsPage() {
  const etfs = await listarEtfs();

  return (
    <>
      <Migalhas itens={[{ rotulo: "Início", href: ROTAS.inicio }, { rotulo: "Ativos" }, { rotulo: "ETFs" }]} />

      <header className="mt-6 mb-8 max-w-[760px]">
        <h1 className="font-leitura text-[34px] leading-[42px] font-semibold tracking-[-0.01em] text-balance text-ink lg:text-[40px] lg:leading-[48px]">
          ETFs
        </h1>
        <p className="mt-2 text-base leading-[26px] text-ink-2">
          Um ETF é um fundo que copia um índice e é negociado na bolsa como uma ação. Com uma cota só, você fica
          exposto a várias empresas, a títulos públicos ou a outro ativo de uma vez. Aqui estão {etfs.length} ETFs
          para começar. Clique numa linha para ver a ficha.
        </p>
        <Anotacao className="mt-3">Toque no “?” de cada coluna: ele explica o indicador em uma frase.</Anotacao>
      </header>

      <ListaDeEtfs itens={etfs} />

      <p className="mt-10 max-w-[760px] text-[13px] leading-5 text-mute">
        Cotações do Yahoo Finance, com atraso. A variação em 12 meses é a do preço da cota e não inclui proventos; “—”
        quer dizer que a fonte não informou o número. A ordem da lista é fixa e não indica qual ETF é melhor: nada
        aqui é recomendação de investimento.
      </p>
    </>
  );
}
