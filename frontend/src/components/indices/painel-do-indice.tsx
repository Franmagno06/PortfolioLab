"use client";

import { useState } from "react";
import { Anotacao } from "@/components/ativos/pecas";
import { numero, percentual } from "@/lib/format";
import {
  formatarData,
  formatarValor,
  recortar,
  resumir,
  ROTULO_DO_PERIODO,
  variacaoComSinal,
  type Indice,
  type Periodo,
  type PontoSerie,
} from "@/lib/indices";
import { GraficoDeArea } from "./grafico-de-area";
import { GraficoDeBarras } from "./grafico-de-barras";
import { SeletorDePeriodo, TabelaDosDados } from "./pecas-do-grafico";

/*
 * O pedaço da ficha que muda com o período: o card do gráfico e o "Resumo do período" da coluna
 * lateral. Os dois leem o mesmo estado, então trocar de 1A para 5A atualiza o gráfico, a tabela e o
 * resumo juntos. O resto da coluna lateral (que não depende do período) chega pronto do servidor em
 * `lateral`.
 *
 * Duas peças da grade da ficha (ver a página): o gráfico na coluna da esquerda, a lateral na da
 * direita. No celular, a ordem do DOM põe a lateral logo abaixo do gráfico.
 */

type Props = {
  indice: Indice;
  /** A série do maior período; cada período é um recorte dela. */
  serie: PontoSerie[];
  /** Como o "Hoje" do resumo aparece: a taxa de hoje, que no CDI não é a última barra (que é o ano). */
  hoje: string;
  /** A quarta linha do resumo das taxas, que não depende do período. */
  linhaFixa?: { rotulo: string; texto: string };
  /** Uma observação para o último ponto, quando ele ainda não fechou: "até setembro". */
  notaDoUltimo?: string;
  lateral: React.ReactNode;
};

function LinhaDoResumo({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-[13px] leading-[19px] text-mute">{rotulo}</dt>
      <dd className="tnum text-right text-[13px] leading-[19px] font-medium text-ink">{texto}</dd>
    </div>
  );
}

export function PainelDoIndice({ indice, serie, hoje, linhaFixa, notaDoUltimo, lateral }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>(indice.periodoPadrao);
  const recorte = recortar(serie, periodo, indice.granularidade);
  const resumo = resumir(recorte);
  const ehTaxa = indice.tipo === "taxa";
  const ultimaData = serie[serie.length - 1]?.data;

  // Os formatos do tooltip, do eixo e da tabela.
  const valor = (v: number) => (ehTaxa ? percentual(v, 2) : `${numero(v, 2)} pts`);
  const valorCurto = (v: number) => formatarValor(indice, v, 0);
  const data = (d: string) => {
    const texto = formatarData(d, indice.granularidade);
    return notaDoUltimo && d === ultimaData ? `${texto} (${notaDoUltimo})` : texto;
  };
  const dataDoEixo = (d: string) => formatarData(d, indice.granularidade);
  const comData = (p: PontoSerie) => `${ehTaxa ? percentual(p.valor, 2) : valorCurto(p.valor)} (${dataDoEixo(p.data)})`;

  const frase = ROTULO_DO_PERIODO[periodo].frase;
  const subtitulo =
    !ehTaxa && resumo?.variacao != null
      ? `${indice.grafico.subtitulo}. ${variacaoComSinal(resumo.variacao)} em ${frase}.`
      : indice.grafico.subtitulo;
  const descricao = resumo
    ? `${indice.grafico.titulo}, ${frase}: de ${valor(recorte[0]?.valor ?? 0)} em ${dataDoEixo(recorte[0]?.data ?? "")} a ${valor(resumo.hoje.valor)} em ${dataDoEixo(resumo.hoje.data)}. Use as setas para percorrer os pontos.`
    : indice.grafico.titulo;
  const idDoTitulo = `grafico-${indice.slug}-titulo`;

  return (
    <>
      <section
        aria-labelledby={idDoTitulo}
        className="min-w-0 rounded-md border border-pauta bg-card p-5 sm:p-6 lg:col-start-1 lg:row-start-2"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 id={idDoTitulo} className="font-leitura text-xl leading-[26px] font-semibold text-ink">
              {indice.grafico.titulo}
            </h2>
            <p className="mt-0.5 text-[13px] leading-[19px] text-mute">{subtitulo}</p>
          </div>
          <SeletorDePeriodo periodos={indice.periodos} atual={periodo} aoEscolher={setPeriodo} />
        </div>

        <div className="mt-4">
          {ehTaxa ? (
            <GraficoDeBarras
              serie={recorte}
              granularidade={indice.granularidade}
              titulo={indice.grafico.titulo}
              descricao={descricao}
              valor={valor}
              data={data}
            />
          ) : (
            <GraficoDeArea
              id={indice.slug}
              serie={recorte}
              media={resumo?.media ?? 0}
              titulo={indice.grafico.titulo}
              descricao={descricao}
              valor={valor}
              valorCurto={valorCurto}
              data={data}
            />
          )}
        </div>

        <Anotacao className="mt-3 text-[13px]! leading-[19px]!">
          {ehTaxa
            ? "No computador, o valor exato aparece ao passar o mouse; no celular, ao tocar e arrastar o dedo sobre as barras. Com o teclado, clique no gráfico e use as setas."
            : "Passe o mouse no gráfico para ver o valor de cada dia; no celular, toque e arraste. Com o teclado, clique no gráfico e use as setas."}
        </Anotacao>

        <div className="mt-2">
          <TabelaDosDados
            titulo={`${indice.grafico.titulo}, ${frase}`}
            serie={recorte}
            valor={valor}
            data={data}
            rotuloDaData={indice.granularidade === "anual" ? "Ano" : indice.granularidade === "mensal" ? "Mês" : "Dia"}
          />
        </div>
      </section>

      <aside
        aria-label={`Resumo e leituras sobre ${indice.nome}`}
        className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-span-3 lg:row-start-1"
      >
        {resumo && (
          <section aria-labelledby={`resumo-${indice.slug}`} className="rounded-md border border-pauta bg-card p-5">
            <h2 id={`resumo-${indice.slug}`} className="font-leitura text-base leading-[22px] font-semibold text-ink">
              Resumo do período ({ROTULO_DO_PERIODO[periodo].botao})
            </h2>
            <dl className="mt-2.5">
              <LinhaDoResumo rotulo="Hoje" texto={hoje} />
              <LinhaDoResumo rotulo="Máxima" texto={comData(resumo.maxima)} />
              <LinhaDoResumo rotulo="Mínima" texto={comData(resumo.minima)} />
              {linhaFixa ? (
                <LinhaDoResumo rotulo={linhaFixa.rotulo} texto={linhaFixa.texto} />
              ) : (
                resumo.variacao != null && (
                  <LinhaDoResumo rotulo={`Variação em ${frase}`} texto={variacaoComSinal(resumo.variacao)} />
                )
              )}
            </dl>
          </section>
        )}
        {lateral}
      </aside>
    </>
  );
}
