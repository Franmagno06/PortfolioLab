import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BotaoRegistrarCompra,
  CabecalhoDoAtivo,
  ComposicaoDoFundo,
  estadoDoBloco,
  NoticiasDoAtivo,
  NotaDaFonte,
  ProventosDoAtivo,
  RelatoriosDoAtivo,
  SobreOAtivo,
} from "@/components/ativos/blocos-da-ficha";
import { GraficoDePreco } from "@/components/ativos/grafico-de-preco";
import { GrupoDeIndicadores, Indicador } from "@/components/ativos/indicadores-da-ficha";
import { Anotacao, Migalhas, Voltar } from "@/components/ativos/pecas";
import { Secao } from "@/components/ativos/secao";
import { buscarFii } from "@/lib/ativos-api";
import { acharFii } from "@/lib/ativos-catalogo";
import { contagemCompacta, coresClasse, mesAno, numero, percentual, reaisCompactos } from "@/lib/format";
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

// A ficha é montada a cada visita (a resposta do backend fica 2 min no cache do Next, ver
// ativos-api.ts). Sem isso o Next tentaria montá-la no build, quando o backend pode nem estar no ar.
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const fii = acharFii(ticker);
  if (!fii) return { title: "Ativo não encontrado | PortfolioLab" };
  return {
    title: `${fii.ticker}: ${fii.nome} | PortfolioLab`,
    description: `Ficha de ${fii.ticker} (${fii.nome}): preço mês a mês, rendimento, P/VP, composição da carteira e agenda de proventos.`,
  };
}

const pctOuTraco = (v: number | null, casas = 1) => (v === null ? "—" : percentual(v, casas));

export default async function FichaDoFii({ params }: Props) {
  const { ticker } = await params;
  // só o catálogo vai ao backend (ver a página da ação)
  const item = acharFii(ticker);
  if (!item) notFound();
  const ficha = await buscarFii(item.ticker);
  if (!ficha) notFound();

  const ind = ficha.indicadores;
  const pontos = ficha.historico.dados ?? [];
  // o informe mensal é a fonte de patrimônio, cotistas, taxa e gestão; sem ele, os quatro vêm vazios
  const mesDoInforme = ficha.informe.competencia ? mesAno(ficha.informe.competencia) : null;

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

      <SobreOAtivo ticker={ficha.ticker} texto={ficha.descricao} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <BotaoRegistrarCompra />
        </div>

        <div className="space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Secao
            id="preco"
            revelar={false}
            titulo="Preço mês a mês"
            subtitulo="Fechamento do último pregão de cada mês, nos últimos 12 meses."
            estado={estadoDoBloco(ficha.historico, (d) => d.length === 0)}
            vazio={<p className="text-sm text-ink-2">O Yahoo Finance não informou o histórico de preços deste ativo.</p>}
          >
            <GraficoDePreco ticker={ficha.ticker} historico={pontos} cor={coresClasse.FII ?? "#3b6fe0"} />
            <Anotacao className="mt-4">
              Cada ponto é o fechamento do último pregão do mês. No FII, o rendimento mensal também pesa no retorno.
            </Anotacao>
            <NotaDaFonte fonte="Yahoo Finance, com atraso" estado={ficha.historico.estado} atualizadoEm={ficha.historico.atualizadoEm} />
          </Secao>

          <Secao
            id="indicadores"
            titulo="Indicadores"
            subtitulo="Agrupados pelo que respondem. Toque no “?” para uma explicação de uma frase."
          >
            <div className="space-y-6">
              <GrupoDeIndicadores titulo="Rendimento" pergunta="quanto o fundo paga?">
                <Indicador rotulo="DY mensal" dica="dyMensal" valor={pctOuTraco(ind.dyMensal, 2)} leitura={leituraDyMensal(ind.dyMensal)} />
                <Indicador rotulo="Dividend Yield (12 meses)" dica="dyFii" valor={pctOuTraco(ind.dy12m)} leitura={leituraDy(ind.dy12m)} armadilha={ARMADILHAS.dyFii} />
              </GrupoDeIndicadores>

              <GrupoDeIndicadores titulo="Patrimônio" pergunta="quanto vale o fundo?">
                <Indicador rotulo="Preço/valor patrimonial (P/VP)" dica="pvpFii" valor={ind.pvp === null ? "—" : numero(ind.pvp, 2)} leitura={leituraPvpFii(ind.pvp)} armadilha={ARMADILHAS.pvpFii} />
                <Indicador
                  rotulo="Patrimônio líquido"
                  dica="patrimonioLiquido"
                  valor={ind.patrimonioLiquido === null ? "—" : reaisCompactos(ind.patrimonioLiquido / 1_000_000_000)}
                  leitura={leituraPatrimonioLiquido()}
                />
                <Indicador rotulo="Número de cotistas" dica="cotistas" valor={ind.cotistas === null ? "—" : contagemCompacta(ind.cotistas)} leitura={leituraCotistas()} />
              </GrupoDeIndicadores>

              <GrupoDeIndicadores titulo="Gestão" pergunta="quem cuida e quanto cobra?">
                <Indicador rotulo="Taxa de administração" dica="taxaAdministracao" valor={pctOuTraco(ind.taxaAdministracao, 2)} leitura={leituraTaxaAdministracao()} />
                <Indicador rotulo="Tipo de gestão" dica="gestao" valor={ind.gestao ?? "—"} leitura={leituraGestao(ind.gestao)} />
              </GrupoDeIndicadores>

              <NotaDaFonte
                fonte={`Yahoo Finance (preço e proventos) e informe mensal da CVM${mesDoInforme ? ` de ${mesDoInforme}` : ""} (patrimônio, cotistas, taxa e gestão); o dividend yield é calculado pelo PortfolioLab`}
                estado={ficha.informe.estado}
                atualizadoEm={ficha.informe.atualizadoEm}
                className=""
              />
            </div>
          </Secao>

          <ComposicaoDoFundo bloco={ficha.composicao} informe={ficha.informe} leitura={leituraComposicao(ficha.tipo)} />
        </div>

        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <ProventosDoAtivo
            titulo="Agenda de proventos"
            subtitulo="Data-ex: quem tem a cota até o dia anterior recebe. A data de pagamento não vem desta fonte."
            bloco={ficha.proventos}
          />
          <NoticiasDoAtivo ticker={ficha.ticker} bloco={ficha.noticias} />
          <RelatoriosDoAtivo ticker={ficha.ticker} tipo="fundo" />
        </div>
      </div>

      <div className="mt-8">
        <Voltar href={ROTAS.fiis} rotulo="Voltar para FIIs" />
      </div>
    </>
  );
}
