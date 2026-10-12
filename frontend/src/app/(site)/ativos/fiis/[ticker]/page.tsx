import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BotaoRegistrarCompra,
  CabecalhoDoAtivo,
  ComposicaoDoFundo,
  NoticiasDoAtivo,
  ProventosDoAtivo,
  RelatoriosDoAtivo,
} from "@/components/ativos/blocos-da-ficha";
import { GraficoDePreco } from "@/components/ativos/grafico-de-preco";
import { Armadilha, GrupoDeIndicadores, Indicador } from "@/components/ativos/indicadores-da-ficha";
import { Anotacao, Migalhas, Voltar } from "@/components/ativos/pecas";
import { Secao } from "@/components/ativos/secao";
import { FIIS, acharFiiResumo } from "@/lib/ativos-catalogo";
import { buscarFii } from "@/lib/ativos-fichas";
import { contagemCompacta, coresClasse, numero, percentual, reaisCompactos } from "@/lib/format";
import {
  ARMADILHAS,
  leituraComposicao,
  leituraCotistas,
  leituraDy,
  leituraDyMensal,
  leituraGestao,
  leituraPatrimonioLiquido,
  leituraPvpFii,
  leituraTaxaAdministracao,
} from "@/lib/indicadores-explicados";
import { ROTAS } from "@/lib/navegacao";

type Props = { params: Promise<{ ticker: string }> };

export function generateStaticParams() {
  return FIIS.map((f) => ({ ticker: f.ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const fii = acharFiiResumo(ticker);
  if (!fii) return { title: "Ativo não encontrado | PortfolioLab" };
  return {
    title: `${fii.ticker}: ${fii.nome} | PortfolioLab`,
    description: `Ficha de ${fii.ticker} (${fii.nome}): preço mês a mês, rendimento, P/VP, composição da carteira e agenda de proventos.`,
  };
}

export default async function FichaDoFii({ params }: Props) {
  const { ticker } = await params;
  const ficha = await buscarFii(ticker);
  if (!ficha) notFound();

  return (
    <>
      <Migalhas
        itens={[
          { rotulo: "Início", href: ROTAS.inicio },
          { rotulo: "Ativos" },
          { rotulo: "FIIs", href: ROTAS.fiis },
          { rotulo: ficha.ticker },
        ]}
      />
      <div className="mt-2 mb-4">
        <Voltar href={ROTAS.fiis} rotulo="Voltar para FIIs" />
      </div>

      <CabecalhoDoAtivo
        ticker={ficha.ticker}
        nome={ficha.nome}
        chips={[{ rotulo: ficha.tipo, dica: "tipoFii" }, { rotulo: ficha.segmento }]}
        preco={ficha.preco}
        variacaoDia={ficha.variacaoDia}
        fechamentoEm={ficha.fechamentoEm}
        tipoFii={ficha.tipo}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <BotaoRegistrarCompra />
        </div>

        <div className="space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Secao
            id="preco"
            titulo="Preço mês a mês"
            subtitulo="Fechamento do último pregão de cada mês, nos últimos 12 meses."
          >
            <GraficoDePreco ticker={ficha.ticker} historico={ficha.historico} cor={coresClasse.FII ?? "#3b6fe0"} />
            <Anotacao className="mt-4">
              Cada ponto é o fechamento do último pregão do mês. No FII, o rendimento mensal também pesa no
              retorno. Preços de exemplo.
            </Anotacao>
          </Secao>

          <Secao
            id="indicadores"
            titulo="Indicadores"
            subtitulo="Agrupados pelo que respondem. Toque no “?” para uma explicação de uma frase. Dados de exemplo; na versão final, calculados pelo PortfolioLab a partir do Yahoo Finance e do informe mensal da CVM."
          >
            <div className="space-y-6">
              <GrupoDeIndicadores titulo="Rendimento" pergunta="quanto o fundo paga?">
                <Indicador rotulo="DY mensal" dica="dyMensal" valor={percentual(ficha.dyMensal, 2)} leitura={leituraDyMensal(ficha.dyMensal)} />
                <Indicador rotulo="Dividend Yield (12 meses)" dica="dyFii" valor={ficha.dy12m === null ? "—" : percentual(ficha.dy12m)} leitura={leituraDy(ficha.dy12m)} />
                <Armadilha>{ARMADILHAS.dyFii}</Armadilha>
              </GrupoDeIndicadores>

              <GrupoDeIndicadores titulo="Patrimônio" pergunta="quanto vale o fundo?">
                <Indicador rotulo="Preço/valor patrimonial (P/VP)" dica="pvpFii" valor={ficha.pvp === null ? "—" : numero(ficha.pvp, 2)} leitura={leituraPvpFii(ficha.pvp)} />
                <Armadilha>{ARMADILHAS.pvpFii}</Armadilha>
                <Indicador rotulo="Patrimônio líquido" dica="patrimonioLiquido" valor={reaisCompactos(ficha.patrimonioLiquido)} leitura={leituraPatrimonioLiquido()} />
                <Indicador rotulo="Número de cotistas" dica="cotistas" valor={contagemCompacta(ficha.cotistas)} leitura={leituraCotistas()} />
              </GrupoDeIndicadores>

              <GrupoDeIndicadores titulo="Gestão" pergunta="quem cuida e quanto cobra?">
                <Indicador rotulo="Taxa de administração" dica="taxaAdministracao" valor={percentual(ficha.taxaAdministracao, 2)} leitura={leituraTaxaAdministracao()} />
                <Indicador rotulo="Tipo de gestão" dica="gestao" valor={ficha.gestao} leitura={leituraGestao(ficha.gestao)} />
              </GrupoDeIndicadores>
            </div>
          </Secao>

          <ComposicaoDoFundo faixas={ficha.composicao} leitura={leituraComposicao(ficha.tipo)} />
        </div>

        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <ProventosDoAtivo
            titulo="Agenda de proventos"
            subtitulo="Data-ex: quem tem a cota até o dia anterior recebe. A data de pagamento não vem desta fonte."
            proventos={ficha.proventos}
          />
          <NoticiasDoAtivo ticker={ficha.ticker} noticias={ficha.noticias} />
          <RelatoriosDoAtivo ticker={ficha.ticker} tipo="fundo" />
        </div>
      </div>

      <div className="mt-8">
        <Voltar href={ROTAS.fiis} rotulo="Voltar para FIIs" />
      </div>
    </>
  );
}
