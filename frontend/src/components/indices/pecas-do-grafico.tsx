"use client";

import { useState } from "react";
import { useActiveTooltipCoordinate, useActiveTooltipDataPoints, usePlotArea, useYAxisScale } from "recharts";
import { ROTULO_DO_PERIODO, type Periodo, type PontoSerie } from "@/lib/indices";

/*
 * Peças comuns aos dois gráficos dos índices (barras e área).
 *
 * Cores em hex, e não var(): o Recharts pinta o SVG com estes valores. São os tokens do site:
 * ink (#0e1b33), pauta (#dce3ee), mute (#5d6b7f) e o roxo das barras, o da marca clareado.
 */
export const COR = {
  ink: "#0e1b33",
  pauta: "#dce3ee",
  eixo: "#5d6b7f",
  texto2: "#4b5a73",
  barra: "#7359e5",
  linha: "#5b3fd0",
  mira: "rgba(14, 27, 51, 0.5)",
} as const;

/** "1A 3A 5A 10A Máx": botões de alternância, um só pressionado. */
export function SeletorDePeriodo({
  periodos,
  atual,
  aoEscolher,
}: {
  periodos: Periodo[];
  atual: Periodo;
  aoEscolher: (p: Periodo) => void;
}) {
  return (
    <div role="group" aria-label="Período do gráfico" className="flex flex-wrap gap-1.5">
      {periodos.map((p) => {
        const ativo = p === atual;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={ativo}
            aria-label={`Mostrar ${ROTULO_DO_PERIODO[p].frase}`}
            onClick={() => aoEscolher(p)}
            className={`toque min-h-11 min-w-11 touch-manipulation rounded-full border px-3 text-[13px] leading-[19px] font-medium ${
              ativo ? "border-ink bg-ink text-white" : "border-pauta bg-card text-ink hover:border-ink focus-visible:border-ink"
            }`}
          >
            {ROTULO_DO_PERIODO[p].botao}
          </button>
        );
      })}
    </div>
  );
}

/**
 * O balão escuro do tooltip: o valor exato em cima, a data embaixo. É também uma região "status",
 * para o leitor de tela anunciar o ponto quando a pessoa anda pelo gráfico com as setas.
 */
export function Balao({
  ponto,
  valor,
  data,
}: {
  ponto: PontoSerie | undefined;
  valor: (v: number) => string;
  data: (d: string) => string;
}) {
  return (
    <div role="status" aria-live="polite" data-balao-do-grafico>
      {ponto && (
        <div className="rounded-lg bg-ink px-3.5 py-2 whitespace-nowrap text-white shadow-folha">
          <p className="tnum text-[19px] leading-[26px] font-semibold">{valor(ponto.valor)}</p>
          <p className="tnum text-xs leading-[17px]">{data(ponto.data)}</p>
        </div>
      )}
    </div>
  );
}

const LARGURA_DO_CARACTERE = 6.8;

/** Um rótulo escuro sobre o eixo: o valor ou a data do ponto que a mira marca. */
function Etiqueta({ x, y, texto }: { x: number; y: number; texto: string }) {
  const largura = texto.length * LARGURA_DO_CARACTERE + 12;
  return (
    <g>
      <rect x={x} y={y} width={largura} height={21} rx={4} fill={COR.ink} />
      <text x={x + 6} y={y + 15} fontSize={12} fill="#ffffff">
        {texto}
      </text>
    </g>
  );
}

/**
 * A mira: linhas vertical e horizontal no ponto ativo, com o valor destacado no eixo vertical e a data
 * no horizontal. Fica dentro do gráfico e lê o ponto ativo dos hooks do Recharts, então segue o mouse,
 * o dedo e as setas do teclado sem estado próprio.
 */
export function Mira({ valor, data }: { valor: (v: number) => string; data: (d: string) => string }) {
  const ativos = useActiveTooltipDataPoints<PontoSerie>();
  const coordenada = useActiveTooltipCoordinate();
  const area = usePlotArea();
  const escalaY = useYAxisScale();
  const ponto = ativos?.[0];
  if (!ponto || !coordenada || !area || !escalaY) return null;
  const y = escalaY(ponto.valor);
  if (typeof y !== "number" || Number.isNaN(y)) return null;

  const x = coordenada.x;
  const textoY = valor(ponto.valor);
  const textoX = data(ponto.data);
  const larguraX = textoX.length * LARGURA_DO_CARACTERE + 12;
  const larguraY = textoY.length * LARGURA_DO_CARACTERE + 12;
  const xDaData = Math.min(Math.max(x - larguraX / 2, area.x), area.x + area.width - larguraX);

  return (
    <g pointerEvents="none" aria-hidden>
      <line x1={x} x2={x} y1={area.y} y2={area.y + area.height} stroke={COR.mira} strokeWidth={1} />
      <line x1={area.x} x2={area.x + area.width} y1={y} y2={y} stroke={COR.mira} strokeWidth={1} />
      <Etiqueta x={Math.max(0, area.x - larguraY - 4)} y={y - 10.5} texto={textoY} />
      <Etiqueta x={xDaData} y={area.y + area.height + 4} texto={textoX} />
    </g>
  );
}

/**
 * "Ver os dados em tabela": a alternativa em texto ao gráfico. As linhas só vão para o DOM quando a
 * pessoa abre, para um período de 15 anos não pesar a página.
 */
export function TabelaDosDados({
  titulo,
  serie,
  valor,
  data,
  rotuloDaData,
}: {
  titulo: string;
  serie: PontoSerie[];
  valor: (v: number) => string;
  data: (d: string) => string;
  rotuloDaData: string;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <details className="group" onToggle={(e) => setAberta(e.currentTarget.open)}>
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded text-sm font-medium text-ink underline decoration-1 underline-offset-4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="transition-transform group-open:rotate-90">
          <path d="m9 18 6-6-6-6" />
        </svg>
        Ver os dados em tabela
      </summary>
      {aberta && (
        <div className="mt-2 max-h-80 overflow-auto rounded-md border border-pauta">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">{titulo}</caption>
            <thead className="sticky top-0 bg-paper text-xs font-medium text-ink">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {rotuloDaData}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {[...serie].reverse().map((p) => (
                <tr key={p.data} className="border-t border-pauta">
                  <th scope="row" className="tnum px-4 py-2 font-normal text-ink-2">
                    {data(p.data)}
                  </th>
                  <td className="tnum px-4 py-2 text-right text-ink">{valor(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
