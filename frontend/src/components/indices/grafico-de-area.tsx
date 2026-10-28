"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { escalaDoEixo } from "@/lib/escala-do-grafico";
import { numero } from "@/lib/format";
import { marcasDoEixoX, reduzirParaGrafico, type PontoSerie } from "@/lib/indices";
import { CURVA, DURACAO_GRAFICO_MS } from "@/lib/movimento";
import { Balao, COR, Mira } from "./pecas-do-grafico";

/*
 * Os pontos de um índice de bolsa, dia a dia. A linha tracejada é a média do período: ajuda a ver se o
 * índice está acima ou abaixo do que foi o normal naquele intervalo. Acima de uns 400 pregões o
 * desenho usa um ponto a cada tantos dias (o último sempre entra); a tabela mostra todos.
 */

type Props = {
  serie: PontoSerie[];
  media: number;
  titulo: string;
  descricao: string;
  valor: (v: number) => string;
  /** Valor curto, sem casas, para o eixo e a média. */
  valorCurto: (v: number) => string;
  data: (d: string) => string;
  id: string;
};

export function GraficoDeArea({ serie, media, titulo, descricao, valor, valorCurto, data, id }: Props) {
  // desenha só na entrada; trocar de período (ou redimensionar) não refaz a animação de 1,1 s
  const [desenhou, setDesenhou] = useState(false);
  const desenho = reduzirParaGrafico(serie);
  const valores = desenho.map((p) => p.valor);
  const marcasY = escalaDoEixo(Math.min(...valores), Math.max(...valores), 4);
  const marcasX = marcasDoEixoX(desenho, "diaria");
  const idDoGradiente = `area-${id}`;

  return (
    <div className="h-[280px] w-full touch-pan-y sm:h-[296px] [&_.recharts-surface:focus-visible]:rounded [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-4 [&_.recharts-surface:focus-visible]:outline-ink [&_.recharts-surface]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={desenho} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} title={titulo} desc={descricao}>
          <defs>
            <linearGradient id={idDoGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR.linha} stopOpacity={0.2} />
              <stop offset="100%" stopColor={COR.linha} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COR.pauta} vertical={false} />
          <XAxis
            dataKey="data"
            ticks={marcasX}
            interval="preserveStartEnd"
            minTickGap={12}
            tickFormatter={(d: string) => data(d)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COR.eixo }}
            height={30}
          />
          <YAxis
            width={60}
            ticks={marcasY}
            domain={[marcasY[0] ?? "auto", marcasY[marcasY.length - 1] ?? "auto"]}
            tickFormatter={(v: number) => valorCurto(v)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: COR.eixo }}
          />
          <ReferenceLine
            y={media}
            stroke="#8a93a6"
            strokeDasharray="5 4"
            label={{ value: `Média ${valorCurto(media)}`, position: "insideTopRight", fontSize: 12, fill: COR.eixo }}
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
          <Area
            type="linear"
            dataKey="valor"
            stroke={COR.linha}
            strokeWidth={2}
            fill={`url(#${idDoGradiente})`}
            isAnimationActive={!desenhou}
            onAnimationEnd={() => setDesenhou(true)}
            animationDuration={DURACAO_GRAFICO_MS}
            animationEasing={CURVA}
            activeDot={{ r: 5, fill: COR.linha, stroke: "#ffffff", strokeWidth: 2 }}
          />
          <Mira valor={(v) => numero(v, 0)} data={data} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
