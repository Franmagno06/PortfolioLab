"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { brl, coresClasse, nomesClasse } from "@/lib/format";

type Metas = {
  metas: { ticker: string; name: string; type: string; targetWeight: number }[];
  somaTotal: number;
};

type Ativo = { ticker: string; name: string };

type Simulacao = {
  valorAporte: number;
  patrimonioAtual: number;
  patrimonioFinal: number;
  compras: {
    ticker: string;
    name: string;
    deficit: number;
    quantidade: number;
    precoUnitario: number;
    total: number;
  }[];
  totalGasto: number;
  restante: number;
  alocacao: { ticker: string; alvoPct: number; atualPct: number; aposAportePct: number }[];
};

const campo =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export default function SimulacaoPage() {
  const [metas, setMetas] = useState<Metas | null>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const [novoTicker, setNovoTicker] = useState("");
  const [novoPct, setNovoPct] = useState("");
  const [valor, setValor] = useState("1500");
  const [resultado, setResultado] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroMetas, setErroMetas] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [m, a] = await Promise.all([api<Metas>("/goals"), api<Ativo[]>("/assets")]);
    setMetas(m);
    setAtivos(a);
    setEdicao(
      Object.fromEntries(m.metas.map((meta) => [meta.ticker, String(meta.targetWeight)])),
    );
  }, []);

  useEffect(() => {
    carregar().catch(() => setErro("Falha ao carregar as metas"));
  }, [carregar]);

  const somaEditada = Object.values(edicao).reduce((s, v) => s + (Number(v) || 0), 0);
  const semMeta = ativos.filter((a) => metas && !metas.metas.some((m) => m.ticker === a.ticker));

  async function salvarMetas() {
    if (!metas) return;
    setErroMetas(null);
    setSalvando(true);
    try {
      for (const meta of metas.metas) {
        const novo = Number(edicao[meta.ticker]);
        if (novo !== meta.targetWeight) {
          await api("/goals", {
            method: "PUT",
            body: JSON.stringify({ ticker: meta.ticker, targetWeight: novo }),
          });
        }
      }
      await carregar();
    } catch (err) {
      setErroMetas(err instanceof ApiError ? err.message : "Falha ao salvar as metas");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarMeta() {
    if (!novoTicker || !novoPct) return;
    setErroMetas(null);
    try {
      await api("/goals", {
        method: "PUT",
        body: JSON.stringify({ ticker: novoTicker, targetWeight: Number(novoPct) }),
      });
      setNovoTicker("");
      setNovoPct("");
      await carregar();
    } catch (err) {
      setErroMetas(err instanceof ApiError ? err.message : "Falha ao adicionar a meta");
    }
  }

  async function simular(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCalculando(true);
    try {
      const r = await api<Simulacao>("/rebalance/simulate", {
        method: "POST",
        body: JSON.stringify({ amount: Number(valor) }),
      });
      setResultado(r);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao simular");
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="reveal">
        <h1 className="text-2xl font-bold tracking-tight">Simulação de Aportes</h1>
        <p className="text-sm text-slate-500">
          Calcule onde investir para rebalancear sua carteira
        </p>
      </header>

      <div className="grid grid-cols-12 items-start gap-6">
        {/* Coluna esquerda: aporte + metas */}
        <div className="col-span-12 space-y-6 lg:col-span-4">
          <form
            onSubmit={simular}
            className="reveal reveal-2 rounded-2xl border border-[--color-line] bg-white p-6"
          >
            <h2 className="font-semibold">Configurar aporte</h2>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Valor do aporte (R$)
              </span>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={`${campo} tnum font-mono`}
              />
            </label>

            {erro && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#d94f5c]">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={calculando}
              className="mt-4 w-full rounded-lg bg-[#0e1b33] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2f5c] disabled:opacity-60"
            >
              {calculando ? "Calculando..." : "Calcular aporte"}
            </button>
          </form>

          <section className="reveal reveal-3 rounded-2xl border border-[--color-line] bg-white p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Metas de alocação</h2>
              <span
                className={`tnum font-mono text-xs font-semibold ${
                  somaEditada > 100 ? "text-[#d94f5c]" : "text-slate-500"
                }`}
              >
                soma: {somaEditada.toFixed(1).replace(".", ",")}%
              </span>
            </div>

            {!metas ? (
              <p className="mt-4 text-sm text-slate-500">Carregando...</p>
            ) : (
              <>
                <ul className="mt-4 space-y-2">
                  {metas.metas.map((m) => (
                    <li key={m.ticker} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: coresClasse[m.type] ?? "#94a3b8" }}
                      />
                      <span className="w-20 font-mono text-sm font-semibold">{m.ticker}</span>
                      <input
                        type="number"
                        min="0.5"
                        max="100"
                        step="0.5"
                        value={edicao[m.ticker] ?? ""}
                        onChange={(e) =>
                          setEdicao((atual) => ({ ...atual, [m.ticker]: e.target.value }))
                        }
                        className="tnum ml-auto w-20 rounded-lg border border-slate-300 px-2 py-1 text-right font-mono text-sm outline-none focus:border-emerald-600"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </li>
                  ))}
                </ul>

                {semMeta.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 border-t border-[--color-line] pt-3">
                    <select
                      value={novoTicker}
                      onChange={(e) => setNovoTicker(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none"
                    >
                      <option value="">Adicionar meta...</option>
                      {semMeta.map((a) => (
                        <option key={a.ticker} value={a.ticker}>
                          {a.ticker}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="%"
                      value={novoPct}
                      onChange={(e) => setNovoPct(e.target.value)}
                      className="tnum w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-right font-mono text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={adicionarMeta}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-semibold hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                )}

                {erroMetas && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#d94f5c]">
                    {erroMetas}
                  </p>
                )}

                <button
                  type="button"
                  onClick={salvarMetas}
                  disabled={salvando}
                  className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {salvando ? "Salvando..." : "Salvar metas"}
                </button>
              </>
            )}
          </section>

          <aside className="reveal reveal-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              💡 O que é rebalanceamento?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Em vez de vender o que passou da meta (gerando impostos), o aporte novo vai
              para os ativos mais abaixo dela. O algoritmo ataca sempre o maior déficit
              primeiro, comprando unidades inteiras.
            </p>
          </aside>
        </div>

        {/* Coluna direita: resultado */}
        <div className="col-span-12 lg:col-span-8">
          {!resultado ? (
            <div className="reveal reveal-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-14 text-center">
              <p className="font-semibold">Configure o aporte e clique em Calcular</p>
              <p className="mt-1 text-sm text-slate-500">
                O resultado mostra o que comprar, quanto sobra e como fica a alocação.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="reveal grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[--color-line] bg-white p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Total investido
                  </p>
                  <p className="tnum mt-1 font-mono text-lg font-bold text-[#1e9e63]">
                    {brl(resultado.totalGasto)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[--color-line] bg-white p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Sobra para o próximo
                  </p>
                  <p className="tnum mt-1 font-mono text-lg font-bold">
                    {brl(resultado.restante)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[--color-line] bg-white p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Patrimônio final
                  </p>
                  <p className="tnum mt-1 font-mono text-lg font-bold">
                    {brl(resultado.patrimonioFinal)}
                  </p>
                </div>
              </div>

              <section className="reveal reveal-2 rounded-2xl border border-[--color-line] bg-white p-6">
                <h2 className="font-semibold">O que comprar</h2>
                {resultado.compras.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhuma compra sugerida — ou o aporte não paga 1 unidade do que está em
                    déficit, ou toda a carteira já está na meta.
                  </p>
                ) : (
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-[--color-line] text-left text-[11px] uppercase tracking-[0.12em] text-slate-400">
                        <th className="py-2.5 font-semibold">Ativo</th>
                        <th className="py-2.5 text-right font-semibold">Déficit</th>
                        <th className="py-2.5 text-right font-semibold">Qtd.</th>
                        <th className="py-2.5 text-right font-semibold">Preço</th>
                        <th className="py-2.5 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.compras.map((c, i) => (
                        <tr key={c.ticker} className="border-b border-[--color-line] last:border-0">
                          <td className="py-3">
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0e1b33] font-mono text-[10px] font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="font-mono font-semibold">{c.ticker}</span>
                          </td>
                          <td className="tnum py-3 text-right font-mono text-[#d94f5c]">
                            {brl(c.deficit)}
                          </td>
                          <td className="tnum py-3 text-right font-mono font-semibold">
                            {c.quantidade}
                          </td>
                          <td className="tnum py-3 text-right font-mono text-slate-500">
                            {brl(c.precoUnitario)}
                          </td>
                          <td className="tnum py-3 text-right font-mono font-semibold">
                            {brl(c.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="reveal reveal-3 rounded-2xl border border-[--color-line] bg-white p-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-semibold">Antes vs. depois do aporte</h2>
                  <p className="text-xs text-slate-400">▪ meta</p>
                </div>
                <div className="mt-4 space-y-4">
                  {resultado.alocacao.map((a) => (
                    <div key={a.ticker}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-mono font-semibold">{a.ticker}</span>
                        <span className="tnum font-mono text-xs text-slate-500">
                          {a.atualPct.toFixed(1).replace(".", ",")}% →{" "}
                          <span className="font-semibold text-[#1e9e63]">
                            {a.aposAportePct.toFixed(1).replace(".", ",")}%
                          </span>{" "}
                          · meta {a.alvoPct.toFixed(1).replace(".", ",")}%
                        </span>
                      </div>
                      <div className="relative space-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-400"
                            style={{ width: `${Math.min(a.atualPct, 100)}%` }}
                          />
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="grow-bar h-full rounded-full bg-[#1e9e63]"
                            style={{ width: `${Math.min(a.aposAportePct, 100)}%` }}
                          />
                        </div>
                        <span
                          className="absolute -top-0.5 bottom-0.5 w-[2px] rounded bg-[#0e1b33]"
                          style={{ left: `${Math.min(a.alvoPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
