"use client";

import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  useActiveTooltipCoordinate,
  useActiveTooltipDataPoints,
  usePlotArea,
  useYAxisScale,
  XAxis,
  YAxis,
} from "recharts";
import type { Props as PropsDoRotulo } from "recharts/types/component/Label";
import { escalaDoEixo } from "@/lib/escala-do-grafico";
import { brl, multiplo, numero, percentual } from "@/lib/format";
import { CURVA, DURACAO_GRAFICO_MS, DURACAO_RAPIDA, DURACAO_RAPIDA_MS } from "@/lib/movimento";
import {
  CenarioGraficoArtigo,
  FormatoGraficoArtigo,
  ModoGraficoArtigo,
  PRESETS_GRAFICO_ARTIGO,
  PresetGraficoArtigo,
  SerieGraficoArtigo,
} from "@/lib/aprender/exemplos";

export type {
  CenarioGraficoArtigo,
  FormatoGraficoArtigo,
  ModoGraficoArtigo,
  PresetGraficoArtigo,
  SerieGraficoArtigo,
};

/**
 * Cores em hex para o SVG do Recharts — espelham pecas-do-grafico.tsx:
 * ink (#0e1b33), pauta/grade (#dce3ee), eixo (#5d6b7f), texto2 (#4b5a73),
 * barra (#7359e5), linha (#5b3fd0) e mira.
 */
export const COR = {
  ink: "#0e1b33",
  pauta: "#dce3ee",
  grade: "#dce3ee",
  eixo: "#5d6b7f",
  texto2: "#4b5a73",
  barra: "#7359e5",
  linha: "#5b3fd0",
  mira: "rgba(14, 27, 51, 0.5)",
} as const;

const LARGURA_DO_CARACTERE = 6.8;
const LARGURA_PARA_ROTULO = 30;
const DURACAO_TRANSICAO_CENARIO_MS = 380;

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Guarda a última posição de cada layoutId para animar o deslize (FLIP) via WAAPI. */
const ultimoRectPorLayoutId = new Map<string, DOMRect>();

type MotionTransition = {
  duration?: number;
  ease?: string;
  type?: string;
  stiffness?: number;
  damping?: number;
  [key: string]: unknown;
};

type MotionCommonProps = {
  layoutId?: string;
  transition?: MotionTransition;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

const motion = {
  span: forwardRef<HTMLSpanElement, MotionCommonProps & React.HTMLAttributes<HTMLSpanElement>>(
    function MotionSpan({ layoutId, transition, className, style, children, ...props }, refExterna) {
      const refInterna = useRef<HTMLSpanElement | null>(null);

      useIsomorphicLayoutEffect(() => {
        const el = refInterna.current;
        if (!el || !layoutId) return;
        const atual = el.getBoundingClientRect();
        const anterior = ultimoRectPorLayoutId.get(layoutId);
        if (atual.width > 0) {
          ultimoRectPorLayoutId.set(layoutId, atual);
        }
        if (
          anterior &&
          anterior.width > 0 &&
          atual.width > 0 &&
          typeof el.animate === "function"
        ) {
          const dx = anterior.left - atual.left;
          const dy = anterior.top - atual.top;
          const sx = anterior.width / atual.width;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(sx - 1) > 0.02) {
            el.style.transformOrigin = "left center";
            el.animate(
              [
                { transform: `translate(${dx}px, ${dy}px) scaleX(${sx})` },
                { transform: "translate(0px, 0px) scaleX(1)" },
              ],
              {
                duration: DURACAO_RAPIDA_MS,
                easing: CURVA,
              },
            );
          }
        }
        return () => {
          const r = el.getBoundingClientRect();
          if (r.width > 0) {
            ultimoRectPorLayoutId.set(layoutId, r);
          }
        };
      }, [layoutId]);

      return (
        <span
          ref={(node) => {
            refInterna.current = node;
            if (typeof refExterna === "function") refExterna(node);
            else if (refExterna) refExterna.current = node;
          }}
          data-layout-id={layoutId}
          data-transition={transition ? JSON.stringify(transition) : undefined}
          className={className}
          style={style}
          {...props}
        >
          {children}
        </span>
      );
    },
  ),

  div: forwardRef<HTMLDivElement, MotionCommonProps & React.HTMLAttributes<HTMLDivElement>>(
    function MotionDiv({ layoutId, transition, className, style, children, ...props }, refExterna) {
      const refInterna = useRef<HTMLDivElement | null>(null);

      useIsomorphicLayoutEffect(() => {
        const el = refInterna.current;
        if (!el || typeof el.animate !== "function") return;
        el.animate(
          [
            { opacity: 0.35, transform: "translateY(3px)" },
            { opacity: 1, transform: "translateY(0px)" },
          ],
          {
            duration: DURACAO_RAPIDA_MS,
            easing: CURVA,
          },
        );
      }, []);

      return (
        <div
          ref={(node) => {
            refInterna.current = node;
            if (typeof refExterna === "function") refExterna(node);
            else if (refExterna) refExterna.current = node;
          }}
          data-layout-id={layoutId}
          data-transition={transition ? JSON.stringify(transition) : undefined}
          className={className}
          style={style}
          {...props}
        >
          {children}
        </div>
      );
    },
  ),
};

/** Formatação consistente dos números nos eixos, balão e tabela acessível */
export function formatarValorArtigo(v: unknown, formato: FormatoGraficoArtigo): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  switch (formato) {
    case "moeda":
      return brl(n);
    case "percentual": {
      const temSegundaCasa = Math.round(n * 10) !== n * 10;
      return percentual(n, temSegundaCasa ? 2 : Number.isInteger(n) ? 0 : 1);
    }
    case "multiplicador": {
      const temSegundaCasa = Math.round(n * 10) !== n * 10;
      return multiplo(n, temSegundaCasa ? 2 : Number.isInteger(n) ? 0 : 1);
    }
    case "numero":
    default:
      return numero(n, Number.isInteger(n) ? 0 : 2);
  }
}

/** Valor abreviado para a régua do eixo vertical (YAxis) */
function formatarEixoY(v: number, formato: FormatoGraficoArtigo): string {
  if (!Number.isFinite(v)) return "";
  if (formato === "moeda") {
    if (v >= 1_000_000) return `R$ ${numero(v / 1_000_000, 1)}M`;
    if (v >= 1_000) return `R$ ${numero(Math.round(v / 1_000))}k`;
    return brl(v);
  }
  if (formato === "percentual") {
    return `${numero(v, Number.isInteger(v) ? 0 : 1)}%`;
  }
  if (formato === "multiplicador") {
    return `${numero(v, Number.isInteger(v) ? 0 : 1)}x`;
  }
  return numero(v, 0);
}

/** Rótulo legível para o cabeçalho da coluna do eixo X na tabela acessível */
function rotuloColunaEixoX(chave: string): string {
  const mapa: Record<string, string> = {
    rotulo: "Período",
    ano: "Ano",
    setor: "Setor",
    prazo: "Prazo",
    ativo: "Categoria",
    mes: "Mês",
  };
  return mapa[chave] ?? chave.charAt(0).toUpperCase() + chave.slice(1);
}

/**
 * O balão escuro do tooltip, no padrão de pecas-do-grafico.tsx:
 * região "status" sempre montada para o leitor de tela anunciar o ponto ativo.
 */
function BalaoGraficoArtigo({
  ativo,
  payload,
  rotuloX,
  formato,
}: {
  ativo?: boolean;
  payload?: ReadonlyArray<{ name?: string; dataKey?: string; value?: unknown; color?: string; fill?: string }>;
  rotuloX?: string;
  formato: FormatoGraficoArtigo;
}) {
  const itens = ativo && payload && payload.length > 0 ? payload : undefined;

  return (
    <div role="status" aria-live="polite" data-balao-grafico-artigo data-balao-do-grafico>
      {itens && (
        <div className="rounded-lg bg-ink px-3.5 py-2 whitespace-nowrap text-white shadow-folha">
          {itens.length === 1 ? (
            <>
              <p className="tnum text-[19px] leading-[26px] font-semibold">
                {formatarValorArtigo(itens[0]?.value, formato)}
              </p>
              <p className="tnum text-xs leading-[17px] text-white/85">
                {rotuloX}
                {itens[0]?.name ? ` · ${itens[0].name}` : ""}
              </p>
            </>
          ) : (
            <>
              {rotuloX && (
                <p className="tnum mb-1.5 border-b border-white/15 pb-1 text-xs leading-[17px] font-semibold text-white">
                  {rotuloX}
                </p>
              )}
              <div className="flex flex-col gap-1 text-xs leading-[17px]">
                {itens.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-white/85">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color || item.fill || COR.linha }}
                        aria-hidden
                      />
                      {item.name || item.dataKey}
                    </span>
                    <span className="tnum font-semibold text-white">
                      {formatarValorArtigo(item.value, formato)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Rótulo escuro sobre o eixo: valor ou coordenada do ponto que a mira marca (pecas-do-grafico.tsx). */
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
 * A mira nos eixos, padronizada com pecas-do-grafico.tsx:
 * linhas vertical e horizontal no ponto ativo, com etiquetas no eixo vertical e horizontal.
 */
function MiraGraficoArtigo({
  chaveEixoX,
  chaveValor,
  formato,
}: {
  chaveEixoX: string;
  chaveValor: string;
  formato: FormatoGraficoArtigo;
}) {
  const ativos = useActiveTooltipDataPoints<Record<string, unknown>>();
  const coordenada = useActiveTooltipCoordinate();
  const area = usePlotArea();
  const escalaY = useYAxisScale();
  const ponto = ativos?.[0];
  if (!ponto || !coordenada || !area || !escalaY) return null;

  const valorNumerico = Number(ponto[chaveValor]);
  if (!Number.isFinite(valorNumerico)) return null;
  const y = escalaY(valorNumerico);
  if (typeof y !== "number" || Number.isNaN(y)) return null;

  const x = coordenada.x;
  const textoY = formatarEixoY(valorNumerico, formato);
  const textoX = String(ponto[chaveEixoX] ?? "");
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

export type GraficoArtigoProps = {
  /** Preset didático pré-configurado */
  preset?: PresetGraficoArtigo;
  /** Modo de visualização: "area" (curvas e linhas) ou "barras" (colunas comparativas) */
  modo?: ModoGraficoArtigo;
  /** Título principal do gráfico */
  titulo?: string;
  /** Descrição ou legenda didática */
  descricao?: string;
  /** Formato de formatação de valores */
  formato?: FormatoGraficoArtigo;
  /** Lista de cenários com pílulas de alternância */
  cenarios?: CenarioGraficoArtigo[];
  /** Dados diretos (quando utilizado sem cenários nem preset) */
  dados?: Record<string, unknown>[];
  /** Séries a serem renderizadas */
  series?: SerieGraficoArtigo[];
  /** Chave do objeto de dados usada no eixo X (ex.: 'rotulo', 'ano', 'setor') */
  eixoX?: string;
  /** ID do cenário ativo por padrão */
  cenarioPadrao?: string;
  /** Altura customizada do gráfico em pixels */
  altura?: number;
  className?: string;
};

export function GraficoArtigo({
  preset,
  modo: modoProp,
  titulo: tituloProp,
  descricao: descricaoProp,
  formato: formatoProp,
  cenarios: cenariosProp,
  dados: dadosProp,
  series: seriesProp,
  eixoX: eixoXProp,
  cenarioPadrao,
  altura,
  className = "",
}: GraficoArtigoProps) {
  const [estaAtivo, setEstaAtivo] = useState(false);
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const idUnico = useId().replace(/:/g, "");
  const layoutIdCenario = `cenario-grafico-artigo-${idUnico}`;

  // Resolução da configuração (preset vs props manuais)
  const definicaoPreset = preset ? PRESETS_GRAFICO_ARTIGO[preset] : undefined;

  const modo: ModoGraficoArtigo = modoProp ?? definicaoPreset?.modoPadrao ?? "area";
  const titulo = tituloProp ?? definicaoPreset?.titulo ?? "Gráfico didático";
  const descricao = descricaoProp ?? definicaoPreset?.descricao ?? "";
  const formato: FormatoGraficoArtigo = formatoProp ?? definicaoPreset?.formato ?? "numero";

  const cenarios =
    cenariosProp ??
    definicaoPreset?.cenarios ??
    (dadosProp && seriesProp
      ? [
          {
            id: "padrao",
            rotulo: "Principal",
            dados: dadosProp,
            series: seriesProp,
            eixoX: eixoXProp ?? "rotulo",
          },
        ]
      : []);

  const [cenarioId, setCenarioId] = useState<string>(
    () => cenarioPadrao ?? cenarios[0]?.id ?? "padrao",
  );
  const [jaTrocouCenario, setJaTrocouCenario] = useState(false);
  const refAreaGrafica = useRef<HTMLDivElement | null>(null);
  const cenarioAnteriorRef = useRef<string>(cenarioId);

  useIsomorphicLayoutEffect(() => {
    if (cenarioAnteriorRef.current === cenarioId) return;
    cenarioAnteriorRef.current = cenarioId;
    const el = refAreaGrafica.current;
    if (el && typeof el.animate === "function") {
      el.animate(
        [
          { opacity: 0.72, transform: "translateY(2px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        {
          duration: DURACAO_RAPIDA_MS,
          easing: CURVA,
        },
      );
    }
  }, [cenarioId]);

  const duracaoAnimacaoGrafico = jaTrocouCenario
    ? DURACAO_TRANSICAO_CENARIO_MS
    : DURACAO_GRAFICO_MS;

  const cenarioAtual = cenarios.find((c) => c.id === cenarioId) ?? cenarios[0];
  const dados = cenarioAtual?.dados ?? [];
  const series = cenarioAtual?.series ?? [];
  const chaveEixoX = cenarioAtual?.eixoX ?? eixoXProp ?? "rotulo";
  const chavePrincipalMira = series[series.length - 1]?.chave ?? series[0]?.chave ?? "valor";

  // Escala do eixo Y padronizada com escalaDoEixo (passos redondos como nos gráficos de índices)
  const valoresNumericos = dados.flatMap((d) =>
    series.map((s) => Number(d[s.chave])).filter((v) => Number.isFinite(v)),
  );
  const maximoY = valoresNumericos.length > 0 ? Math.max(...valoresNumericos, 0) : 0;
  const marcasY = valoresNumericos.length > 0 ? escalaDoEixo(0, maximoY, 4) : undefined;

  // Resumo descritivo acessível para leitores de tela e role="img"
  const resumoAcessivel = (() => {
    const qtdPontos = dados.length;
    const nomesSeries = series.map((s) => s.nome).join(", ");
    const cenarioTexto = cenarios.length > 1 ? ` Cenário: ${cenarioAtual?.rotulo}.` : "";
    return `Gráfico de ${modo === "area" ? "área" : "barras"}: ${titulo}.${cenarioTexto} Mostra ${qtdPontos} pontos de dados para ${nomesSeries}. ${descricao}`;
  })();

  const alturaGrafico = altura ?? (modo === "area" ? 280 : 300);

  // Rótulo no topo da barra (quando há série única e largura suficiente, igual a grafico-de-barras.tsx)
  const renderizarRotuloBarra = (props: PropsDoRotulo) => {
    const caixa = props.viewBox as { x?: number; y?: number; width?: number } | undefined;
    const largura = Number(caixa?.width ?? props.width ?? 0);
    if (largura < LARGURA_PARA_ROTULO) return null;
    const x = Number(caixa?.x ?? props.x ?? 0) + largura / 2;
    const y = Number(caixa?.y ?? props.y ?? 0) - 6;
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={11} fill={COR.texto2} className="tnum">
        {formatarValorArtigo(props.value, formato)}
      </text>
    );
  };

  return (
    <figure
      className={`my-6 min-w-0 rounded-md border border-pauta bg-card p-5 sm:p-6 ${className}`}
      data-grafico-artigo
      data-preset={preset}
      data-modo={modo}
    >
      {/* Cabeçalho: título, descrição e seletor padronizado em linha única */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[320px] flex-1">
          <figcaption className="font-leitura text-xl leading-[26px] font-semibold text-ink">
            {titulo}
          </figcaption>
          {descricao && (
            <p className="mt-0.5 text-[13px] leading-[19px] text-mute">{descricao}</p>
          )}
        </div>

        {/* Seletor de cenários padronizado com SeletorDePeriodo: sempre em linha única, nunca quebra */}
        {cenarios.length > 1 && (
          <div
            role="tablist"
            aria-label="Cenários do gráfico"
            className="relative inline-flex max-w-full shrink-0 flex-nowrap items-center gap-1 self-start overflow-x-auto rounded-lg border border-pauta bg-paper p-1"
          >
            {cenarios.map((cen) => {
              const ativo = cen.id === cenarioAtual?.id;
              return (
                <button
                  key={cen.id}
                  role="tab"
                  type="button"
                  aria-selected={ativo}
                  onClick={() => {
                    if (cen.id !== cenarioAtual?.id) {
                      setJaTrocouCenario(true);
                      setCenarioId(cen.id);
                    }
                  }}
                  className={`toque relative z-10 inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap touch-manipulation rounded-md px-3 py-1.5 text-[13px] leading-4 font-semibold transition-colors ${
                    ativo ? "text-white" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {ativo && (
                    <motion.span
                      layoutId={layoutIdCenario}
                      transition={{ duration: DURACAO_RAPIDA, ease: CURVA }}
                      className="absolute inset-0 -z-10 rounded-md bg-ink"
                    />
                  )}
                  {cen.rotulo}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legenda das séries e síntese do cenário ativo com transição suave */}
      {(cenarioAtual?.descricao || series.length > 0) && (
        <motion.div
          key={cenarioAtual?.id ?? "padrao"}
          transition={{ duration: DURACAO_RAPIDA, ease: CURVA }}
          className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs leading-[18px] text-ink-2"
        >
          {cenarioAtual?.descricao ? (
            <p className="text-[13px] leading-[19px] text-ink-2">{cenarioAtual.descricao}</p>
          ) : (
            <span />
          )}
          {series.length > 0 && (
            <div className="flex flex-wrap items-center gap-3" aria-hidden>
              {series.map((s) => (
                <span key={s.chave} className="inline-flex items-center gap-1.5 font-medium text-ink">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: s.cor }}
                  />
                  {s.nome}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Área gráfica acessível com Recharts mantida montada entre cenários do mesmo modo */}
      <motion.div
        ref={refAreaGrafica}
        key={modo}
        transition={{ duration: DURACAO_RAPIDA, ease: CURVA }}
        role="img"
        aria-label={resumoAcessivel}
        tabIndex={0}
        onPointerMove={() => {
          if (!estaAtivo) setEstaAtivo(true);
        }}
        onPointerLeave={() => {
          if (estaAtivo) setEstaAtivo(false);
        }}
        className="mt-4 w-full touch-pan-y focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink [&_.recharts-surface:focus-visible]:rounded [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-4 [&_.recharts-surface:focus-visible]:outline-ink [&_.recharts-surface]:outline-none"
        style={{ height: alturaGrafico }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={100}
          minHeight={alturaGrafico}
          initialDimension={{ width: 600, height: alturaGrafico }}
        >
          {modo === "area" ? (
            <AreaChart
              data={dados}
              margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
              title={titulo}
              desc={resumoAcessivel}
            >
              <defs>
                {series.map((s, idx) => {
                  const gradId = `area-grad-${idUnico}-${idx}`;
                  return (
                    <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.cor} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={s.cor} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke={COR.grade} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey={chaveEixoX}
                interval="preserveStartEnd"
                minTickGap={12}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: COR.eixo }}
                height={30}
              />
              <YAxis
                width={formato === "moeda" ? 64 : 48}
                ticks={marcasY}
                domain={[0, marcasY?.[marcasY.length - 1] ?? "auto"]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: COR.eixo }}
                tickFormatter={(v: number) => formatarEixoY(v, formato)}
              />
              <Tooltip
                cursor={false}
                isAnimationActive={false}
                offset={16}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
                content={({ active, payload, label }) => (
                  <BalaoGraficoArtigo
                    ativo={active}
                    payload={payload as ReadonlyArray<{ name?: string; dataKey?: string; value?: unknown; color?: string; fill?: string }>}
                    rotuloX={String(label ?? "")}
                    formato={formato}
                  />
                )}
              />
              {series.map((s, idx) => {
                const gradId = `area-grad-${idUnico}-${idx}`;
                return (
                  <Area
                    key={`serie-area-${idx}`}
                    type="monotone"
                    dataKey={s.chave}
                    name={s.nome}
                    stroke={s.cor}
                    strokeWidth={2}
                    fill={`url(#${gradId})`}
                    isAnimationActive={true}
                    animationDuration={duracaoAnimacaoGrafico}
                    animationEasing={CURVA}
                    activeDot={{ r: 5, fill: s.cor, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                );
              })}
              <MiraGraficoArtigo
                chaveEixoX={chaveEixoX}
                chaveValor={chavePrincipalMira}
                formato={formato}
              />
            </AreaChart>
          ) : (
            <BarChart
              data={dados}
              margin={{ top: 24, right: 8, bottom: 4, left: 0 }}
              barCategoryGap="18%"
              title={titulo}
              desc={resumoAcessivel}
            >
              <CartesianGrid stroke={COR.grade} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey={chaveEixoX}
                interval="preserveStartEnd"
                minTickGap={10}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: COR.eixo }}
                height={30}
              />
              <YAxis
                width={formato === "moeda" ? 64 : 48}
                ticks={marcasY}
                domain={[0, marcasY?.[marcasY.length - 1] ?? "auto"]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: COR.eixo }}
                tickFormatter={(v: number) => formatarEixoY(v, formato)}
              />
              <Tooltip
                cursor={false}
                isAnimationActive={false}
                offset={16}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
                content={({ active, payload, label }) => (
                  <BalaoGraficoArtigo
                    ativo={active}
                    payload={payload as ReadonlyArray<{ name?: string; dataKey?: string; value?: unknown; color?: string; fill?: string }>}
                    rotuloX={String(label ?? "")}
                    formato={formato}
                  />
                )}
              />
              {series.map((s, idx) => (
                <Bar
                  key={`serie-barra-${idx}`}
                  dataKey={s.chave}
                  name={s.nome}
                  fill={s.cor}
                  fillOpacity={0.85}
                  radius={[2, 2, 0, 0]}
                  activeBar={{ fill: COR.ink, fillOpacity: 1 }}
                  isAnimationActive={true}
                  animationDuration={duracaoAnimacaoGrafico}
                  animationEasing={CURVA}
                >
                  {series.length === 1 && (
                    <LabelList
                      key={`rotulo-${cenarioAtual?.id}-${s.chave}`}
                      dataKey={s.chave}
                      position="top"
                      content={renderizarRotuloBarra}
                    />
                  )}
                </Bar>
              ))}
              <MiraGraficoArtigo
                chaveEixoX={chaveEixoX}
                chaveValor={chavePrincipalMira}
                formato={formato}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </motion.div>

      {/* Resumo invisível mas lido diretamente pelo leitor de tela */}
      <div className="sr-only" aria-live="polite">
        {resumoAcessivel}
      </div>

      {/* Tabela de dados acessível no rodapé, padronizada com TabelaDosDados de pecas-do-grafico.tsx */}
      <div className="mt-2">
        <details
          className="group"
          onToggle={(e) => setTabelaAberta(e.currentTarget.open)}
        >
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded text-sm font-medium text-ink underline decoration-1 underline-offset-4">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
              className="transition-transform group-open:rotate-90"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            Ver dados do gráfico em tabela ({cenarioAtual?.rotulo ?? "Dados"})
          </summary>
          {tabelaAberta && (
            <div className="mt-2 max-h-80 overflow-auto rounded-md border border-pauta">
              <table className="w-full text-left text-[13px]">
                <caption className="sr-only">
                  {titulo} — {cenarioAtual?.rotulo}
                </caption>
                <thead className="sticky top-0 bg-paper text-xs font-medium text-ink">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      {rotuloColunaEixoX(chaveEixoX)}
                    </th>
                    {series.map((s) => (
                      <th key={s.chave} scope="col" className="px-4 py-2.5 text-right font-medium">
                        {s.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados.map((d, i) => (
                    <tr key={i} className="border-t border-pauta">
                      <th scope="row" className="tnum px-4 py-2 font-normal text-ink-2">
                        {String(d[chaveEixoX] ?? "")}
                      </th>
                      {series.map((s) => (
                        <td key={s.chave} className="tnum px-4 py-2 text-right text-ink">
                          {formatarValorArtigo(d[s.chave], formato)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </div>
    </figure>
  );
}
