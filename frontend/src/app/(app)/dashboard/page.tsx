"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, TituloCard } from "@/components/ui/card";
import { MensagemErro } from "@/components/ui/mensagem";
import { PageHeader, Pilula } from "@/components/ui/page-header";
import { SkeletonPagina } from "@/components/ui/skeleton";
import { api, ApiError, type Pagina } from "@/lib/api";
import { brl, coresClasse, nomesClasse, pct } from "@/lib/format";
import { maioresPosicoes } from "@/lib/alocacao";
import { calcularDesvios, formatarDesvio, type DesvioDeMeta } from "@/lib/goals";

type Summary = {
  patrimonioTotal: number;
  totalAplicado: number;
  lucroTotal: number;
  lucroPct: number;
  totalProventos: number;
  quantidadeAtivos: number;
  alocacaoPorClasse: { classe: string; valor: number; percentual: number }[];
};

type Provento = {
  amount: string; // Decimal chega como string no JSON
  paidAt: string;
  asset: { ticker: string };
};

type Posicao = { ticker: string; type: string; valorAtual: number };
type Metas = { metas: { ticker: string; targetWeight: number }[] };

/** "AAAA-MM" — mesmo formato que o backend devolve em /portfolio/evolution. */
type PontoEvolucao = { mes: string; aplicado: number; resultado: number; patrimonio: number };

function agruparPorMes(proventos: Provento[]) {
  const porMes = new Map<string, { rotulo: string; total: number }>();
  for (const p of proventos) {
    const data = new Date(p.paidAt);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    const rotulo = data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const atual = porMes.get(chave) ?? { rotulo, total: 0 };
    atual.total += Number(p.amount);
    porMes.set(chave, atual);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ mes: v.rotulo, total: Number(v.total.toFixed(2)) }));
}

/** "2026-03" → "mar". Mesma ideia de agruparPorMes, mas a chave já vem pronta do backend. */
function rotuloMes(mes: string): string {
  const [ano, mesNum] = mes.split("-").map(Number);
  if (!ano || !mesNum) return mes;
  return new Date(Date.UTC(ano, mesNum - 1, 1))
    .toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" })
    .replace(".", "");
}

const umaCasa = (valor: number) => valor.toFixed(1).replace(".", ",");

/**
 * Os ativos que mais saíram da meta, cada um com a própria régua: a barra é o
 * peso de hoje, o traço branco é a meta. Barra passando do traço = acima.
 * Todas as linhas usam a mesma escala, para dar para comparar entre elas.
 */
function MaisLongeDaMeta({
  desvios,
  corDe,
}: {
  desvios: DesvioDeMeta[];
  corDe: (ticker: string) => string;
}) {
  const escala = Math.max(...desvios.map((d) => Math.max(d.atualPct, d.alvoPct)), 1);
  const naEscala = (valor: number) => `${Math.min((valor / escala) * 100, 100)}%`;

  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
      {desvios.map((d) => (
        <li key={d.ticker}>
          <Link
            href={`/simulacao?ticker=${encodeURIComponent(d.ticker)}`}
            aria-label={`${d.ticker}: ${umaCasa(d.atualPct)}% hoje, meta de ${umaCasa(d.alvoPct)}%, ${formatarDesvio(d)}. Abrir na simulação.`}
            className="-mx-2 block rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-semibold">{d.ticker}</span>
              <span className="tnum text-xs text-slate-200">
                {umaCasa(Math.abs(d.desvioPct))} pts {d.desvioPct > 0 ? "acima" : "abaixo"}
              </span>
            </span>
            <span className="relative mt-2 block h-1.5 rounded-full bg-white/10" aria-hidden>
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: naEscala(d.atualPct), background: corDe(d.ticker) }}
              />
              <span
                className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-white"
                style={{ left: naEscala(d.alvoPct) }}
              />
            </span>
            <span className="tnum mt-1.5 block text-xs text-slate-300">
              {umaCasa(d.atualPct)}% hoje, meta {umaCasa(d.alvoPct)}%
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Tons da cor da classe para as fatias de uma classe só; cinza para "outros". */
const opacidades = [1, 0.78, 0.6, 0.45, 0.32];
const corOutros = "#c4c8cf";

function CardAlocacao({
  alocacao,
  posicoes,
  quantidadeAtivos,
}: {
  alocacao: Summary["alocacaoPorClasse"];
  posicoes: Posicao[];
  quantidadeAtivos: number;
}) {
  const [classe, setClasse] = useState<string | null>(null);

  const corClasse = (c: string) => coresClasse[c] ?? "#5d6b7f";
  const maiores = maioresPosicoes(posicoes, classe);
  const classeAtual = alocacao.find((a) => a.classe === classe);

  type Fatia = { chave: string; nome: string; valor: number; pct: number; cor: string; opacidade: number };

  const fatias: Fatia[] =
    classe === null
      ? alocacao.map((a) => ({
          chave: a.classe,
          nome: nomesClasse[a.classe] ?? a.classe,
          valor: a.valor,
          pct: a.percentual,
          cor: corClasse(a.classe),
          opacidade: 1,
        }))
      : [
          ...maiores.itens.map((i, n) => ({
            chave: i.ticker,
            nome: i.ticker,
            valor: i.valor,
            pct: i.percentual,
            cor: corClasse(classe),
            opacidade: opacidades[n] ?? 0.32,
          })),
          ...(maiores.outros
            ? [
                {
                  chave: "outros",
                  nome: "Outros",
                  valor: maiores.outros.valor,
                  pct: maiores.outros.percentual,
                  cor: corOutros,
                  opacidade: 1,
                },
              ]
            : []),
        ];

  const legenda: Fatia[] = [
    ...maiores.itens.map((i, n) => ({
      chave: i.ticker,
      nome: i.ticker,
      valor: i.valor,
      pct: i.percentual,
      cor: corClasse(i.type),
      opacidade: classe === null ? 1 : (opacidades[n] ?? 0.32),
    })),
    ...(maiores.outros
      ? [
          {
            chave: "outros",
            nome: `${maiores.outros.quantidade} ${maiores.outros.quantidade === 1 ? "outro" : "outros"}`,
            valor: maiores.outros.valor,
            pct: maiores.outros.percentual,
            cor: corOutros,
            opacidade: 1,
          },
        ]
      : []),
  ];

  return (
    <Card className="reveal reveal-2 col-span-12 xl:col-span-5">
      <TituloCard
        acessorio={
          alocacao.length > 1 ? (
            <div
              role="group"
              aria-label="Mostrar classe"
              className="flex flex-wrap gap-0.5 rounded-lg bg-paper p-0.5 text-xs"
            >
              {[null, ...alocacao.map((a) => a.classe)].map((c) => (
                <button
                  key={c ?? "todos"}
                  type="button"
                  aria-pressed={classe === c}
                  onClick={() => setClasse(c)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    classe === c ? "bg-card text-ink shadow-sm" : "text-mute hover:text-ink"
                  }`}
                >
                  {c === null ? "Todos" : (nomesClasse[c] ?? c)}
                </button>
              ))}
            </div>
          ) : undefined
        }
      >
        Alocação
      </TituloCard>

      {alocacao.length === 0 ? (
        <p className="mt-4 text-sm text-mute">
          Carteira vazia. Registre uma transação para ver a distribuição.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-5">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fatias}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={fatias.length > 1 ? 3 : 0}
                  strokeWidth={0}
                >
                  {fatias.map((f) => (
                    <Cell key={f.chave} fill={f.cor} fillOpacity={f.opacidade} />
                  ))}
                </Pie>
                <Tooltip
                  offset={8}
                  wrapperStyle={{ outline: "none", zIndex: 10 }}
                  content={({ active, payload }) => {
                    const f = payload?.[0]?.payload as Fatia | undefined;
                    if (!active || !f) return null;
                    return (
                      <div className="rounded-md bg-ink px-2 py-1 text-[11px] leading-tight text-white shadow-md">
                        <p className="font-mono font-semibold">
                          {f.nome}{" "}
                          <span className="tnum font-normal text-slate-300">{umaCasa(f.pct)}%</span>
                        </p>
                        <p className="tnum font-mono text-slate-300">{brl(f.valor)}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {classeAtual ? (
                <>
                  <span className="tnum font-mono text-lg font-bold">
                    {umaCasa(classeAtual.percentual)}%
                  </span>
                  <span className="text-[11px] text-mute">da carteira</span>
                </>
              ) : (
                <>
                  <span className="tnum font-mono text-lg font-bold">{quantidadeAtivos}</span>
                  <span className="text-[11px] text-mute">
                    {quantidadeAtivos === 1 ? "ativo" : "ativos"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-mute">
              {classe === null
                ? "Maiores posições da carteira"
                : `Maiores posições em ${nomesClasse[classe] ?? classe}`}
            </p>
            <ul className="mt-2.5 space-y-2">
              {legenda.map((f) => (
                <li key={f.chave} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: f.cor, opacity: f.opacidade }}
                  />
                  <span
                    className={`truncate ${f.chave === "outros" ? "text-mute" : "font-mono font-medium"}`}
                  >
                    {f.nome}
                  </span>
                  <span className="tnum ml-auto font-mono text-xs font-semibold text-mute">
                    {umaCasa(f.pct)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [proventos, setProventos] = useState<Provento[] | null>(null);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [metas, setMetas] = useState<Metas["metas"]>([]);
  const [evolucao, setEvolucao] = useState<PontoEvolucao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Summary>("/portfolio/summary"),
      api<Pagina<Provento>>("/dividends"),
      api<Posicao[]>("/portfolio"),
      api<Metas>("/goals"),
      api<PontoEvolucao[]>("/portfolio/evolution"),
    ])
      .then(([s, p, pos, m, ev]) => {
        setSummary(s);
        setProventos(p.itens);
        setPosicoes(pos);
        setMetas(m.metas);
        setEvolucao(ev);
      })
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar os dados"),
      );
  }, []);

  if (erro) return <MensagemErro>{erro}</MensagemErro>;
  if (!summary || !proventos || !evolucao) return <SkeletonPagina blocos={2} />;

  const ganhou = summary.lucroTotal >= 0;
  const proventosPorMes = agruparPorMes(proventos);
  const serieEvolucao = evolucao.map((p) => ({ ...p, rotulo: rotuloMes(p.mes) }));

  const rebal = calcularDesvios(metas, posicoes);
  const tipoPorTicker = new Map(posicoes.map((p) => [p.ticker, p.type]));
  const corDe = (ticker: string) => coresClasse[tipoPorTicker.get(ticker) ?? ""] ?? "#5d6b7f";

  // Mesmo limiar de formatarDesvio: abaixo de meio ponto é oscilação de cotação.
  const foraDaMeta = rebal.desvios
    .filter((d) => Math.abs(d.desvioPct) >= 0.5)
    .sort((a, b) => Math.abs(b.desvioPct) - Math.abs(a.desvioPct))
    .slice(0, 3);

  const chamada =
    metas.length === 0
      ? {
          texto: "Defina metas de alocação para ver o quanto a carteira saiu do lugar.",
          rotulo: "Definir metas",
        }
      : foraDaMeta.length === 0
        ? { texto: "Sua carteira está na meta.", rotulo: "Simular aporte" }
        : { texto: "Mais longe da meta", rotulo: "Simular aporte" };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Dashboard"
        descricao={`Visão geral da carteira, com ${summary.quantidadeAtivos} ${
          summary.quantidadeAtivos === 1 ? "ativo" : "ativos"
        }`}
        contexto={
          <Pilula>
            {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </Pilula>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Herói: o patrimônio e, logo abaixo, a distância até a meta.
            Única superfície primária da tela — daí o raio maior. */}
        <section
          data-superficie="navy"
          className="reveal col-span-12 flex flex-col rounded-2xl bg-ink p-6 text-white sm:p-7 xl:col-span-7"
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-slate-300">Patrimônio total</p>
            <span
              className={`tnum rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
                ganhou ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
              }`}
            >
              {pct(summary.lucroPct)}
            </span>
          </div>

          <p className="tnum mt-3 font-mono text-4xl font-bold tracking-tight sm:text-5xl">
            {brl(summary.patrimonioTotal)}
          </p>

          <dl className="mt-7 grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-300">Aplicado</dt>
              <dd className="tnum mt-0.5 font-mono text-sm font-semibold">
                {brl(summary.totalAplicado)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-300">Resultado</dt>
              <dd
                className={`tnum mt-0.5 font-mono text-sm font-semibold ${
                  ganhou ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {brl(summary.lucroTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-300">Proventos</dt>
              <dd className="tnum mt-0.5 font-mono text-sm font-semibold">
                {brl(summary.totalProventos)}
              </dd>
            </div>
          </dl>

          <div className="mt-7 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xs text-sm text-slate-200">{chamada.texto}</p>
              <Link
                href="/simulacao"
                className="rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                {chamada.rotulo}
              </Link>
            </div>
            {foraDaMeta.length > 0 && <MaisLongeDaMeta desvios={foraDaMeta} corDe={corDe} />}
          </div>
        </section>

        <CardAlocacao
          alocacao={summary.alocacaoPorClasse}
          posicoes={posicoes}
          quantidadeAtivos={summary.quantidadeAtivos}
        />

        {/* Evolução do patrimônio: valor aplicado + resultado, mês a mês */}
        <Card className="reveal reveal-3 col-span-12">
          <TituloCard
            acessorio={
              serieEvolucao.length > 0 ? (
                <span className="text-xs text-mute">
                  {serieEvolucao.length} {serieEvolucao.length === 1 ? "mês" : "meses"} de
                  histórico
                </span>
              ) : undefined
            }
          >
            Evolução do patrimônio
          </TituloCard>

          {serieEvolucao.length === 0 ? (
            <p className="mt-4 text-sm text-mute">
              Ainda não há histórico suficiente. O gráfico aparece a partir do primeiro mês
              fechado depois da sua primeira transação.
            </p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serieEvolucao} barSize={28}>
                  <XAxis
                    dataKey="rotulo"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#5d6b7f" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(14,27,51,0.04)" }}
                    formatter={(v, nome) => [
                      brl(Number(v)),
                      nome === "aplicado" ? "Aplicado" : "Resultado",
                    ]}
                    labelFormatter={(rotulo, item) => item[0]?.payload?.mes ?? rotulo}
                  />
                  {/* aplicado é sempre a base da pilha. Quando o resultado do mês é
                      negativo, o Recharts desenha o déficit como uma barra à parte
                      abaixo do zero, então o quadrado no topo do aplicado não
                      incomoda — não há nada "encaixando" ali naquele mês. */}
                  <Bar
                    dataKey="aplicado"
                    stackId="patrimonio"
                    fill="var(--color-mute-soft)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar dataKey="resultado" stackId="patrimonio" radius={[6, 6, 0, 0]}>
                    {serieEvolucao.map((p) => (
                      <Cell
                        key={p.mes}
                        fill={p.resultado >= 0 ? "var(--color-gain)" : "var(--color-loss)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-3 text-xs text-mute">
            Cinza é o quanto você aplicou; verde ou coral é o resultado acumulado naquele mês.
          </p>
        </Card>

        {/* Proventos mês a mês */}
        <Card className="reveal reveal-4 col-span-12">
          <TituloCard
            acessorio={
              <span className="tnum font-mono text-sm font-semibold text-gain-ink">
                {brl(summary.totalProventos)} no total
              </span>
            }
          >
            Proventos recebidos
          </TituloCard>

          {proventosPorMes.length === 0 ? (
            <p className="mt-4 text-sm text-mute">
              Nenhum provento registrado. Importe os proventos dos seus ativos na aba Carteira.
            </p>
          ) : (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proventosPorMes} barSize={38}>
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#5d6b7f" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(14,27,51,0.04)" }}
                    formatter={(v) => [brl(Number(v)), "Proventos"]}
                  />
                  <Bar dataKey="total" fill="var(--color-gain)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
