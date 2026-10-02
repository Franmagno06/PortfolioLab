"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  alocacaoDepois,
  APORTE_DO_DESAFIO,
  CARTEIRA_EXEMPLO,
  custoDasCompras,
  desvioDasMetas,
  type AtivoExemplo,
  type Compras,
} from "@/lib/carteira-exemplo";
import { brl, coresClasse } from "@/lib/format";
import { BotaoDemo } from "./botao-demo";

const NOME_CLASSE: Record<AtivoExemplo["classe"], string> = {
  FII: "FII",
  ACAO: "Ação",
  ETF: "ETF",
};

// As barras medem até 40%: o maior peso da carteira de exemplo é ~33%, e
// medir contra 100% deixaria tudo espremido no começo da trilha.
const ESCALA_PCT = 40;

// Calculado uma vez, fora do componente: a carteira de exemplo não muda.
const DESVIO_INICIAL = desvioDasMetas(CARTEIRA_EXEMPLO, {});
const ALOCACAO_INICIAL = alocacaoDepois(CARTEIRA_EXEMPLO, {});

type RespostaExemplo = { compras: { ticker: string; quantidade: number }[] };

type Comparacao = { minhas: Compras; sugeridas: Compras };

function umaCasa(valor: number) {
  return valor.toFixed(1).replace(".", ",");
}

function listaDeCompras(compras: Compras) {
  const itens = CARTEIRA_EXEMPLO.filter((a) => (compras[a.ticker] ?? 0) > 0);
  if (itens.length === 0) return <p className="text-sm text-mute">Nenhuma compra.</p>;
  return (
    <ul className="space-y-1.5">
      {itens.map((a) => (
        <li key={a.ticker} className="flex items-baseline justify-between gap-3 text-sm">
          <span>
            <span className="tnum font-mono font-semibold">{compras[a.ticker]}</span>{" "}
            {compras[a.ticker] === 1 ? "cota" : "cotas"} de{" "}
            <span className="font-mono font-semibold">{a.ticker}</span>
          </span>
          <span className="tnum font-mono text-mute">
            {brl((compras[a.ticker] ?? 0) * a.preco)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DesafioAporte() {
  const [compras, setCompras] = useState<Compras>({});
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [comparando, setComparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Tudo derivado na renderização: são seis ativos, recalcular é instantâneo.
  const gasto = custoDasCompras(CARTEIRA_EXEMPLO, compras);
  const sobra = APORTE_DO_DESAFIO - gasto;
  const depois = alocacaoDepois(CARTEIRA_EXEMPLO, compras);
  const desvio = desvioDasMetas(CARTEIRA_EXEMPLO, compras);
  const comprouAlgo = gasto > 0;

  function mudar(ticker: string, delta: number) {
    setCompras((atual) => ({ ...atual, [ticker]: Math.max(0, (atual[ticker] ?? 0) + delta) }));
    // mexeu na compra: a comparação anterior já não descreve o que está na tela
    setComparacao(null);
  }

  function recomecar() {
    setCompras({});
    setComparacao(null);
    setErro(null);
  }

  async function comparar() {
    setErro(null);
    setComparando(true);
    try {
      const r = await api<RespostaExemplo>("/rebalance/exemplo", {
        method: "POST",
        body: JSON.stringify({ amount: APORTE_DO_DESAFIO, ativos: CARTEIRA_EXEMPLO }),
      });
      setComparacao({
        minhas: compras,
        sugeridas: Object.fromEntries(r.compras.map((c) => [c.ticker, c.quantidade])),
      });
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "O servidor gratuito está acordando. Tente de novo em alguns segundos.",
      );
    } finally {
      setComparando(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {/* Placar: o que o visitante gastou e quão longe as metas estão */}
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {[
          { rotulo: "Para investir", valor: brl(APORTE_DO_DESAFIO) },
          { rotulo: "Você já usou", valor: brl(gasto) },
          { rotulo: "Sobra", valor: brl(sobra) },
          {
            rotulo: "Fora das metas",
            valor: `${umaCasa(desvio)} pts`,
            nota: `começou em ${umaCasa(DESVIO_INICIAL)}`,
          },
        ].map((item) => (
          <div key={item.rotulo} className="bg-card px-5 py-4">
            <p className="text-xs text-mute">{item.rotulo}</p>
            <p className="tnum mt-1 font-mono text-lg font-bold">{item.valor}</p>
            {item.nota && <p className="text-xs text-mute">{item.nota}</p>}
          </div>
        ))}
      </div>

      <ul className="divide-y divide-line">
        {CARTEIRA_EXEMPLO.map((a, i) => {
          const qtd = compras[a.ticker] ?? 0;
          const antes = ALOCACAO_INICIAL[i]?.pct ?? 0;
          const agora = depois[i]?.pct ?? 0;
          const cor = coresClasse[a.classe] ?? "var(--color-mute)";
          // Em centavos: em float, 1000 − 990,92 dá 9,0799…, e a última cota
          // de R$ 9,08 que cabe exatamente seria recusada.
          const cabe = Math.round(a.preco * 100) <= Math.round(sobra * 100);
          return (
            <li
              key={a.ticker}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-4 md:grid-cols-[11rem_1fr_auto]"
            >
              <div>
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />
                  <span className="font-mono font-semibold">{a.ticker}</span>
                  <span className="text-xs text-mute">{NOME_CLASSE[a.classe]}</span>
                </p>
                <p className="mt-0.5 text-xs text-mute">
                  {a.nome}, <span className="tnum font-mono">{brl(a.preco)}</span> a cota
                </p>
              </div>

              {/* Barra: cinza é hoje, colorida é depois das suas compras, o
                  traço é a meta. Mesma linguagem da tela de simulação do app. */}
              <div className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1">
                <div className="relative space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-mute-soft/60"
                      style={{ width: `${Math.min((antes / ESCALA_PCT) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${Math.min((agora / ESCALA_PCT) * 100, 100)}%`, background: cor }}
                    />
                  </div>
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-ink"
                    style={{ left: `${(a.meta / ESCALA_PCT) * 100}%` }}
                  />
                </div>
                <p className="tnum mt-1.5 font-mono text-xs text-mute">
                  {umaCasa(antes)}% → <span className="font-semibold text-ink">{umaCasa(agora)}%</span>
                  <span className="font-sans">, meta </span>
                  {a.meta}%
                </p>
              </div>

              <div className="col-start-2 row-start-1 flex items-center gap-1 md:col-start-3">
                <button
                  type="button"
                  onClick={() => mudar(a.ticker, -1)}
                  disabled={qtd === 0}
                  aria-label={`Uma cota a menos de ${a.ticker}`}
                  className="grid h-9 w-9 touch-manipulation place-items-center rounded-lg border border-line text-lg leading-none transition-colors hover:bg-paper disabled:opacity-35"
                >
                  −
                </button>
                <output
                  aria-label={`Cotas de ${a.ticker} na sua compra`}
                  className="tnum w-9 text-center font-mono font-semibold"
                >
                  {qtd}
                </output>
                <button
                  type="button"
                  onClick={() => mudar(a.ticker, 1)}
                  disabled={!cabe}
                  aria-label={`Comprar mais uma cota de ${a.ticker}`}
                  title={cabe ? undefined : "A sobra não paga mais uma cota"}
                  className="grid h-9 w-9 touch-manipulation place-items-center rounded-lg border border-line text-lg leading-none transition-colors hover:bg-paper disabled:opacity-35"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-paper/60 px-5 py-4">
        <button
          type="button"
          onClick={comparar}
          disabled={!comprouAlgo || comparando}
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-lift disabled:cursor-not-allowed disabled:opacity-50"
        >
          {comparando ? "Calculando…" : "Comparar com o PortfolioLab"}
        </button>
        {comprouAlgo && (
          <button
            type="button"
            onClick={recomecar}
            className="rounded-lg px-3 py-2.5 text-sm font-semibold text-mute hover:text-ink"
          >
            Recomeçar
          </button>
        )}
        <p aria-live="polite" className="text-sm text-mute">
          {erro ?? (comprouAlgo ? null : "Use + e − para montar sua compra.")}
        </p>
      </div>

      {comparacao && <Resultado comparacao={comparacao} />}
    </div>
  );
}

function Resultado({ comparacao }: { comparacao: Comparacao }) {
  const meu = desvioDasMetas(CARTEIRA_EXEMPLO, comparacao.minhas);
  const deles = desvioDasMetas(CARTEIRA_EXEMPLO, comparacao.sugeridas);
  const diferenca = meu - deles;
  // décimo de ponto é ruído de arredondamento, não vitória
  const veredito =
    diferenca <= 0.05
      ? "Você chegou tão perto das metas quanto o PortfolioLab."
      : `O PortfolioLab deixou a carteira ${umaCasa(diferenca)} pontos mais perto das metas.`;

  return (
    <section aria-label="Resultado da comparação" className="border-t border-line px-5 py-6">
      <p className="text-lg font-semibold">{veredito}</p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="flex items-baseline justify-between text-sm font-semibold">
            Sua compra
            <span className="tnum font-mono text-mute">{umaCasa(meu)} pts fora</span>
          </h3>
          <div className="mt-3">{listaDeCompras(comparacao.minhas)}</div>
        </div>
        <div>
          <h3 className="flex items-baseline justify-between text-sm font-semibold">
            Sugestão do PortfolioLab
            <span className="tnum font-mono text-gain-ink">{umaCasa(deles)} pts fora</span>
          </h3>
          <div className="mt-3">{listaDeCompras(comparacao.sugeridas)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-paper px-5 py-4 text-sm leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">Por que essa sugestão</p>
        <p className="mt-1.5 max-w-prose">
          O dinheiro novo vai só para quem está abaixo da meta, e cada ativo recebe uma fatia
          proporcional ao tamanho do seu buraco. Vender o que passou da meta geraria imposto;
          aportar no que ficou para trás não. Cotas são inteiras: quando uma cota custa mais que a
          fatia, como o IVVB11 aqui, o troco vai para o próximo mais longe da meta.
        </p>
      </div>

      <div className="mt-6">
        <BotaoDemo tom="escuro" rotulo="Fazer isso numa carteira de 16 ativos" />
      </div>
    </section>
  );
}
