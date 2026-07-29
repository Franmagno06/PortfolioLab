"use client";

import { useCallback, useEffect, useState } from "react";
import { NovaTransacao } from "@/components/nova-transacao";
import { ProventosCard } from "@/components/proventos-card";
import { api, ApiError } from "@/lib/api";
import { brl, coresClasse, nomesClasse, pct } from "@/lib/format";

type Posicao = {
  ticker: string;
  name: string;
  type: string;
  quantidade: number;
  precoMedio: number;
  precoAtual: number;
  valorAplicado: number;
  valorAtual: number;
  lucro: number;
  lucroPct: number;
};

type Ativo = { ticker: string; name: string };

export default function CarteiraPage() {
  const [ativos, setAtivos] = useState<Posicao[] | null>(null);
  const [disponiveis, setDisponiveis] = useState<Ativo[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    api<Posicao[]>("/portfolio")
      .then(setAtivos)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar a carteira"),
      );
  }, []);

  useEffect(() => {
    carregar();
    api<Ativo[]>("/assets").then(setDisponiveis).catch(() => setDisponiveis([]));
  }, [carregar]);

  if (erro) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-[#d94f5c]">{erro}</p>;
  }

  if (!ativos) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const patrimonio = ativos.reduce((s, a) => s + a.valorAtual, 0);
  const totalAplicado = ativos.reduce((s, a) => s + a.valorAplicado, 0);
  const lucroTotal = patrimonio - totalAplicado;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="reveal flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minha Carteira</h1>
          <p className="text-sm text-slate-500">
            Posição consolidada — derivada das suas transações
          </p>
        </div>
        <span className="tnum rounded-full border border-[--color-line] bg-white px-3 py-1 font-mono text-xs text-slate-500">
          {ativos.length} ativos · {brl(patrimonio)}
        </span>
      </header>

      <div className="reveal reveal-2">
        <NovaTransacao aoCriar={carregar} />
      </div>

      {ativos.length === 0 ? (
        <div className="reveal reveal-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-semibold">Sua carteira está vazia</p>
          <p className="mt-1 text-sm text-slate-500">
            Registre sua primeira compra no botão acima.
          </p>
        </div>
      ) : (
        <div className="reveal reveal-2 overflow-x-auto rounded-2xl border border-[--color-line] bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-[--color-line] text-left text-[11px] uppercase tracking-[0.12em] text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Ativo</th>
                <th className="px-3 py-3.5 font-semibold">Classe</th>
                <th className="px-3 py-3.5 text-right font-semibold">Qtd.</th>
                <th className="px-3 py-3.5 text-right font-semibold">Preço médio</th>
                <th className="px-3 py-3.5 text-right font-semibold">Preço atual</th>
                <th className="px-3 py-3.5 text-right font-semibold">Valor atual</th>
                <th className="px-3 py-3.5 text-right font-semibold">Resultado</th>
                <th className="px-5 py-3.5 text-right font-semibold">% carteira</th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((a) => {
                const cor = coresClasse[a.type] ?? "#64748b";
                const ganhou = a.lucro >= 0;
                const fatia = patrimonio === 0 ? 0 : (a.valorAtual / patrimonio) * 100;
                return (
                  <tr
                    key={a.ticker}
                    className="border-b border-[--color-line] last:border-0 hover:bg-[--color-paper]"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-mono font-semibold">{a.ticker}</p>
                      <p className="text-xs text-slate-500">{a.name}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ background: `${cor}1a`, color: cor }}
                      >
                        {nomesClasse[a.type] ?? a.type}
                      </span>
                    </td>
                    <td className="tnum px-3 py-3.5 text-right font-mono">{a.quantidade}</td>
                    <td className="tnum px-3 py-3.5 text-right font-mono text-slate-500">
                      {brl(a.precoMedio)}
                    </td>
                    <td className="tnum px-3 py-3.5 text-right font-mono">
                      {brl(a.precoAtual)}
                    </td>
                    <td className="tnum px-3 py-3.5 text-right font-mono font-semibold">
                      {brl(a.valorAtual)}
                    </td>
                    <td
                      className="tnum px-3 py-3.5 text-right font-mono font-semibold"
                      style={{ color: ganhou ? "#1e9e63" : "#d94f5c" }}
                    >
                      {brl(a.lucro)}
                      <span className="ml-1 text-xs opacity-80">({pct(a.lucroPct)})</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="grow-bar h-full rounded-full"
                            style={{ width: `${fatia}%`, background: cor }}
                          />
                        </div>
                        <span className="tnum w-12 text-right font-mono text-xs text-slate-500">
                          {fatia.toFixed(1).replace(".", ",")}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[--color-paper] text-[13px] font-semibold">
                <td className="px-5 py-3.5" colSpan={5}>
                  Total
                </td>
                <td className="tnum px-3 py-3.5 text-right font-mono">{brl(patrimonio)}</td>
                <td
                  className="tnum px-3 py-3.5 text-right font-mono"
                  style={{ color: lucroTotal >= 0 ? "#1e9e63" : "#d94f5c" }}
                >
                  {brl(lucroTotal)}
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ProventosCard ativos={disponiveis} />
    </div>
  );
}
