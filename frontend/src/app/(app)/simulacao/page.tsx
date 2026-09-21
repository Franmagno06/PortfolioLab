"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo, estiloCampoCompacto } from "@/components/ui/campo";
import { Card, TituloCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconeCheck, IconeMais } from "@/components/ui/icones";
import { MensagemAviso, MensagemErro } from "@/components/ui/mensagem";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError } from "@/lib/api";
import { brl, coresClasse } from "@/lib/format";
import { somarMetas } from "@/lib/goals";
import { normalizarTicker, useBuscaTicker } from "@/lib/use-busca-ticker";

type Metas = {
  metas: { ticker: string; name: string; type: string; targetWeight: number }[];
  somaTotal: number;
};

type Simulacao = {
  valorAporte: number;
  patrimonioAtual: number;
  /** Patrimônio depois do aporte, contando só o que virou ativo. */
  patrimonioFinal: number;
  /** Base do cálculo do déficit: patrimônio mais o aporte inteiro. */
  patrimonioProjetado: number;
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
  /** Patrimônio dos ativos COM meta — o denominador da simulação. */
  patrimonioConsiderado: number;
  somaMetas: number;
  foraDaSimulacao: { valor: number; ativos: { ticker: string; valor: number }[] };
};

function umaCasa(valor: number) {
  return valor.toFixed(1).replace(".", ",");
}

function Resumo({ rotulo, valor, nota, destaque }: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <Card respiro="compacto">
      <p className="text-xs text-mute">{rotulo}</p>
      <p
        className={`tnum mt-1 font-mono text-lg font-bold ${destaque ? "text-gain-ink" : ""}`}
      >
        {valor}
      </p>
      {nota && <p className="mt-1 text-[11px] leading-relaxed text-mute">{nota}</p>}
    </Card>
  );
}

// useSearchParams suspende no carregamento da página (Next 16 só conhece a
// query string depois de hidratar) — isolar quem a lê num componente próprio
// deixa o resto da árvore livre pra ser pré-renderizado. Ver
// node_modules/next/dist/docs/.../use-search-params.md#prerendering.
export default function SimulacaoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl" />}>
      <SimulacaoConteudo />
    </Suspense>
  );
}

function SimulacaoConteudo() {
  const tickerFocado = useSearchParams().get("ticker");
  const [metas, setMetas] = useState<Metas | null>(null);
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const [novoTicker, setNovoTicker] = useState("");
  const [novoPct, setNovoPct] = useState("");
  const {
    cotacao: cotacaoNova,
    buscando: buscandoTicker,
    erro: erroBuscaTicker,
  } = useBuscaTicker(novoTicker);
  const [valor, setValor] = useState("1500");
  const [resultado, setResultado] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroMetas, setErroMetas] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tickerDestacado, setTickerDestacado] = useState<string | null>(null);
  const linhasMeta = useRef<Record<string, HTMLLIElement | null>>({});
  const inputNovoTicker = useRef<HTMLInputElement>(null);
  const aplicouFoco = useRef(false);

  const carregar = useCallback(async () => {
    const m = await api<Metas>("/goals");
    setMetas(m);
    setEdicao(
      Object.fromEntries(m.metas.map((meta) => [meta.ticker, String(meta.targetWeight)])),
    );
  }, []);

  useEffect(() => {
    // Carga inicial: setErro aqui trata a falha do fetch de metas no mount,
    // não é um efeito colateral de render — supressão intencional e escopada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar().catch(() => setErro("Falha ao carregar as metas"));
  }, [carregar]);

  useEffect(() => {
    // Chegada com ?ticker= (clique na fita de alocação do dashboard):
    // sincroniza a tela com a URL depois que as metas terminam de carregar.
    // Roda uma vez só (aplicouFoco) — sem o guard, toda vez que carregar()
    // troca a referência de `metas` (ex.: depois de salvar) o foco voltaria
    // a saltar para o mesmo ticker.
    if (!metas || aplicouFoco.current || !tickerFocado) return;
    aplicouFoco.current = true;
    const ticker = normalizarTicker(tickerFocado);
    const linha = linhasMeta.current[ticker];

    if (linha) {
      linha.scrollIntoView({ behavior: "smooth", block: "center" });
      setTickerDestacado(ticker);
      const desligar = setTimeout(() => setTickerDestacado(null), 2000);
      return () => clearTimeout(desligar);
    } else {
      // o ativo não tem meta ainda: pré-preenche o formulário de adicionar
      setNovoTicker(ticker);
      inputNovoTicker.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputNovoTicker.current?.focus();
    }
  }, [metas, tickerFocado]);

  const somaEditada = somarMetas(edicao);
  const jaTemMeta = metas?.metas.some((m) => m.ticker === novoTicker) ?? false;

  async function salvarMetas() {
    if (!metas || metas.metas.length === 0) return;
    setErroMetas(null);
    setSalvando(true);
    try {
      // Achado 11 da auditoria: uma chamada só, em vez de uma PUT /goals por
      // meta alterada — o laço anterior recusava o estado intermediário ao
      // trocar duas metas entre si (ex: 60%/10% → 10%/60%, que passa por
      // 120% no meio do caminho).
      await api("/goals/batch", {
        method: "PUT",
        body: JSON.stringify({
          metas: Object.entries(edicao).map(([ticker, valor]) => ({
            ticker,
            targetWeight: Number(valor),
          })),
        }),
      });
      await carregar();
    } catch (err) {
      setErroMetas(err instanceof ApiError ? err.message : "Falha ao salvar as metas");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarMeta() {
    if (!cotacaoNova || !novoPct) return;
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
      <PageHeader
        titulo="Simulação de aportes"
        descricao="Calcule onde investir para aproximar a carteira das suas metas"
      />

      <div className="grid grid-cols-12 items-start gap-6">
        {/* Coluna esquerda: aporte + metas */}
        <div className="col-span-12 space-y-6 lg:col-span-4">
          <Card>
            <form onSubmit={simular}>
              <TituloCard>Configurar aporte</TituloCard>
              <div className="mt-4">
                <Campo
                  rotulo="Valor do aporte (R$)"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="tnum font-mono"
                />
              </div>

              {erro && (
                <div className="mt-3">
                  <MensagemErro>{erro}</MensagemErro>
                </div>
              )}

              <Botao type="submit" tamanho="bloco" disabled={calculando} className="mt-4">
                {calculando ? "Calculando..." : "Calcular aporte"}
              </Botao>
            </form>
          </Card>

          <Card>
            <TituloCard
              acessorio={
                <span
                  className={`tnum font-mono text-xs font-semibold ${
                    somaEditada > 100 ? "text-loss-ink" : "text-mute"
                  }`}
                >
                  soma {umaCasa(somaEditada)}%
                </span>
              }
            >
              Metas de alocação
            </TituloCard>

            {!metas ? (
              <p className="mt-4 text-sm text-mute">Carregando...</p>
            ) : (
              <>
                {metas.metas.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {metas.metas.map((m) => (
                      <li
                        key={m.ticker}
                        ref={(el) => {
                          linhasMeta.current[m.ticker] = el;
                        }}
                        className={`-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                          tickerDestacado === m.ticker ? "bg-gain/10 ring-1 ring-gain-ink" : ""
                        }`}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: coresClasse[m.type] ?? "var(--color-mute)" }}
                        />
                        <label htmlFor={`meta-${m.ticker}`} className="font-mono text-sm font-semibold">
                          {m.ticker}
                        </label>
                        <input
                          id={`meta-${m.ticker}`}
                          type="number"
                          min="0.5"
                          max="100"
                          step="0.5"
                          value={edicao[m.ticker] ?? ""}
                          onChange={(e) =>
                            setEdicao((atual) => ({ ...atual, [m.ticker]: e.target.value }))
                          }
                          className={`${estiloCampoCompacto} tnum ml-auto w-20 text-right font-mono`}
                        />
                        <span className="text-xs text-mute">%</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Qualquer ticker da B3 — inclusive um que ainda não se possui,
                    que é justamente o de maior déficit no rebalanceamento */}
                <div
                  className={`space-y-2 ${
                    metas.metas.length > 0 ? "mt-3 border-t border-line pt-3" : "mt-4"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputNovoTicker}
                      type="text"
                      value={novoTicker}
                      onChange={(e) => setNovoTicker(normalizarTicker(e.target.value))}
                      placeholder="Adicionar meta: PETR4"
                      aria-label="Ticker da nova meta"
                      maxLength={6}
                      className={`${estiloCampoCompacto} min-w-0 flex-1 font-mono uppercase`}
                    />
                    <input
                      type="number"
                      placeholder="%"
                      aria-label="Percentual da nova meta"
                      value={novoPct}
                      onChange={(e) => setNovoPct(e.target.value)}
                      className={`${estiloCampoCompacto} tnum w-16 text-right font-mono`}
                    />
                    <button
                      type="button"
                      onClick={adicionarMeta}
                      disabled={!cotacaoNova || buscandoTicker || !novoPct}
                      aria-label="Adicionar meta"
                      className="rounded-lg border border-line p-2 transition-colors hover:bg-paper disabled:opacity-40"
                    >
                      <IconeMais />
                    </button>
                  </div>

                  {buscandoTicker && (
                    <p className="text-xs text-mute">Buscando {novoTicker} na B3...</p>
                  )}

                  {cotacaoNova && !buscandoTicker && (
                    <p className="flex flex-wrap items-center gap-2 rounded-lg bg-gain/7 px-2.5 py-1.5 text-xs">
                      <span className="flex items-center gap-1 font-semibold text-gain-ink">
                        <IconeCheck tamanho={12} />
                        {cotacaoNova.ticker}
                      </span>
                      <span className="text-ink-soft">{cotacaoNova.nome}</span>
                      <span className="tnum ml-auto font-mono text-mute">
                        {brl(cotacaoNova.preco)}
                      </span>
                    </p>
                  )}

                  {jaTemMeta && !buscandoTicker && (
                    <p className="text-xs text-mute">
                      {novoTicker} já tem meta. O valor acima substitui o atual.
                    </p>
                  )}

                  {erroBuscaTicker && !buscandoTicker && (
                    <MensagemAviso titulo={erroBuscaTicker} />
                  )}
                </div>

                {erroMetas && (
                  <div className="mt-3">
                    <MensagemErro>{erroMetas}</MensagemErro>
                  </div>
                )}

                {metas.metas.length > 0 && (
                  <Botao
                    type="button"
                    variante="secundario"
                    onClick={salvarMetas}
                    tamanho="bloco"
                    disabled={salvando}
                    className="mt-4"
                  >
                    {salvando ? "Salvando..." : "Salvar metas"}
                  </Botao>
                )}
              </>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">O que é rebalanceamento por aporte</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              Em vez de vender o que passou da meta, o que geraria imposto, o dinheiro novo vai
              para os ativos mais abaixo dela. Cada um recebe uma fatia proporcional ao próprio
              buraco, sempre em unidades inteiras.
            </p>
          </Card>
        </div>

        {/* Coluna direita: resultado */}
        <div className="col-span-12 lg:col-span-8">
          {!resultado ? (
            <EmptyState
              titulo="Configure o aporte e calcule"
              descricao="O resultado mostra o que comprar, quanto sobra e como a alocação fica depois."
            />
          ) : (
            <div className="reveal space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Resumo
                  rotulo="Total investido"
                  valor={brl(resultado.totalGasto)}
                  destaque
                />
                <Resumo rotulo="Sobra para o próximo" valor={brl(resultado.restante)} />
                <Resumo
                  rotulo="Patrimônio final"
                  valor={brl(resultado.patrimonioFinal)}
                  nota={
                    resultado.restante > 0
                      ? `só os ativos com meta — a sobra de ${brl(resultado.restante)} fica em caixa`
                      : "só os ativos com meta"
                  }
                />
              </div>

              {resultado.somaMetas < 100 && (
                <MensagemAviso
                  titulo={`Suas metas somam ${resultado.somaMetas.toFixed(0)}%, não 100%`}
                >
                  O aporte só é distribuído até onde as metas alcançam. Os{" "}
                  {(100 - resultado.somaMetas).toFixed(0)}% restantes não têm dono, e por isso
                  parte do dinheiro pode sobrar mesmo havendo ativo abaixo da meta.
                </MensagemAviso>
              )}

              {resultado.foraDaSimulacao.valor > 0 && (
                <Card respiro="compacto">
                  <p className="text-sm font-semibold">
                    {brl(resultado.foraDaSimulacao.valor)} fora desta simulação
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-mute">
                    Estes ativos estão na sua carteira mas não têm meta, então não entram nem
                    como destino do aporte nem no cálculo dos percentuais. Cadastre uma meta
                    para incluí-los.
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {resultado.foraDaSimulacao.ativos.map((a) => (
                      <li
                        key={a.ticker}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs"
                      >
                        <span className="font-mono font-semibold">{a.ticker}</span>{" "}
                        <span className="tnum text-mute">{brl(a.valor)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card>
                <TituloCard>O que comprar</TituloCard>
                {resultado.compras.length === 0 ? (
                  <p className="mt-3 text-sm text-mute">
                    Nenhuma compra sugerida. Ou o aporte não paga uma unidade do que está em
                    déficit, ou toda a carteira já está na meta.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-120 text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-mute">
                          <th scope="col" className="py-2.5 font-semibold">
                            Ativo
                          </th>
                          <th scope="col" className="py-2.5 text-right font-semibold">
                            Déficit
                          </th>
                          <th scope="col" className="py-2.5 text-right font-semibold">
                            Qtd.
                          </th>
                          <th scope="col" className="py-2.5 text-right font-semibold">
                            Preço
                          </th>
                          <th scope="col" className="py-2.5 text-right font-semibold">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.compras.map((c) => (
                          <tr key={c.ticker} className="border-b border-line last:border-0">
                            <td className="py-3 font-mono font-semibold">{c.ticker}</td>
                            <td className="tnum py-3 text-right font-mono text-loss-ink">
                              {brl(c.deficit)}
                            </td>
                            <td className="tnum py-3 text-right font-mono font-semibold">
                              {c.quantidade}
                            </td>
                            <td className="tnum py-3 text-right font-mono text-mute">
                              {brl(c.precoUnitario)}
                            </td>
                            <td className="tnum py-3 text-right font-mono font-semibold">
                              {brl(c.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <TituloCard>Antes e depois do aporte</TituloCard>
                <div className="mt-4 space-y-4">
                  {resultado.alocacao.map((a) => (
                    <div key={a.ticker}>
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                        <span className="font-mono font-semibold">{a.ticker}</span>
                        <span className="tnum font-mono text-xs text-mute">
                          {umaCasa(a.atualPct)}% vira{" "}
                          <span className="font-semibold text-gain-ink">
                            {umaCasa(a.aposAportePct)}%
                          </span>
                          , meta {umaCasa(a.alvoPct)}%
                        </span>
                      </div>
                      <div className="relative space-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-paper">
                          <div
                            className="h-full rounded-full bg-mute-soft"
                            style={{ width: `${Math.min(a.atualPct, 100)}%` }}
                          />
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-paper">
                          <div
                            className="grow-bar h-full rounded-full bg-gain"
                            style={{ width: `${Math.min(a.aposAportePct, 100)}%` }}
                          />
                        </div>
                        {/* marca da meta, atravessando as duas barras */}
                        <span
                          className="absolute -top-0.5 bottom-0.5 w-0.5 rounded bg-ink"
                          style={{ left: `${Math.min(a.alvoPct, 100)}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-mute">
                  A barra de cima é a alocação de hoje, a de baixo é como ela fica depois do
                  aporte. O traço vertical marca a meta.
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
