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
import { calcularDesvios, type DesvioDeMeta } from "@/lib/goals";

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

/**
 * Fita de alocação: cada segmento é a fatia REAL de um ativo, cada marca acima
 * é onde a meta dele termina. Meta cumprida = marca no fim do segmento.
 *
 * É o gesto central do produto — "o quanto a carteira saiu do lugar" — em uma
 * linha só, sem repetir as barras da tela de simulação.
 */
function FitaDeAlocacao({
  desvios,
  corDe,
}: {
  desvios: DesvioDeMeta[];
  corDe: (ticker: string) => string;
}) {
  // Soma das metas ate cada ativo, sem reatribuir nada de fora do map: a
  // marca do segmento e o ponto da fita onde a meta dele termina.
  const segmentos = desvios.map((d, i) => ({
    ...d,
    marca: desvios.slice(0, i + 1).reduce((soma, x) => soma + x.alvoPct, 0),
  }));

  return (
    <div className="relative h-6" aria-hidden>
      <div className="absolute inset-x-0 top-2.5 flex h-2 overflow-hidden rounded-full bg-white/10">
        {segmentos.map((s) => (
          <span
            key={s.ticker}
            className="h-full"
            style={{ width: `${s.atualPct}%`, background: corDe(s.ticker) }}
          />
        ))}
      </div>
      {segmentos.map((s) => (
        <span
          key={s.ticker}
          className="absolute top-0.5 h-5 w-px -translate-x-1/2 bg-white/70"
          style={{ left: `${Math.min(s.marca, 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [proventos, setProventos] = useState<Provento[] | null>(null);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [metas, setMetas] = useState<Metas["metas"]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Summary>("/portfolio/summary"),
      api<Pagina<Provento>>("/dividends"),
      api<Posicao[]>("/portfolio"),
      api<Metas>("/goals"),
    ])
      .then(([s, p, pos, m]) => {
        setSummary(s);
        setProventos(p.itens);
        setPosicoes(pos);
        setMetas(m.metas);
      })
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar os dados"),
      );
  }, []);

  if (erro) return <MensagemErro>{erro}</MensagemErro>;
  if (!summary || !proventos) return <SkeletonPagina blocos={2} />;

  const ganhou = summary.lucroTotal >= 0;
  const proventosPorMes = agruparPorMes(proventos);
  const dadosDonut = summary.alocacaoPorClasse.map((a) => ({
    name: nomesClasse[a.classe] ?? a.classe,
    value: a.valor,
    cor: coresClasse[a.classe] ?? "#5d6b7f",
    pct: a.percentual,
  }));

  const rebal = calcularDesvios(metas, posicoes);
  const tipoPorTicker = new Map(posicoes.map((p) => [p.ticker, p.type]));
  const corDe = (ticker: string) => coresClasse[tipoPorTicker.get(ticker) ?? ""] ?? "#5d6b7f";

  // Uma frase só: o que a carteira pede agora. Abaixo de meio ponto percentual
  // não vale mandar ninguém aportar — nessa faixa o desvio é oscilação de cotação.
  const temFita = rebal.desvios.length > 0 && rebal.patrimonioConsiderado > 0;
  const naMeta = rebal.maiorDesvioPct < 0.5;
  const chamada =
    metas.length === 0
      ? {
          texto: "Defina metas de alocação para ver o quanto a carteira saiu do lugar.",
          rotulo: "Definir metas",
        }
      : naMeta
        ? { texto: "Sua carteira está na meta.", rotulo: "Simular aporte" }
        : {
            texto: `${rebal.maiorDeficit?.ticker ?? "Um ativo"} está ${Math.abs(
              rebal.maiorDeficit?.desvioPct ?? 0,
            )
              .toFixed(1)
              .replace(".", ",")} pontos abaixo da meta.`,
            rotulo: "Simular aporte",
          };

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
            {temFita && <FitaDeAlocacao desvios={rebal.desvios} corDe={corDe} />}
            <div
              className={`flex flex-wrap items-center justify-between gap-3 ${
                temFita ? "mt-3" : ""
              }`}
            >
              <p className="max-w-xs text-sm text-slate-200">{chamada.texto}</p>
              <Link
                href="/simulacao"
                className="rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                {chamada.rotulo}
              </Link>
            </div>
          </div>
        </section>

        {/* Alocação por classe */}
        <Card className="reveal reveal-2 col-span-12 xl:col-span-5">
          <TituloCard>Alocação por classe</TituloCard>

          {dadosDonut.length === 0 ? (
            <p className="mt-4 text-sm text-mute">
              Carteira vazia. Registre uma transação para ver a distribuição.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-2">
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosDonut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {dadosDonut.map((d) => (
                        <Cell key={d.name} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => brl(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="tnum font-mono text-lg font-bold">
                    {summary.quantidadeAtivos}
                  </span>
                  <span className="text-[11px] text-mute">
                    {summary.quantidadeAtivos === 1 ? "ativo" : "ativos"}
                  </span>
                </div>
              </div>

              <ul className="min-w-0 flex-1 space-y-2.5">
                {dadosDonut.map((d) => (
                  <li key={d.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: d.cor }}
                    />
                    <span className="truncate">{d.name}</span>
                    <span className="tnum ml-auto font-mono text-xs font-semibold text-mute">
                      {d.pct.toFixed(1).replace(".", ",")}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Proventos mês a mês */}
        <Card className="reveal reveal-3 col-span-12">
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
