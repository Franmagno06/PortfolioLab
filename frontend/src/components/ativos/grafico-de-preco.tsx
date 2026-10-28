"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PontoDePreco } from "@/lib/ativos-tipos";
import { escalaDoEixo } from "@/lib/escala-do-grafico";
import { brl, mesAno, mesCurto } from "@/lib/format";
import { CURVA, DURACAO_GRAFICO_MS } from "@/lib/movimento";

/*
 * O preço no fechamento de cada mês, nos últimos 12. Linha e área na cor da
 * classe do ativo (verde para ação, azul para FII), com o último ponto
 * marcado. Hex direto, e não var(): o Recharts pinta SVG com estes valores.
 * A linha e a área se desenham uma vez, na duração do kit de movimento.
 */

const COR_DA_PAUTA = "#dce3ee";
const COR_DO_EIXO = "#5d6b7f";

type Props = { ticker: string; historico: PontoDePreco[]; cor: string };

/** Os 12 valores em texto: o tooltip do gráfico só aparece para quem usa o mouse. */
function TabelaParaLeitorDeTela({ ticker, historico }: Omit<Props, "cor">) {
  return (
    // relative + overflow-hidden: a tabela sr-only é absolute e, sem este recipiente, alarga a página no celular
    <div className="relative overflow-hidden">
      <table className="sr-only">
        <caption>Fechamento de {ticker} em cada um dos últimos 12 meses</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Fechamento</th>
          </tr>
        </thead>
        <tbody>
          {historico.map((p) => (
            <tr key={p.mes}>
              <th scope="row">{mesAno(p.mes)}</th>
              <td>{brl(p.fechamento)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GraficoDePreco({ ticker, historico, cor }: Props) {
  // o ponto do último fechamento só surge quando a linha termina de se desenhar
  const [desenhou, setDesenhou] = useState(false);
  // referência estável: o Recharts reanima sempre que a referência dos dados muda
  const dados = useMemo(() => historico.map((p) => ({ ...p, rotulo: mesCurto(p.mes) })), [historico]);
  const primeiro = historico[0];
  const ultimo = historico[historico.length - 1];
  if (!primeiro || !ultimo) return null;

  const fechamentos = historico.map((p) => p.fechamento);
  const marcas = escalaDoEixo(Math.min(...fechamentos), Math.max(...fechamentos));
  const idDoGradiente = `area-${ticker}`;
  const descricao = `Preço de ${ticker} no fechamento de cada mês: de ${brl(primeiro.fechamento)} em ${mesAno(primeiro.mes)} a ${brl(ultimo.fechamento)} em ${mesAno(ultimo.mes)}.`;

  return (
    <div>
      <div role="img" aria-label={descricao} className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {/* accessibilityLayer desligada: a camada do Recharts tornaria o SVG focável
              dentro de um role="img", e a tabela de texto já cobre quem usa teclado. */}
          <AreaChart data={dados} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id={idDoGradiente} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COR_DA_PAUTA} vertical={false} />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: COR_DO_EIXO }}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: COR_DO_EIXO }}
              tickFormatter={(v: number) => brl(v)}
              ticks={marcas}
              domain={[marcas[0] ?? "auto", marcas[marcas.length - 1] ?? "auto"]}
            />
            <Tooltip
              cursor={{ stroke: COR_DO_EIXO, strokeDasharray: "3 3" }}
              formatter={(valor) => [brl(Number(valor)), "Fechamento"]}
              labelFormatter={(_, itens) => {
                const mes = itens?.[0]?.payload?.mes;
                return typeof mes === "string" ? mesAno(mes) : "";
              }}
              contentStyle={{ borderRadius: 6, borderColor: COR_DA_PAUTA, fontSize: 13, boxShadow: "none" }}
            />
            <Area
              type="monotone"
              dataKey="fechamento"
              stroke={cor}
              strokeWidth={2}
              fill={`url(#${idDoGradiente})`}
              isAnimationActive
              animationDuration={DURACAO_GRAFICO_MS}
              animationEasing={CURVA}
              onAnimationEnd={() => setDesenhou(true)}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
            {desenhou && <ReferenceDot x={mesCurto(ultimo.mes)} y={ultimo.fechamento} r={5} fill={cor} stroke="#fff" strokeWidth={2} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <TabelaParaLeitorDeTela ticker={ticker} historico={historico} />
    </div>
  );
}
