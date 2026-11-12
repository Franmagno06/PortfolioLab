"use client";

import { useCallback, useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campo";
import { Card, TituloCard } from "@/components/ui/card";
import { MensagemErro } from "@/components/ui/mensagem";
import { api, ApiError, type Pagina } from "@/lib/api";
import { brl, dataCurta } from "@/lib/format";

type Provento = {
  id: string;
  amount: string; // Decimal chega como string no JSON
  unitAmount: string | null;
  paidAt: string;
  source: "MANUAL" | "PROVEDOR";
  asset: { ticker: string; name: string };
};

type Props = { ativos: { ticker: string; name: string }[] };

export function ProventosCard({ ativos }: Props) {
  const [proventos, setProventos] = useState<Provento[] | null>(null);
  const [ticker, setTicker] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toLocaleDateString("sv-SE"));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [manual, setManual] = useState(false);

  const carregar = useCallback(() => {
    api<Pagina<Provento>>("/dividends")
      .then(({ itens }) => setProventos(itens))
      .catch(() => setProventos([]));

    // A lista vem paginada, então somar o que está na tela daria menos do que
    // o recebido de verdade. O total sai do resumo da carteira, que soma tudo.
    api<{ totalProventos: number }>("/portfolio/summary")
      .then((s) => setTotal(s.totalProventos))
      .catch(() => setTotal(null));
  }, []);

  useEffect(carregar, [carregar]);

  // A importação é POST explícito, não efeito do GET: o backend recusa gravar
  // no meio de uma leitura. Quem quiser proventos novos pede.
  async function sincronizar() {
    setErro(null);
    setSincronizando(true);
    try {
      await api("/dividends/sync", { method: "POST" });
      carregar();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao buscar os proventos");
    } finally {
      setSincronizando(false);
    }
  }

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

  return (
    <Card>
      <TituloCard
        acessorio={
          <div className="flex items-center gap-3">
            <span className="tnum text-sm font-semibold text-gain-ink">
              {total === null ? "—" : `${brl(total)} no total`}
            </span>
            <Botao
              type="button"
              variante="secundario"
              tamanho="sm"
              className="min-h-11"
              onClick={sincronizar}
              disabled={sincronizando}
            >
              {sincronizando ? "Buscando…" : "Buscar proventos"}
            </Botao>
          </div>
        }
      >
        Proventos
      </TituloCard>

      <p className="mt-1 max-w-prose text-xs text-mute">
        Os proventos dos seus ativos são importados do Yahoo Finance e calculados sobre a
        quantidade que você tinha no fim do dia anterior à data-ex. Use o lançamento manual só
        para o que a fonte não cobre.
      </p>
      <p className="mt-1 max-w-prose text-xs text-mute">
        Os valores importados são brutos, como a fonte informa, antes de imposto (o JCP ainda tem
        IR a descontar), e a data deles é a data-ex, não a do pagamento, que pode ser depois. Os
        que você lança à mão valem como você informou. Se lançar à mão um provento que a busca
        também traz, ele soma duas vezes: apague um dos dois.
      </p>
      <p className="mt-1 max-w-prose text-xs text-mute">
        Se um ativo seu teve desdobramento, grupamento ou bonificação, a quantidade e os valores
        por cota podem não bater: confira com o informe de rendimentos da corretora.
      </p>

      {/* registrar novo — recolhido, porque o caminho normal é a importação */}
      <button
        type="button"
        onClick={() => setManual((v) => !v)}
        aria-expanded={manual}
        className="toque mt-2 inline-flex min-h-11 touch-manipulation items-center rounded text-xs font-semibold text-mute underline-offset-2 hover:underline focus-visible:underline"
      >
        {manual ? "Esconder lançamento manual" : "Lançar um provento à mão"}
      </button>

      <form onSubmit={registrar} hidden={!manual} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Selecao
            rotulo="Ativo"
            required
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          >
            <option value="">Selecione...</option>
            {ativos.map((a) => (
              <option key={a.ticker} value={a.ticker}>
                {a.ticker}
              </option>
            ))}
          </Selecao>
        </div>
        <div className="w-28">
          <Campo
            rotulo="Valor (R$)"
            type="number"
            required
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum text-right"
          />
        </div>
        <div className="w-36">
          <Campo
            rotulo="Data"
            type="date"
            required
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="tnum"
          />
        </div>
        <Botao type="submit" variante="secundario" className="min-h-11" disabled={salvando}>
          {salvando ? "Registrando…" : "Registrar"}
        </Botao>
      </form>

      {erro && (
        <div className="mt-3">
          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}

      {/* histórico */}
      {!proventos ? (
        <p className="mt-4 text-sm text-mute">Carregando...</p>
      ) : proventos.length === 0 ? (
        <p className="mt-4 text-sm text-mute">
          Nenhum provento registrado. Use Buscar proventos para importar do Yahoo Finance.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {proventos.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-20 shrink-0 tnum font-semibold">{p.asset.ticker}</span>
              {p.source === "MANUAL" && (
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mute">
                  manual
                </span>
              )}
              <span className="truncate text-mute">
                {p.unitAmount ? `${brl(Number(p.unitAmount))} por cota` : p.asset.name}
              </span>
              <span className="tnum ml-auto font-semibold text-gain-ink">
                {brl(Number(p.amount))}
                <span className="sr-only">{p.source === "PROVEDOR" ? " bruto" : " como você informou"}</span>
              </span>
              {/* o dia sai do texto ISO, não do fuso do navegador: o lançamento manual é
                  meia-noite UTC e, lido em Brasília, mostrava a véspera */}
              <span className="tnum w-28 shrink-0 text-right text-xs text-mute">
                {p.source === "PROVEDOR" ? `data-ex ${dataCurta(p.paidAt)}` : dataCurta(p.paidAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
