"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { brl, nomesClasse } from "@/lib/format";
import { normalizarTicker, useBuscaTicker } from "@/lib/use-busca-ticker";

type Props = { aoCriar: () => void };

const campo =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function NovaTransacao({ aoCriar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [ticker, setTicker] = useState("");
  const { cotacao, buscando, erro: erroTicker } = useBuscaTicker(ticker);

  const [kind, setKind] = useState<"COMPRA" | "VENDA">("COMPRA");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [precoEditado, setPrecoEditado] = useState(false);
  const [fee] = useState("0");
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Sugere o preço de mercado, mas sem sobrescrever o que o usuário já tiver
  // digitado (a compra pode ter sido em outra data). Derivado, não copiado:
  // enquanto ninguém editou o campo, ele espelha a cotação.
  const preco = precoEditado ? unitPrice : cotacao ? String(cotacao.preco) : "";

  function fechar() {
    setAberto(false);
    setTicker("");
    setQuantity("");
    setUnitPrice("");
    setPrecoEditado(false);
    setErro(null);
  }

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
          unitPrice: Number(preco),
          fee: Number(fee) || 0,
          executedAt,
        }),
      });
      fechar();
      aoCriar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao registrar");
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
          onClick={fechar}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          ✕ fechar
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Ativo <span className="font-normal text-slate-400">(qualquer ação ou FII da B3)</span>
          </span>
          <input
            type="text"
            required
            value={ticker}
            onChange={(e) => setTicker(normalizarTicker(e.target.value))}
            placeholder="Ex: PETR4, MXRF11, WEGE3"
            maxLength={6}
            autoFocus
            className={`${campo} font-mono uppercase`}
          />
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
            value={preco}
            onChange={(e) => {
              setUnitPrice(e.target.value);
              setPrecoEditado(true);
            }}
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

      {/* confirmação do ativo encontrado */}
      {buscando && <p className="mt-3 text-sm text-slate-400">Buscando {ticker} na B3...</p>}

      {cotacao && !buscando && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#1e9e63]/[0.06] px-3 py-2 text-sm">
          <span className="font-semibold text-[#1e9e63]">✓ {cotacao.ticker}</span>
          <span className="text-slate-700">{cotacao.nome}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            {nomesClasse[cotacao.tipo] ?? cotacao.tipo}
          </span>
          <span className="tnum ml-auto font-mono text-xs text-slate-500">
            cotação hoje: {brl(cotacao.preco)}
          </span>
        </div>
      )}

      {erroTicker && !buscando && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {erroTicker}
        </p>
      )}

      {erro && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#d94f5c]">{erro}</p>
      )}

      <button
        type="submit"
        disabled={salvando || buscando}
        className="mt-4 rounded-lg bg-[#0e1b33] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2f5c] disabled:opacity-60"
      >
        {salvando ? "Registrando..." : kind === "COMPRA" ? "Registrar compra" : "Registrar venda"}
      </button>
    </form>
  );
}
