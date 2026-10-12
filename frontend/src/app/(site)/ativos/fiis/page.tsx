import type { Metadata } from "next";
import { ListaDeFiis } from "@/components/ativos/lista-de-ativos";
import { Anotacao, Migalhas } from "@/components/ativos/pecas";
import { listarFiis } from "@/lib/ativos-api";
import { ROTAS } from "@/lib/navegacao";

export const metadata: Metadata = {
  title: "Fundos imobiliários (FIIs): 15 fundos para olhar de perto | PortfolioLab",
  description:
    "Uma lista de 15 fundos imobiliários da B3 com tipo, segmento, preço, dividend yield e P/VP, cada indicador explicado em uma frase.",
};

// Montada a cada visita; a resposta do backend fica 2 min no cache do Next (ver ativos-api.ts).
// Sem isso o Next tentaria montar a página no build, quando o backend pode nem estar no ar.
export const revalidate = 0;

export default async function FiisPage() {
  const fiis = await listarFiis();

  return (
    <>
      <Migalhas itens={[{ rotulo: "Início", href: ROTAS.inicio }, { rotulo: "Ativos" }, { rotulo: "FIIs" }]} />

      <header className="mt-6 mb-8 max-w-[760px]">
        <h1 className="font-leitura text-[34px] leading-[42px] font-semibold tracking-[-0.01em] text-balance text-ink lg:text-[40px] lg:leading-[48px]">
          Fundos imobiliários (FIIs)
        </h1>
        <p className="mt-2 text-base leading-[26px] text-ink-2">
          Um FII reúne o dinheiro de muita gente para investir em imóveis ou em títulos ligados a imóveis, e costuma
          repassar o rendimento todo mês. Aqui estão {fiis.length} fundos para começar. Clique numa linha para ver a
          ficha.
        </p>
        <Anotacao className="mt-3">
          Tijolo é o fundo dono de prédios; papel é o que empresta dinheiro. Toque no “?” para ver a diferença.
        </Anotacao>
      </header>

      <ListaDeFiis itens={fiis} />

      <p className="mt-10 max-w-[760px] text-[13px] leading-5 text-mute">
        Cotações do Yahoo Finance, com atraso; os dados do fundo vêm do informe mensal da CVM, e o dividend yield usa
        os rendimentos dos últimos 12 meses. “—” quer dizer que a fonte não informou o número. A ordem da lista é
        fixa e não indica qual fundo é melhor: nada aqui é recomendação de investimento.
      </p>
    </>
  );
}
