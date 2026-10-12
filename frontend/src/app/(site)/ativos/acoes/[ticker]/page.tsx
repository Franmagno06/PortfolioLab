import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BotaoRegistrarCompra,
  CabecalhoDoAtivo,
  NoticiasDoAtivo,
  ProventosDoAtivo,
  RelatoriosDoAtivo,
  ResultadosTrimestrais,
} from "@/components/ativos/blocos-da-ficha";
import { GraficoDePreco } from "@/components/ativos/grafico-de-preco";
import { Armadilha, GrupoDeIndicadores, Indicador } from "@/components/ativos/indicadores-da-ficha";
import { Anotacao, Migalhas, Voltar } from "@/components/ativos/pecas";
import { Secao } from "@/components/ativos/secao";
import { ACOES, acharAcaoResumo, type EspecieAcao } from "@/lib/ativos-catalogo";
import { buscarAcao } from "@/lib/ativos-fichas";
import { coresClasse, multiplo, numero, percentual } from "@/lib/format";
import {
  ARMADILHAS,
  leituraDivida,
  leituraDy,
  leituraMargem,
  leituraPl,
  leituraPvpAcao,
  leituraRoa,
  leituraRoe,
} from "@/lib/indicadores-explicados";
import { ROTAS } from "@/lib/navegacao";

type Props = { params: Promise<{ ticker: string }> };

export function generateStaticParams() {
  return ACOES.map((a) => ({ ticker: a.ticker }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const acao = acharAcaoResumo(ticker);
  if (!acao) return { title: "Ativo não encontrado | PortfolioLab" };
  return {
    title: `${acao.ticker}: ${acao.nome} | PortfolioLab`,
    description: `Ficha de ${acao.ticker} (${acao.nome}): preço mês a mês, indicadores explicados em uma frase, proventos e resultados.`,
  };
}

const ESPECIE: Record<EspecieAcao, string> = {
  ON: "ON · ordinária",
  PN: "PN · preferencial",
  Unit: "Unit · pacote de ações",
};

const umaCasa = (v: number | null) => (v === null ? "—" : numero(v, 1));
const pctOuTraco = (v: number | null) => (v === null ? "—" : percentual(v));

export default async function FichaDaAcao({ params }: Props) {
  const { ticker } = await params;
  const ficha = await buscarAcao(ticker);
  if (!ficha) notFound();

  return (
    <>
      <Migalhas
        itens={[
          { rotulo: "Início", href: ROTAS.inicio },
          { rotulo: "Ativos" },
          { rotulo: "Ações", href: ROTAS.acoes },
          { rotulo: ficha.ticker },
        ]}
      />
      <div className="mt-2 mb-4">
        <Voltar href={ROTAS.acoes} rotulo="Voltar para ações" />
      </div>

      <CabecalhoDoAtivo
        ticker={ficha.ticker}
        nome={ficha.nome}
        chips={[{ rotulo: ficha.setor }, { rotulo: ESPECIE[ficha.especie], dica: "especie" }]}
        preco={ficha.preco}
        variacaoDia={ficha.variacaoDia}
        fechamentoEm={ficha.fechamentoEm}
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
            <GraficoDePreco ticker={ficha.ticker} historico={ficha.historico} cor={coresClasse.ACAO ?? "#1e9e63"} />
            <Anotacao className="mt-4">
              Cada ponto é o fechamento do último pregão do mês. Preços de exemplo.
            </Anotacao>
          </Secao>

          <Secao
            id="indicadores"
            titulo="Indicadores"
            subtitulo="Agrupados pelo que respondem. Toque no “?” para uma explicação de uma frase. Dados de exemplo; na versão final, calculados pelo PortfolioLab a partir do Yahoo Finance e da CVM."
          >
            <div className="space-y-6">
              <GrupoDeIndicadores titulo="Valuation" pergunta="quanto se paga pelo lucro e pelo patrimônio?">
                <Indicador rotulo="Preço/lucro (P/L)" dica="pl" valor={umaCasa(ficha.pl)} leitura={leituraPl(ficha.pl)} />
                <Armadilha>{ARMADILHAS.pl}</Armadilha>
                <Indicador rotulo="Preço/valor patrimonial (P/VP)" dica="pvp" valor={umaCasa(ficha.pvp)} leitura={leituraPvpAcao(ficha.pvp)} />
              </GrupoDeIndicadores>

              <GrupoDeIndicadores titulo="Dividendos" pergunta="quanto a empresa distribuiu?">
                <Indicador rotulo="Dividend Yield (12 meses)" dica="dy12m" valor={pctOuTraco(ficha.dy12m)} leitura={leituraDy(ficha.dy12m)} />
                <Armadilha>{ARMADILHAS.dyAcao}</Armadilha>
              </GrupoDeIndicadores>

              <GrupoDeIndicadores titulo="Rentabilidade" pergunta="quanto a empresa rende?">
                <Indicador rotulo="ROE" dica="roe" valor={pctOuTraco(ficha.roe)} leitura={leituraRoe(ficha.roe)} />
                {ficha.banco ? (
                  <Indicador rotulo="ROA" dica="roa" valor={pctOuTraco(ficha.roa)} leitura={leituraRoa(ficha.roa)} />
                ) : (
                  <Indicador rotulo="Margem líquida" dica="margemLiquida" valor={pctOuTraco(ficha.margemLiquida)} leitura={leituraMargem(ficha.margemLiquida)} />
                )}
              </GrupoDeIndicadores>

              {ficha.banco ? (
                <Anotacao>
                  Em banco, a dívida faz parte do negócio. Por isso mostramos o ROA no lugar da margem líquida e não
                  mostramos a dívida/EBITDA.
                </Anotacao>
              ) : (
                <GrupoDeIndicadores titulo="Endividamento" pergunta="quanto a empresa deve?">
                  <Indicador
                    rotulo="Dívida líquida/EBITDA"
                    dica="dividaEbitda"
                    valor={ficha.dividaEbitda === null ? "—" : multiplo(ficha.dividaEbitda)}
                    leitura={leituraDivida(ficha.dividaEbitda)}
                  />
                </GrupoDeIndicadores>
              )}
            </div>
          </Secao>

          <ResultadosTrimestrais linhas={ficha.resultados} />
        </div>

        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <ProventosDoAtivo
            titulo="Proventos recentes"
            subtitulo="Data-ex: quem tem a ação até o dia anterior recebe. A data de pagamento não vem desta fonte."
            proventos={ficha.proventos}
          />
          <NoticiasDoAtivo ticker={ficha.ticker} noticias={ficha.noticias} />
          <RelatoriosDoAtivo ticker={ficha.ticker} tipo="empresa" />
        </div>
      </div>

      <div className="mt-8">
        <Voltar href={ROTAS.acoes} rotulo="Voltar para ações" />
      </div>
    </>
  );
}
