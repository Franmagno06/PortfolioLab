"use client";

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
import { api, ApiError } from "@/lib/api";
import { brl, coresClasse, nomesClasse, pct } from "@/lib/format";

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

function agruparPorMes(proventos: Provento[]) {
  const porMes = new Map<string, { rotulo: string; total: number }>();
  for (const p of proventos) {
    const data = new Date(p.paidAt);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    const rotulo = data
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "");
    const atual = porMes.get(chave) ?? { rotulo, total: 0 };
    atual.total += Number(p.amount);
    porMes.set(chave, atual);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ mes: v.rotulo, total: Number(v.total.toFixed(2)) }));
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [proventos, setProventos] = useState<Provento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Summary>("/portfolio/summary"), api<Provento[]>("/dividends")])
      .then(([s, p]) => {
        setSummary(s);
        setProventos(p);
      })
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar os dados"),
      );
  }, []);

  if (erro) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-[--color-loss]">{erro}</p>;
  }

  if (!summary || !proventos) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const ganhou = summary.lucroTotal >= 0;
  const proventosPorMes = agruparPorMes(proventos);
  const dadosDonut = summary.alocacaoPorClasse.map((a) => ({
    name: nomesClasse[a.classe] ?? a.classe,
    value: a.valor,
    cor: coresClasse[a.classe] ?? "#94a3b8",
    pct: a.percentual,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="reveal flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Visão geral da carteira · {summary.quantidadeAtivos} ativos
          </p>
        </div>
        <span className="rounded-full border border-[--color-line] bg-white px-3 py-1 font-mono text-xs text-slate-500">
          {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </span>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Hero: o número que importa, em destaque editorial */}
        <section
          className="reveal reveal-2 col-span-12 flex flex-col justify-between rounded-2xl p-7 text-white xl:col-span-7"
          style={{ background: "linear-gradient(135deg, #0e1b33 0%, #1a2f5c 100%)" }}
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Patrimônio total
            </p>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
                ganhou ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
              }`}
            >
              {pct(summary.lucroPct)}
            </span>
          </div>

          <p className="tnum mt-4 font-mono text-4xl font-bold tracking-tight sm:text-5xl">
            {brl(summary.patrimonioTotal)}
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Aplicado</p>
              <p className="tnum mt-1 font-mono text-sm font-semibold">
                {brl(summary.totalAplicado)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Resultado</p>
              <p
                className={`tnum mt-1 font-mono text-sm font-semibold ${
                  ganhou ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {brl(summary.lucroTotal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Proventos</p>
              <p className="tnum mt-1 font-mono text-sm font-semibold">
                {brl(summary.totalProventos)}
              </p>
            </div>
          </div>
        </section>

        {/* Donut de alocação */}
        <section className="reveal reveal-3 col-span-12 rounded-2xl border border-[--color-line] bg-white p-6 xl:col-span-5">
          <h2 className="font-semibold">Alocação por classe</h2>

          {dadosDonut.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Carteira vazia — registre transações para ver a distribuição.
            </p>
          ) : (
            <div className="mt-2 flex items-center gap-2">
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
                  <span className="font-mono text-lg font-bold">
                    {summary.quantidadeAtivos}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    ativos
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
                    <span className="tnum ml-auto font-mono text-xs font-semibold text-slate-500">
                      {d.pct.toFixed(1).replace(".", ",")}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Proventos mês a mês */}
        <section className="reveal reveal-4 col-span-12 rounded-2xl border border-[--color-line] bg-white p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Proventos recebidos</h2>
            <span className="tnum font-mono text-sm font-semibold text-[--color-gain]">
              {brl(summary.totalProventos)} no total
            </span>
          </div>

          {proventosPorMes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Nenhum provento registrado ainda.
            </p>
          ) : (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proventosPorMes} barSize={38}>
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(14,27,51,0.04)" }}
                    formatter={(v) => [brl(Number(v)), "Proventos"]}
                  />
                  <Bar dataKey="total" fill="#1e9e63" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
