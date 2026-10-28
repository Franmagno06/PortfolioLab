"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  alocacaoDepois,
  APORTE_DO_DESAFIO,
  custoDasCompras,
  desvioDasMetas,
  type AtivoExemplo,
  type Compras,
} from "@/lib/carteira-exemplo";
import { brl, coresClasse, numero, percentual } from "@/lib/format";
import { CONTA_DEMO } from "@/lib/site-dados";
import { BotaoDemo } from "./botao-demo";

const NOME_CLASSE: Record<AtivoExemplo["classe"], string> = {
  FII: "FII",
  ACAO: "Ação",
  ETF: "ETF",
};

// As barras medem até 40%: o maior peso da carteira de exemplo é ~33%, e
// medir contra 100% deixaria tudo espremido no começo da trilha.
const ESCALA_PCT = 40;

type RespostaExemplo = {
  compras: { ticker: string; quantidade: number }[];
  ignorados: { ticker: string; motivo: string }[];
};

type Comparacao = {
  minhas: Compras;
  sugeridas: Compras;
  /** Quem ficou de fora da sugestão e por quê, nas palavras do backend. */
  ignorados: RespostaExemplo["ignorados"];
};

function metaPct(meta: number) {
  return percentual(meta, Number.isInteger(meta) ? 0 : 1);
}

function ListaDeCompras({ carteira, compras }: { carteira: readonly AtivoExemplo[]; compras: Compras }) {
  const itens = carteira.filter((a) => (compras[a.ticker] ?? 0) > 0);
  if (itens.length === 0) return <p className="text-sm text-mute">Nenhuma compra.</p>;
  return (
    <ul className="space-y-1.5">
      {itens.map((a) => {
        const cotas = compras[a.ticker] ?? 0;
        return (
          <li key={a.ticker} className="flex items-baseline justify-between gap-3 text-[15px]">
            <span>
              <span className="tnum font-semibold">{cotas}</span> {cotas === 1 ? "cota" : "cotas"} de{" "}
              <span className="font-semibold">{a.ticker}</span>
            </span>
            <span className="tnum text-ink-2">{brl(cotas * a.preco)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function DesafioAporte({ carteira }: { carteira: readonly AtivoExemplo[] }) {
  const [compras, setCompras] = useState<Compras>({});
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [comparando, setComparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Tudo derivado na renderização: são seis ativos, recalcular é instantâneo.
  const antes = alocacaoDepois(carteira, {});
  const desvioInicial = desvioDasMetas(carteira, {});
  const gasto = custoDasCompras(carteira, compras);
  const sobra = APORTE_DO_DESAFIO - gasto;
  const depois = alocacaoDepois(carteira, compras);
  const desvio = desvioDasMetas(carteira, compras);
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
        body: JSON.stringify({ amount: APORTE_DO_DESAFIO, ativos: carteira }),
      });
      setComparacao({
        minhas: compras,
        sugeridas: Object.fromEntries(r.compras.map((c) => [c.ticker, c.quantidade])),
        ignorados: r.ignorados,
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
    <article
      aria-labelledby="folha-de-novembro"
      className="overflow-hidden rounded-md border border-pauta bg-card text-ink shadow-folha"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 pb-[18px]">
        <div>
          <h3 id="folha-de-novembro" className="font-leitura text-2xl leading-[30px] font-semibold">
            Aporte de novembro
          </h3>
          <p className="mt-1 text-[13px] text-mute">
            Carteira de exemplo depois de outubro, {carteira.length} ativos
          </p>
        </div>
        <p className="tnum text-lg font-semibold">{brl(APORTE_DO_DESAFIO)}</p>
      </div>

      {/* O placar é uma frase, não uma fileira de números grandes */}
      <p className="border-y border-pauta bg-caderno px-6 py-3 text-[15px] leading-6 text-ink-2">
        Você usou <span className="tnum font-semibold text-ink">{brl(gasto)}</span> e sobram{" "}
        <span className="tnum font-semibold text-ink">{brl(sobra)}</span>. Fora das metas:{" "}
        <span className="tnum font-semibold text-ink">{numero(desvio, 1)} pontos</span>, começou em{" "}
        <span className="tnum">{numero(desvioInicial, 1)}</span>.
      </p>

      <ul className="divide-y divide-pauta">
        {carteira.map((a, i) => {
          const qtd = compras[a.ticker] ?? 0;
          const pctAntes = antes[i]?.pct ?? 0;
          const pctDepois = depois[i]?.pct ?? 0;
          const cor = coresClasse[a.classe] ?? "var(--color-mute)";
          // Em centavos: em float, 1000 − 990,92 dá 9,0799…, e a última cota
          // de R$ 9,08 que cabe exatamente seria recusada.
          const cabe = Math.round(a.preco * 100) <= Math.round(sobra * 100);
          return (
            <li
              key={a.ticker}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-6 py-4 md:grid-cols-[13.5rem_1fr_auto]"
            >
              <div>
                <p className="flex items-baseline gap-2">
                  <span aria-hidden className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: cor }} />
                  <span className="text-[15px] font-semibold">{a.ticker}</span>
                  <span className="text-xs text-mute">{NOME_CLASSE[a.classe]}</span>
                </p>
                <p className="mt-0.5 text-[13px] text-mute">
                  {a.nome}, <span className="tnum">{brl(a.preco)}</span> a cota
                </p>
              </div>

              {/* Cinza é a carteira de antes, colorida é depois das suas
                  compras, o traço é a meta. */}
              <div className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1">
                <div className="relative space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-caderno">
                    <div
                      className="h-full rounded-full bg-mute/45"
                      style={{ width: `${Math.min((pctAntes / ESCALA_PCT) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-caderno">
                    {/* scaleX em vez de width: só transform anima, sem refazer o layout a cada clique;
                        o arredondamento vem do trilho (overflow-hidden), não da barra esticada. */}
                    <div
                      data-barra="depois"
                      className="barra-escala h-full w-full"
                      style={{ transform: `scaleX(${Math.min(pctDepois / ESCALA_PCT, 1)})`, background: cor }}
                    />
                  </div>
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-ink"
                    style={{ left: `${(a.meta / ESCALA_PCT) * 100}%` }}
                  />
                </div>
                <p className="tnum mt-1.5 text-xs text-mute">
                  {percentual(pctAntes)} para <span className="font-semibold text-ink">{percentual(pctDepois)}</span>,
                  meta {metaPct(a.meta)}
                </p>
              </div>

              <div className="col-start-2 row-start-1 flex items-center gap-1 md:col-start-3">
                <button
                  type="button"
                  onClick={() => mudar(a.ticker, -1)}
                  disabled={qtd === 0}
                  aria-label={`Uma cota a menos de ${a.ticker}`}
                  className="grid h-11 w-11 touch-manipulation place-items-center rounded border border-pauta text-lg leading-none transition-colors hover:bg-caderno disabled:opacity-35 md:h-9 md:w-9"
                >
                  −
                </button>
                <output
                  aria-label={`Cotas de ${a.ticker} na sua compra`}
                  className="tnum w-9 text-center font-semibold"
                >
                  {qtd}
                </output>
                <button
                  type="button"
                  onClick={() => mudar(a.ticker, 1)}
                  disabled={!cabe}
                  aria-label={`Comprar mais uma cota de ${a.ticker}`}
                  title={cabe ? undefined : "A sobra não paga mais uma cota"}
                  className="grid h-11 w-11 touch-manipulation place-items-center rounded border border-pauta text-lg leading-none transition-colors hover:bg-caderno disabled:opacity-35 md:h-9 md:w-9"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-pauta bg-caderno px-6 py-4">
        <button
          type="button"
          onClick={comparar}
          disabled={!comprouAlgo || comparando}
          className="rounded bg-ink px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-ink-lift disabled:cursor-not-allowed disabled:opacity-50"
        >
          {comparando ? "Calculando…" : "Comparar com o PortfolioLab"}
        </button>
        {comprouAlgo && (
          <button
            type="button"
            onClick={recomecar}
            className="rounded px-2 py-2.5 text-[15px] font-semibold text-ink-2 underline decoration-1 underline-offset-4 hover:text-ink"
          >
            Recomeçar
          </button>
        )}
        <p aria-live="polite" className="text-sm text-mute">
          {erro ?? (comprouAlgo ? null : "Use + e − para montar sua compra.")}
        </p>
      </div>

      {comparacao && <Resultado carteira={carteira} comparacao={comparacao} />}
    </article>
  );
}

function Resultado({ carteira, comparacao }: { carteira: readonly AtivoExemplo[]; comparacao: Comparacao }) {
  const meu = desvioDasMetas(carteira, comparacao.minhas);
  const deles = desvioDasMetas(carteira, comparacao.sugeridas);
  const diferenca = meu - deles;
  // décimo de ponto é ruído de arredondamento, não vitória
  const veredito =
    diferenca <= 0.05
      ? "Você chegou tão perto das metas quanto o PortfolioLab."
      : `O PortfolioLab deixou a carteira ${numero(diferenca, 1)} pontos mais perto das metas.`;

  return (
    <section aria-label="Resultado da comparação" className="border-t border-pauta px-6 py-7">
      <p className="font-leitura text-[22px] leading-[30px] font-semibold">{veredito}</p>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <h4 className="flex items-baseline justify-between gap-3 border-b border-pauta pb-2 text-sm font-semibold">
            Sua compra
            <span className="tnum font-medium text-ink-2">{numero(meu, 1)} pontos fora</span>
          </h4>
          <div className="mt-3">
            <ListaDeCompras carteira={carteira} compras={comparacao.minhas} />
          </div>
        </div>
        <div>
          <h4 className="flex items-baseline justify-between gap-3 border-b border-pauta pb-2 text-sm font-semibold">
            Sugestão do PortfolioLab
            <span className="tnum font-medium text-gain-ink">{numero(deles, 1)} pontos fora</span>
          </h4>
          <div className="mt-3">
            <ListaDeCompras carteira={carteira} compras={comparacao.sugeridas} />
          </div>
        </div>
      </div>

      {/* A explicação é uma anotação na margem, como as das folhas */}
      <div className="mt-7 max-w-[68ch] space-y-2 border-l-[1.5px] border-anotacao-margem pl-4 font-leitura text-[15px] leading-[22px] italic text-anotacao">
        <p>
          O dinheiro novo vai só para quem está abaixo da meta, e cada ativo recebe uma fatia proporcional ao
          tamanho do seu buraco. Vender o que passou da meta geraria imposto; aportar no que ficou para trás,
          não. As cotas são inteiras, então o troco vai para quem continua mais longe da meta.
        </p>
        {comparacao.ignorados.map((i) => (
          <p key={i.ticker}>
            {i.ticker} ficou de fora: {i.motivo}.
          </p>
        ))}
      </div>

      <div className="mt-7">
        <BotaoDemo tom="escuro" rotulo={`Fazer isso numa carteira de ${CONTA_DEMO.ativos} ativos`} />
      </div>
    </section>
  );
}
