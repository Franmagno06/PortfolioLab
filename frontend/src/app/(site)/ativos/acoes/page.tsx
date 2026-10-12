import type { Metadata } from "next";
import { ListaDeAcoes } from "@/components/ativos/lista-de-ativos";
import { Anotacao, Migalhas } from "@/components/ativos/pecas";
import { FECHAMENTO_DOS_DADOS, listarAcoes } from "@/lib/ativos-catalogo";
import { dataCurta } from "@/lib/format";
import { ROTAS } from "@/lib/navegacao";

export const metadata: Metadata = {
  title: "Ações: 15 empresas da bolsa para olhar de perto | PortfolioLab",
  description:
    "Uma lista de 15 ações da B3 com preço, P/L, P/VP, dividend yield e ROE, cada indicador explicado em uma frase.",
};

export default async function AcoesPage() {
  const acoes = await listarAcoes();

  return (
    <>
      <Migalhas itens={[{ rotulo: "Início", href: ROTAS.inicio }, { rotulo: "Ativos" }, { rotulo: "Ações" }]} />

      <header className="mt-6 mb-8 max-w-[760px]">
        <h1 className="font-leitura text-[34px] leading-[42px] font-semibold tracking-[-0.01em] text-balance text-ink lg:text-[40px] lg:leading-[48px]">
          Ações
        </h1>
        <p className="mt-2 text-base leading-[26px] text-ink-2">
          Uma ação é um pedacinho de uma empresa. Aqui estão {acoes.length} empresas da bolsa para você começar a
          olhar de perto. Clique numa linha para ver a ficha completa.
        </p>
        <Anotacao className="mt-3">Toque no “?” de cada coluna: ele explica o indicador em uma frase.</Anotacao>
      </header>

      <ListaDeAcoes itens={acoes} />

      <p className="mt-10 max-w-[760px] text-[13px] leading-5 text-mute">
        Dados de exemplo, do fechamento de {dataCurta(FECHAMENTO_DOS_DADOS)}. Na versão final, as cotações vêm do
        Yahoo Finance, com atraso, e os indicadores são calculados pelo PortfolioLab. A ordem da lista é fixa e não
        indica qual empresa é melhor: nada aqui é recomendação de investimento. Os logos são marcas de seus
        titulares e aparecem só para identificar a empresa.
      </p>
    </>
  );
}
