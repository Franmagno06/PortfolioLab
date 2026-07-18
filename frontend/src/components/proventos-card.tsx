"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { brl } from "@/lib/format";

type Provento = {
  id: string;
  amount: string; // Decimal chega como string no JSON
  paidAt: string;
  asset: { ticker: string; name: string };
};

type Props = { ativos: { ticker: string; name: string }[] };

const campo =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function ProventosCard({ ativos }: Props) {
  const [proventos, setProventos] = useState<Provento[] | null>(null);
  const [ticker, setTicker] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api<Provento[]>("/dividends").then(setProventos).catch(() => setProventos([]));
  }, []);

  useEffect(carregar, [carregar]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api("/dividends", {
        method: "POST",
        body: JSON.stringify({ ticker, amount: Number(amount), paidAt }),
      });
      setAmount("");
      carregar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao registrar provento");
    } finally {
      setSalvando(false);
    }
  }

  const total = (proventos ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <section className="reveal reveal-3 rounded-2xl border border-[--color-line] bg-white p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Proventos</h2>
        <span className="tnum font-mono text-sm font-semibold text-[#1e9e63]">
          {brl(total)} recebidos
        </span>
      </div>

      {/* registrar novo */}
      <form onSubmit={registrar} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">Ativo</span>
          <select required value={ticker} onChange={(e) => setTicker(e.target.value)} className={`${campo} w-full`}>
            <option value="">Selecione...</option>
            {ativos.map((a) => (
              <option key={a.ticker} value={a.ticker}>
                {a.ticker}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-28">
          <span className="mb-1 block text-xs font-medium text-slate-600">Valor (R$)</span>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${campo} tnum w-full text-right font-mono`}
          />
        </label>
        <label className="block w-36">
          <span className="mb-1 block text-xs font-medium text-slate-600">Data</span>
          <input
            type="date"
            required
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={`${campo} tnum w-full font-mono`}
          />
        </label>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60"
        >
          {salvando ? "..." : "Registrar"}
        </button>
      </form>

      {erro && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#d94f5c]">{erro}</p>
      )}

      {/* histórico */}
      {!proventos ? (
        <p className="mt-4 text-sm text-slate-500">Carregando...</p>
      ) : proventos.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhum provento registrado ainda.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[--color-line]">
          {proventos.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-20 font-mono font-semibold">{p.asset.ticker}</span>
              <span className="truncate text-slate-500">{p.asset.name}</span>
              <span className="tnum ml-auto font-mono font-semibold text-[#1e9e63]">
                {brl(Number(p.amount))}
              </span>
              <span className="tnum w-24 text-right font-mono text-xs text-slate-400">
                {new Date(p.paidAt).toLocaleDateString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
