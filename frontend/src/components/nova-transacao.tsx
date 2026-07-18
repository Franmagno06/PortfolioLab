"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

type Props = {
  ativos: { ticker: string; name: string }[];
  aoCriar: () => void;
};

const campo =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function NovaTransacao({ ativos, aoCriar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [ticker, setTicker] = useState("");
  const [kind, setKind] = useState<"COMPRA" | "VENDA">("COMPRA");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fee, setFee] = useState("0");
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api("/transactions", {
        method: "POST",
        body: JSON.stringify({
          ticker,
          kind,
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
          fee: Number(fee) || 0,
          executedAt,
        }),
      });
      setAberto(false);
      setQuantity("");
      setUnitPrice("");
      aoCriar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao registrar");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg bg-[#0e1b33] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2f5c]"
      >
        + Nova transação
      </button>
    );
  }

  return (
    <form
      onSubmit={salvar}
      className="reveal w-full rounded-2xl border border-[--color-line] bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Registrar transação</h2>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          ✕ fechar
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Ativo</span>
          <select required value={ticker} onChange={(e) => setTicker(e.target.value)} className={campo}>
            <option value="">Selecione...</option>
            {ativos.map((a) => (
              <option key={a.ticker} value={a.ticker}>
                {a.ticker} — {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Tipo</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "COMPRA" | "VENDA")}
            className={campo}
          >
            <option value="COMPRA">Compra</option>
            <option value="VENDA">Venda</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Qtd.</span>
          <input
            type="number"
            required
            min="0.00000001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`${campo} tnum font-mono`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Preço (R$)</span>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className={`${campo} tnum font-mono`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Data</span>
          <input
            type="date"
            required
            value={executedAt}
            onChange={(e) => setExecutedAt(e.target.value)}
            className={`${campo} tnum font-mono`}
          />
        </label>
      </div>

      {erro && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#d94f5c]">{erro}</p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="mt-4 rounded-lg bg-[#0e1b33] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2f5c] disabled:opacity-60"
      >
        {salvando ? "Registrando..." : kind === "COMPRA" ? "Registrar compra" : "Registrar venda"}
      </button>
    </form>
  );
}
