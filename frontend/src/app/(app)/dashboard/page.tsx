"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type Summary = {
  patrimonioTotal: number;
  totalAplicado: number;
  lucroTotal: number;
  lucroPct: number;
  totalProventos: number;
  quantidadeAtivos: number;
  alocacaoPorClasse: { classe: string; valor: number; percentual: number }[];
};

const nomesClasse: Record<string, string> = {
  ACAO: "Ações",
  FII: "FIIs",
  ETF: "ETFs",
  RENDA_FIXA: "Renda Fixa",
};

const coresClasse: Record<string, string> = {
  ACAO: "bg-green-600",
  FII: "bg-blue-600",
  ETF: "bg-orange-500",
  RENDA_FIXA: "bg-violet-600",
};

function brl(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/portfolio/summary")
      .then(setSummary)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar os dados"),
      );
  }, []);

  if (erro) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-red-600">{erro}</p>;
  }

  if (!summary) {
    return <p className="text-slate-500">Carregando sua carteira...</p>;
  }

  const lucroPositivo = summary.lucroTotal >= 0;

  const cartoes = [
    { rotulo: "Patrimônio Total", valor: brl(summary.patrimonioTotal), cor: "border-blue-600" },
    { rotulo: "Total Aplicado", valor: brl(summary.totalAplicado), cor: "border-slate-400" },
    {
      rotulo: "Lucro / Prejuízo",
      valor: `${brl(summary.lucroTotal)} (${summary.lucroPct.toFixed(1)}%)`,
      cor: lucroPositivo ? "border-green-600" : "border-red-600",
      texto: lucroPositivo ? "text-green-700" : "text-red-600",
    },
    { rotulo: "Proventos Recebidos", valor: brl(summary.totalProventos), cor: "border-violet-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Visão geral da sua carteira — {summary.quantidadeAtivos} ativo(s)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c) => (
          <div
            key={c.rotulo}
            className={`rounded-xl border-l-4 bg-white p-5 shadow-sm ${c.cor}`}
          >
            <p className="text-xs text-slate-500">{c.rotulo}</p>
            <p className={`mt-1 text-xl font-bold ${c.texto ?? ""}`}>{c.valor}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Distribuição da Carteira</h2>
        <p className="mb-4 text-sm text-slate-500">Alocação atual por classe de ativo</p>

        {summary.alocacaoPorClasse.length === 0 ? (
          <p className="text-sm text-slate-500">
            Sua carteira está vazia. Registre transações para vê-la aqui.
          </p>
        ) : (
          <div className="space-y-3">
            {summary.alocacaoPorClasse.map((a) => (
              <div key={a.classe}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{nomesClasse[a.classe] ?? a.classe}</span>
                  <span className="text-slate-500">
                    {brl(a.valor)} · {a.percentual.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${coresClasse[a.classe] ?? "bg-slate-400"}`}
                    style={{ width: `${a.percentual}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
