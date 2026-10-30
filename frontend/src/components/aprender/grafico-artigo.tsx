"use client";

import { forwardRef, useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl, multiplo, numero, percentual } from "@/lib/format";
import { CURVA, DURACAO_GRAFICO_MS } from "@/lib/movimento";
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

/** Cores padrão para SVG inspiradas no design editorial do PortfolioLab */
const COR = {
  ink: "#0e1b33",
  pauta: "#dce3ee",
  eixo: "#5d6b7f",
  texto2: "#4b5a73",
  linha: "#5b3fd0",
  mira: "rgba(14, 27, 51, 0.4)",
} as const;

/**
 * Pílula deslizante com física de mola (spring: stiffness 400, damping 30).
 * Compatível com a API de layout do Framer Motion e renderizada de forma segura.
 */
type MotionSpanProps = {
  layoutId?: string;
  transition?: { type?: string; stiffness?: number; damping?: number; [key: string]: unknown };
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

const motion = {
  span: forwardRef<HTMLSpanElement, MotionSpanProps & React.HTMLAttributes<HTMLSpanElement>>(
    function MotionSpan({ layoutId, transition, className, style, children, ...props }, ref) {
      return (
        <span
          ref={ref}
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

/**
 * Balão interativo (tooltip): exibe o rótulo da coordenada no topo
 * e os valores formatados de cada série ativa com ponto colorido de identificação.
 */
function BalaoGraficoArtigo({
  ativo,
  payload,
  rotuloX,
  formato,
}: {
  ativo?: boolean;
  payload?: any[];
  rotuloX?: string;
  formato: FormatoGraficoArtigo;
}) {
  if (!ativo || !payload || payload.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-balao-grafico-artigo
      className="min-w-[150px] rounded-lg bg-ink px-3.5 py-2.5 text-white shadow-folha"
    >
      {rotuloX && (
        <p className="mb-1.5 border-b border-white/15 pb-1 text-xs font-semibold text-white/90">
          {rotuloX}
        </p>
      )}
      <div className="flex flex-col gap-1 text-xs">
        {payload.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-white/80">
              <span
                className="inline-block h-2 w-2 rounded-full"
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
    </div>
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
  const [desenhou, setDesenhou] = useState(false);
  const [estaAtivo, setEstaAtivo] = useState(false);
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const idUnico = useId().replace(/:/g, "");

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

  const cenarioAtual = cenarios.find((c) => c.id === cenarioId) ?? cenarios[0];
  const dados = cenarioAtual?.dados ?? [];
  const series = cenarioAtual?.series ?? [];
  const chaveEixoX = cenarioAtual?.eixoX ?? eixoXProp ?? "rotulo";

  // Resumo descritivo acessível para leitores de tela e role="img"
  const resumoAcessivel = (() => {
    const qtdPontos = dados.length;
    const nomesSeries = series.map((s) => s.nome).join(", ");
    const cenarioTexto = cenarios.length > 1 ? ` Cenário: ${cenarioAtual?.rotulo}.` : "";
    return `Gráfico de ${modo === "area" ? "área" : "barras"}: ${titulo}.${cenarioTexto} Mostra ${qtdPontos} pontos de dados para ${nomesSeries}. ${descricao}`;
  })();

  const alturaGrafico = altura ?? (modo === "area" ? 280 : 300);

  return (
    <figure
      className={`my-6 rounded-xl border border-pauta bg-card p-4 sm:p-6 shadow-sm ${className}`}
      data-grafico-artigo
      data-preset={preset}
      data-modo={modo}
    >
      {/* Cabeçalho: Título, descrição e pílulas de alternância de cenários */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <figcaption className="font-leitura text-base font-semibold leading-snug text-ink sm:text-lg">
            {titulo}
          </figcaption>
          {descricao && <p className="text-xs text-ink-2 sm:text-sm">{descricao}</p>}
        </div>

        {/* Pílulas de cenários deslizantes com spring e layoutId */}
        {cenarios.length > 1 && (
          <div
            role="tablist"
            aria-label="Cenários do gráfico"
            className="relative flex flex-wrap items-center gap-1 self-start rounded-full border border-pauta bg-paper p-1"
          >
            {cenarios.map((cen) => {
              const ativo = cen.id === cenarioAtual?.id;
              return (
                <button
                  key={cen.id}
                  role="tab"
                  type="button"
                  aria-selected={ativo}
                  onClick={() => setCenarioId(cen.id)}
                  className={`toque relative z-10 min-h-9 touch-manipulation rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                    ativo ? "text-white" : "text-ink hover:text-ink-soft"
                  }`}
                >
                  {ativo && (
                    <motion.span
                      layoutId="cenario-grafico-artigo"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute inset-0 -z-10 rounded-full bg-ink shadow-sm"
                    />
                  )}
                  {cen.rotulo}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Área gráfica acessível com Recharts e suporte a mouse/touch */}
      <div
        role="img"
        aria-label={resumoAcessivel}
        tabIndex={0}
        onPointerMove={() => {
          if (!estaAtivo) setEstaAtivo(true);
        }}
        onPointerLeave={() => {
          if (estaAtivo) setEstaAtivo(false);
        }}
        className="mt-4 w-full touch-pan-y focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink focus-visible:rounded-lg"
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
            <AreaChart data={dados} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
              <defs>
                {series.map((s, idx) => {
                  const gradId = `area-grad-${idUnico}-${s.chave}-${idx}`;
                  return (
                    <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.cor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={s.cor} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid stroke={COR.pauta} vertical={false} />
              <XAxis
                dataKey={chaveEixoX}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: COR.eixo }}
                height={28}
              />
              <YAxis
                width={formato === "moeda" ? 64 : 44}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: COR.eixo }}
                tickFormatter={(v: number) => formatarEixoY(v, formato)}
              />
              <Tooltip
                cursor={{ stroke: COR.mira, strokeWidth: 1, strokeDasharray: "4 4" }}
                isAnimationActive={false}
                offset={16}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
                content={({ active, payload, label }) => (
                  <BalaoGraficoArtigo
                    ativo={active}
                    payload={payload as any}
                    rotuloX={String(label ?? "")}
                    formato={formato}
                  />
                )}
              />
              {series.map((s, idx) => {
                const gradId = `area-grad-${idUnico}-${s.chave}-${idx}`;
                return (
                  <Area
                    key={s.chave}
                    type="monotone"
                    dataKey={s.chave}
                    name={s.nome}
                    stroke={s.cor}
                    strokeWidth={2}
                    fill={`url(#${gradId})`}
                    isAnimationActive={!desenhou}
                    onAnimationEnd={() => setDesenhou(true)}
                    animationDuration={DURACAO_GRAFICO_MS}
                    animationEasing={CURVA}
                    activeDot={{ r: 5, fill: s.cor, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                );
              })}
            </AreaChart>
          ) : (
            <BarChart
              data={dados}
              margin={{ top: 20, right: 12, bottom: 4, left: 0 }}
              barCategoryGap="18%"
            >
              <CartesianGrid stroke={COR.pauta} vertical={false} />
              <XAxis
                dataKey={chaveEixoX}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: COR.eixo }}
                height={28}
              />
              <YAxis
                width={formato === "moeda" ? 64 : 44}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: COR.eixo }}
                tickFormatter={(v: number) => formatarEixoY(v, formato)}
              />
              <Tooltip
                cursor={{ fill: "rgba(14, 27, 51, 0.04)" }}
                isAnimationActive={false}
                offset={16}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
                content={({ active, payload, label }) => (
                  <BalaoGraficoArtigo
                    ativo={active}
                    payload={payload as any}
                    rotuloX={String(label ?? "")}
                    formato={formato}
                  />
                )}
              />
              {series.map((s) => (
                <Bar
                  key={s.chave}
                  dataKey={s.chave}
                  name={s.nome}
                  fill={s.cor}
                  fillOpacity={0.88}
                  radius={[3, 3, 0, 0]}
                  activeBar={{ fill: COR.ink, fillOpacity: 1 }}
                  isAnimationActive={!desenhou}
                  onAnimationEnd={() => setDesenhou(true)}
                  animationDuration={DURACAO_GRAFICO_MS}
                  animationEasing={CURVA}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Resumo invisível mas lido diretamente pelo leitor de tela */}
      <div className="sr-only" aria-live="polite">
        {resumoAcessivel}
      </div>

      {/* Tabela de dados equivalente para acessibilidade e inspeção precisa */}
      <details
        className="group mt-3 border-t border-pauta pt-2.5 text-xs text-ink-2"
        onToggle={(e) => setTabelaAberta(e.currentTarget.open)}
      >
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-medium text-ink hover:text-linha">
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
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-pauta bg-card">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                {titulo} - {cenarioAtual?.rotulo}
              </caption>
              <thead className="sticky top-0 bg-paper text-mute font-medium">
                <tr>
                  <th scope="col" className="px-3.5 py-2">
                    {chaveEixoX}
                  </th>
                  {series.map((s) => (
                    <th key={s.chave} scope="col" className="px-3.5 py-2 text-right">
                      {s.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-pauta text-ink">
                {dados.map((d, i) => (
                  <tr key={i} className="hover:bg-paper/50">
                    <th scope="row" className="px-3.5 py-1.5 font-normal">
                      {String(d[chaveEixoX] ?? "")}
                    </th>
                    {series.map((s) => (
                      <td key={s.chave} className="tnum px-3.5 py-1.5 text-right font-medium">
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
    </figure>
  );
}
