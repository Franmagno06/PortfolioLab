import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BotaoRegistrarCompra,
  CabecalhoDoAtivo,
  estadoDoBloco,
  NoticiasDoAtivo,
  NotaDaFonte,
  ProventosDoAtivo,
  RelatoriosDoAtivo,
  ResultadosTrimestrais,
} from "@/components/ativos/blocos-da-ficha";
import { GraficoDePreco } from "@/components/ativos/grafico-de-preco";
import { Armadilha, GrupoDeIndicadores, Indicador } from "@/components/ativos/indicadores-da-ficha";
import { Anotacao, Migalhas, Voltar } from "@/components/ativos/pecas";
import { Secao } from "@/components/ativos/secao";
import { buscarAcao } from "@/lib/ativos-api";
import { acharAcao } from "@/lib/ativos-catalogo";
import type { EspecieAcao } from "@/lib/ativos-tipos";
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

// A ficha é montada a cada visita (a resposta do backend fica 2 min no cache do Next, ver
// ativos-api.ts). Sem isso o Next tentaria montá-la no build, quando o backend pode nem estar no ar.
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const acao = acharAcao(ticker);
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
  // só o catálogo vai ao backend: ticker de outro formato ("abc", "PETR4.SA", ".") é não encontrado,
  // e lixo na URL não gasta o limite de requisições que todos os visitantes dividem
  const item = acharAcao(ticker);
  if (!item) notFound();
  const ficha = await buscarAcao(item.ticker);
  if (!ficha) notFound();

  const ind = ficha.indicadores.dados;
  const pontos = ficha.historico.dados ?? [];

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
            estado={estadoDoBloco(ficha.historico, (d) => d.length === 0)}
            vazio={<p className="text-sm text-ink-2">O Yahoo Finance não informou o histórico de preços deste ativo.</p>}
          >
            <GraficoDePreco ticker={ficha.ticker} historico={pontos} cor={coresClasse.ACAO ?? "#1e9e63"} />
            <Anotacao className="mt-4">Cada ponto é o fechamento do último pregão do mês.</Anotacao>
            <NotaDaFonte fonte="Yahoo Finance, com atraso" estado={ficha.historico.estado} atualizadoEm={ficha.historico.atualizadoEm} />
          </Secao>

          <Secao
            id="indicadores"
            titulo="Indicadores"
            subtitulo="Agrupados pelo que respondem. Toque no “?” para uma explicação de uma frase."
            estado={estadoDoBloco(ficha.indicadores, () => false)}
          >
            {ind && (
              <div className="space-y-6">
                <GrupoDeIndicadores titulo="Valuation" pergunta="quanto se paga pelo lucro e pelo patrimônio?">
                  <Indicador rotulo="Preço/lucro (P/L)" dica="pl" valor={umaCasa(ind.pl)} leitura={leituraPl(ind.pl)} />
                  <Armadilha>{ARMADILHAS.pl}</Armadilha>
                  <Indicador rotulo="Preço/valor patrimonial (P/VP)" dica="pvp" valor={umaCasa(ind.pvp)} leitura={leituraPvpAcao(ind.pvp)} />
                </GrupoDeIndicadores>

                <GrupoDeIndicadores titulo="Dividendos" pergunta="quanto a empresa distribuiu?">
                  <Indicador rotulo="Dividend Yield (12 meses)" dica="dy12m" valor={pctOuTraco(ind.dy12m)} leitura={leituraDy(ind.dy12m)} />
                  <Armadilha>{ARMADILHAS.dyAcao}</Armadilha>
                </GrupoDeIndicadores>

                <GrupoDeIndicadores titulo="Rentabilidade" pergunta="quanto a empresa rende?">
                  <Indicador rotulo="ROE" dica="roe" valor={pctOuTraco(ind.roe)} leitura={leituraRoe(ind.roe)} />
                  {ficha.banco ? (
                    <Indicador rotulo="ROA" dica="roa" valor={pctOuTraco(ind.roa)} leitura={leituraRoa(ind.roa)} />
                  ) : (
                    <Indicador rotulo="Margem líquida" dica="margemLiquida" valor={pctOuTraco(ind.margemLiquida)} leitura={leituraMargem(ind.margemLiquida)} />
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
                      valor={ind.dividaEbitda === null ? "—" : multiplo(ind.dividaEbitda)}
                      leitura={leituraDivida(ind.dividaEbitda)}
                    />
                  </GrupoDeIndicadores>
                )}
                <NotaDaFonte
                  fonte="Yahoo Finance; o dividend yield é calculado pelo PortfolioLab com os proventos dos últimos 12 meses"
                  estado={ficha.indicadores.estado}
                  atualizadoEm={ficha.indicadores.atualizadoEm}
                  className=""
                />
              </div>
            )}
          </Secao>

          <ResultadosTrimestrais bloco={ficha.resultados} />
        </div>

        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <ProventosDoAtivo
            titulo="Proventos recentes"
            subtitulo="Data-ex: quem tem a ação até o dia anterior recebe. A data de pagamento não vem desta fonte."
            bloco={ficha.proventos}
          />
          <NoticiasDoAtivo ticker={ficha.ticker} bloco={ficha.noticias} />
          <RelatoriosDoAtivo ticker={ficha.ticker} tipo="empresa" />
        </div>
      </div>

      <div className="mt-8">
        <Voltar href={ROTAS.acoes} rotulo="Voltar para ações" />
      </div>
    </>
  );
}
