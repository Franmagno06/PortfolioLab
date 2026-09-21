"use client";

import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campo";
import { IconeCheck, IconeFechar } from "@/components/ui/icones";
import { MensagemAviso, MensagemErro } from "@/components/ui/mensagem";
import { api, ApiError } from "@/lib/api";
import { brl, nomesClasse } from "@/lib/format";
import { normalizarTicker, useBuscaTicker } from "@/lib/use-busca-ticker";

// Controlado pela página: o gatilho vive no cabeçalho e o formulário no corpo,
// então quem manda em "aberto" é quem desenha as duas coisas.
type Props = { aberto: boolean; aoFechar: () => void; aoCriar: () => void };

export function NovaTransacao({ aberto, aoFechar, aoCriar }: Props) {
  const [ticker, setTicker] = useState("");
  const { cotacao, buscando, erro: erroTicker } = useBuscaTicker(ticker);

  const [kind, setKind] = useState<"COMPRA" | "VENDA">("COMPRA");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [precoEditado, setPrecoEditado] = useState(false);
  const [fee] = useState("0");
  // Data LOCAL, não UTC: toISOString() daria o dia seguinte para quem está em
  // UTC−3 depois das 21h, e a data decide a posição da operação na ordem que a
  // validação de venda descoberta usa. "sv-SE" formata como AAAA-MM-DD.
  const [executedAt, setExecutedAt] = useState(new Date().toLocaleDateString("sv-SE"));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Sugere o preço de mercado, mas sem sobrescrever o que o usuário já tiver
  // digitado (a compra pode ter sido em outra data). Derivado, não copiado:
  // enquanto ninguém editou o campo, ele espelha a cotação.
  const preco = precoEditado ? unitPrice : cotacao ? String(cotacao.preco) : "";

  function fechar() {
    setTicker("");
    setQuantity("");
    setUnitPrice("");
    setPrecoEditado(false);
    setErro(null);
    aoFechar();
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

  if (!aberto) return null;

  return (
    <form onSubmit={salvar} className="reveal rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Registrar transação</h2>
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar formulário"
          className="rounded-lg p-1 text-mute transition-colors hover:bg-paper hover:text-ink"
        >
          <IconeFechar />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <Campo
            rotulo="Ativo (qualquer ação ou FII da B3)"
            type="text"
            required
            value={ticker}
            onChange={(e) => setTicker(normalizarTicker(e.target.value))}
            placeholder="Ex: PETR4, MXRF11, WEGE3"
            maxLength={6}
            autoFocus
            className="font-mono uppercase"
          />
        </div>

        <Selecao
          rotulo="Tipo"
          value={kind}
          onChange={(e) => setKind(e.target.value as "COMPRA" | "VENDA")}
        >
          <option value="COMPRA">Compra</option>
          <option value="VENDA">Venda</option>
        </Selecao>

        <Campo
          rotulo="Qtd."
          type="number"
          required
          min="0.00000001"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="tnum font-mono"
        />

        <Campo
          rotulo="Preço (R$)"
          type="number"
          required
          min="0.01"
          step="0.01"
          value={preco}
          onChange={(e) => {
            setUnitPrice(e.target.value);
            setPrecoEditado(true);
          }}
          className="tnum font-mono"
        />

        <Campo
          rotulo="Data"
          type="date"
          required
          value={executedAt}
          onChange={(e) => setExecutedAt(e.target.value)}
          className="tnum font-mono"
        />
      </div>

      {/* confirmação do ativo encontrado */}
      {buscando && <p className="mt-3 text-sm text-mute">Buscando {ticker} na B3...</p>}

      {cotacao && !buscando && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-gain/7 px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-gain-ink">
            <IconeCheck />
            {cotacao.ticker}
          </span>
          <span className="text-ink-soft">{cotacao.nome}</span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-mute">
            {nomesClasse[cotacao.tipo] ?? cotacao.tipo}
          </span>
          <span className="tnum ml-auto font-mono text-xs text-mute">
            cotação hoje: {brl(cotacao.preco)}
          </span>
        </div>
      )}

      {erroTicker && !buscando && (
        <div className="mt-3">
          <MensagemAviso titulo={erroTicker} />
        </div>
      )}

      {erro && (
        <div className="mt-3">
          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}

      <Botao type="submit" disabled={salvando || buscando} className="mt-4">
        {salvando ? "Registrando..." : kind === "COMPRA" ? "Registrar compra" : "Registrar venda"}
      </Botao>
    </form>
  );
}
