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
  SobreOAtivo,
} from "@/components/ativos/blocos-da-ficha";
import { GraficoDePreco } from "@/components/ativos/grafico-de-preco";
import { GrupoDeIndicadores, Indicador } from "@/components/ativos/indicadores-da-ficha";
import { Anotacao, Migalhas, Voltar } from "@/components/ativos/pecas";
import { Secao } from "@/components/ativos/secao";
import { buscarEtf } from "@/lib/ativos-api";
import { acharEtf } from "@/lib/ativos-catalogo";
import { coresClasse, dataCurta, percentual, reaisCompactos } from "@/lib/format";
import {
  ARMADILHAS,
  leituraDyEtf,
  leituraPatrimonioLiquido,
  leituraRetorno12m,
} from "@/lib/indicadores-explicados";
import { ROTAS } from "@/lib/navegacao";

type Props = { params: Promise<{ ticker: string }> };

// Montada a cada visita (a resposta do backend fica 2 min no cache do Next, ver ativos-api.ts).
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const etf = acharEtf(ticker);
  if (!etf) return { title: "Ativo não encontrado | PortfolioLab" };
  return {
    title: `${etf.ticker}: ${etf.nome} | PortfolioLab`,
    description: `Ficha de ${etf.ticker} (${etf.nome}): o que é, preço mês a mês, variação em 12 meses, patrimônio e proventos.`,
  };
}

const pctOuTraco = (v: number | null) => (v === null ? "—" : percentual(v));

export default async function FichaDoEtf({ params }: Props) {
  const { ticker } = await params;
  // só o catálogo vai ao backend (ver a página da ação)
  const item = acharEtf(ticker);
  if (!item) notFound();
  const ficha = await buscarEtf(item.ticker);
  if (!ficha) notFound();

  const pontos = ficha.historico.dados ?? [];
  const patrimonio = ficha.patrimonio.dados;

  return (
    <>
      <Migalhas
        itens={[
          { rotulo: "Início", href: ROTAS.inicio },
          { rotulo: "Ativos" },
          { rotulo: "ETFs", href: ROTAS.etfs },
          { rotulo: ficha.ticker },
        ]}
      />
      <div className="mt-2 mb-4">
        <Voltar href={ROTAS.etfs} rotulo="Voltar para ETFs" />
      </div>

      <CabecalhoDoAtivo
        ticker={ficha.ticker}
        nome={ficha.nome}
        chips={[{ rotulo: ficha.categoria, dica: "categoriaEtf" }, { rotulo: `Índice: ${ficha.indice}`, dica: "indiceEtf" }]}
        preco={ficha.preco}
        variacaoDia={ficha.variacaoDia}
        fechamentoEm={ficha.fechamentoEm}
        etf
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
            <GraficoDePreco ticker={ficha.ticker} historico={pontos} cor={coresClasse.ETF ?? "#d98324"} />
            <Anotacao className="mt-4">Cada ponto é o fechamento do último pregão do mês.</Anotacao>
            <NotaDaFonte fonte="Yahoo Finance, com atraso" estado={ficha.historico.estado} atualizadoEm={ficha.historico.atualizadoEm} />
          </Secao>

          <Secao
            id="indicadores"
            titulo="Indicadores"
            subtitulo="Agrupados pelo que respondem. Toque no “?” para uma explicação de uma frase."
          >
            <div className="space-y-6">
              <GrupoDeIndicadores titulo="Desempenho" pergunta="quanto a cota variou e pagou?">
                <Indicador rotulo="Variação em 12 meses" dica="retorno12m" valor={pctOuTraco(ficha.retorno12m)} leitura={leituraRetorno12m(ficha.retorno12m)} armadilha={ARMADILHAS.retornoEtf} />
                <Indicador rotulo="Dividend Yield (12 meses)" dica="dyEtf" valor={pctOuTraco(ficha.dy12m)} leitura={leituraDyEtf(ficha.dy12m)} />
              </GrupoDeIndicadores>

              <GrupoDeIndicadores titulo="Tamanho" pergunta="quanto dinheiro o fundo reúne?">
                <Indicador
                  rotulo="Patrimônio líquido"
                  dica="patrimonioLiquido"
                  valor={patrimonio ? reaisCompactos(patrimonio.patrimonioLiquido / 1_000_000_000) : "—"}
                  leitura={leituraPatrimonioLiquido()}
                />
              </GrupoDeIndicadores>

              <Anotacao>
                A taxa de administração de cada ETF está no regulamento do fundo e no site do gestor. Ela é descontada
                do patrimônio todo ano e, por isso, reduz o que você ganha.
              </Anotacao>

              <NotaDaFonte
                fonte={`Yahoo Finance (preço, variação e proventos) e cadastro de classes da CVM (patrimônio${patrimonio ? `, de ${dataCurta(patrimonio.dataReferencia)}` : ""})`}
                estado={ficha.patrimonio.estado}
                atualizadoEm={ficha.patrimonio.atualizadoEm}
                className=""
              />
            </div>
          </Secao>
        </div>

        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <ProventosDoAtivo
            titulo="Proventos recentes"
            subtitulo="Data-ex: quem tem a cota até o dia anterior recebe. A data de pagamento não vem desta fonte."
            bloco={ficha.proventos}
          />
          <NoticiasDoAtivo ticker={ficha.ticker} bloco={ficha.noticias} />
          <RelatoriosDoAtivo ticker={ficha.ticker} tipo="fundo" />
        </div>
      </div>

      <div className="mt-8">
        <Voltar href={ROTAS.etfs} rotulo="Voltar para ETFs" />
      </div>
    </>
  );
}
