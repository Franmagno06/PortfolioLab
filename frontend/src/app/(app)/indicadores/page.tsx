"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { indicadorOuTraco, pctIndicadorOuTraco, tempoRelativo } from "@/lib/format";

type IndicadorDeAtivo = {
  ticker: string;
  name: string;
  pl: number | null;
  pvp: number | null;
  dividendYield: number | null;
  roe: number | null;
  roa: number | null;
  margemLiquida: number | null;
  /** true = a última coluna mostra ROA no lugar de margem líquida (padrão de mercado para bancos). */
  setorBancario: boolean;
  atualizadoEm: string | null;
};

export default function IndicadoresPage() {
  const [indicadores, setIndicadores] = useState<IndicadorDeAtivo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<IndicadorDeAtivo[]>("/indicators")
      .then(setIndicadores)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar os indicadores"),
      );
  }, []);

  if (erro) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-loss">{erro}</p>;
  }

  if (!indicadores) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const maisRecente = indicadores.reduce<string | null>((acc, i) => {
    if (!i.atualizadoEm) return acc;
    if (!acc || i.atualizadoEm > acc) return i.atualizadoEm;
    return acc;
  }, null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="reveal flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indicadores</h1>
          <p className="text-sm text-slate-500">
            P/L, P/VP, Dividend Yield, ROE e margem líquida das ações da sua carteira
          </p>
        </div>
        {maisRecente && (
          <span className="tnum rounded-full border border-[--color-line] bg-white px-3 py-1 font-mono text-xs text-slate-500">
            Atualizado {tempoRelativo(maisRecente)}
          </span>
        )}
      </header>

      {indicadores.length === 0 ? (
        <div className="reveal reveal-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-semibold">Nenhuma ação na carteira</p>
          <p className="mt-1 text-sm text-slate-500">
            Indicadores fundamentalistas só existem para ações — registre uma compra na aba
            Carteira.
          </p>
        </div>
      ) : (
        <div className="reveal reveal-2 overflow-x-auto rounded-2xl border border-[--color-line] bg-white">
          <table className="w-full min-w-190 text-sm">
            <thead>
              <tr className="border-b border-[--color-line] text-left text-[11px] uppercase tracking-[0.12em] text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Ativo</th>
                <th className="px-3 py-3.5 text-right font-semibold">P/L</th>
                <th className="px-3 py-3.5 text-right font-semibold">P/VP</th>
                <th className="px-3 py-3.5 text-right font-semibold">Dividend Yield</th>
                <th className="px-3 py-3.5 text-right font-semibold">ROE</th>
                <th className="px-5 py-3.5 text-right font-semibold">Margem líquida</th>
              </tr>
            </thead>
            <tbody>
              {indicadores.map((i) => (
                <tr
                  key={i.ticker}
                  className="border-b border-[--color-line] last:border-0 hover:bg-[--color-paper]"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-mono font-semibold">{i.ticker}</p>
                    <p className="text-xs text-slate-500">{i.name}</p>
                  </td>
                  <td className="tnum px-3 py-3.5 text-right font-mono">
                    {indicadorOuTraco(i.pl)}
                  </td>
                  <td className="tnum px-3 py-3.5 text-right font-mono">
                    {indicadorOuTraco(i.pvp)}
                  </td>
                  <td className="tnum px-3 py-3.5 text-right font-mono">
                    {pctIndicadorOuTraco(i.dividendYield)}
                  </td>
                  <td className="tnum px-3 py-3.5 text-right font-mono">
                    {pctIndicadorOuTraco(i.roe)}
                  </td>
                  <td className="tnum px-5 py-3.5 text-right font-mono">
                    {pctIndicadorOuTraco(i.setorBancario ? i.roa : i.margemLiquida)}
                    {i.setorBancario && (
                      <span className="ml-1 text-[10px] font-sans font-normal uppercase tracking-wide text-slate-400">
                        ROA
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
