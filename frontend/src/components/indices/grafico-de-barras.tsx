"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Props as PropsDoRotulo } from "recharts/types/component/Label";
import { escalaDoEixo } from "@/lib/escala-do-grafico";
import { numero } from "@/lib/format";
import { marcasDoEixoX, type Granularidade, type PontoSerie } from "@/lib/indices";
import { CURVA, DURACAO_GRAFICO_MS } from "@/lib/movimento";
import { Balao, COR, Mira } from "./pecas-do-grafico";

/*
 * As barras das taxas: Selic e IPCA mês a mês, CDI ano a ano. O valor vai escrito em cima da barra
 * quando ela tem largura para isso; quando não tem, o tooltip e a tabela dão o número exato.
 * Sem animação de entrada: assim não há o que reduzir para quem pediu menos movimento.
 */

/** Largura mínima da barra para o valor caber escrito em cima, sem encostar no vizinho. */
const LARGURA_PARA_ROTULO = 30;

type Props = {
  serie: PontoSerie[];
  granularidade: Granularidade;
  /** O nome do gráfico, para o leitor de tela. */
  titulo: string;
  descricao: string;
  valor: (v: number) => string;
  data: (d: string) => string;
};

export function GraficoDeBarras({ serie, granularidade, titulo, descricao, valor, data }: Props) {
  // desenha só na entrada; trocar de período (ou redimensionar) não refaz a animação de 1,1 s
  const [desenhou, setDesenhou] = useState(false);
  const maximo = Math.max(...serie.map((p) => p.valor), 0);
  const marcasY = escalaDoEixo(0, maximo, 4);
  const marcasX = marcasDoEixoX(serie, granularidade);

  // O rótulo da barra: um <text> do SVG, centrado sobre ela.
  const rotulo = (props: PropsDoRotulo) => {
    const caixa = props.viewBox as { x?: number; y?: number; width?: number } | undefined;
    const largura = Number(caixa?.width ?? props.width ?? 0);
    if (largura < LARGURA_PARA_ROTULO) return null;
    const x = Number(caixa?.x ?? props.x ?? 0) + largura / 2;
    const y = Number(caixa?.y ?? props.y ?? 0) - 6;
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={11} fill={COR.texto2} className="tnum">
        {valor(Number(props.value))}
      </text>
    );
  };

  return (
    <div className="h-[300px] w-full touch-pan-y sm:h-[320px] [&_.recharts-surface:focus-visible]:rounded [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-4 [&_.recharts-surface:focus-visible]:outline-ink [&_.recharts-surface]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 24, right: 8, bottom: 4, left: 0 }} barCategoryGap="18%" title={titulo} desc={descricao}>
          <CartesianGrid stroke={COR.pauta} vertical={false} />
          <XAxis
            dataKey="data"
            ticks={marcasX}
            interval="preserveStartEnd"
            minTickGap={10}
            tickFormatter={(d: string) => data(d)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COR.eixo }}
            height={30}
          />
          <YAxis
            width={44}
            ticks={marcasY}
            domain={[0, marcasY[marcasY.length - 1] ?? "auto"]}
            tickFormatter={(v: number) => numero(v, Number.isInteger(v) ? 0 : 1)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COR.eixo }}
          />
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            offset={16}
            wrapperStyle={{ outline: "none", zIndex: 20 }}
            content={({ active, payload }) => (
              <Balao ponto={active ? (payload?.[0]?.payload as PontoSerie | undefined) : undefined} valor={valor} data={data} />
            )}
          />
          <Bar
            dataKey="valor"
            fill={COR.barra}
            fillOpacity={0.85}
            radius={[2, 2, 0, 0]}
            activeBar={{ fill: COR.ink, fillOpacity: 1 }}
            isAnimationActive={!desenhou}
            onAnimationEnd={() => setDesenhou(true)}
            animationDuration={DURACAO_GRAFICO_MS}
            animationEasing={CURVA}
          >
            <LabelList dataKey="valor" position="top" content={rotulo} />
          </Bar>
          <Mira valor={(v) => numero(v, 2)} data={data} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
