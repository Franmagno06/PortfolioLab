import type { Metadata } from "next";
import { Armadilha } from "@/components/aprender/armadilha";
import { TopoDaPagina, TituloDaPagina } from "@/components/aprender/cabecalho-da-pagina";
import { Conta, Parcela, Sinal } from "@/components/aprender/conta";
import { TabelaDeExemplo } from "@/components/aprender/tabela-de-exemplo";
import {
  aporteDeExemplo,
  DADOS_PUBLICOS,
  depoisDaCompra,
  depoisDaVenda,
  dividendYieldPct,
  emCentavos,
  type Centavos,
} from "@/lib/aprender/exemplos";
import { dataCurta, brl, numero, percentual } from "@/lib/format";
import { ROTAS } from "@/lib/navegacao";
import { ATIVO_DE_EXEMPLO, juroReal } from "@/lib/site-dados";

export const metadata: Metadata = {
  title: "Como o site calcula · PortfolioLab",
  description: "As contas que o PortfolioLab faz por você, cada uma com um exemplo em reais e o que ela não faz.",
};

const reais = (c: Centavos) => brl(c / 100);

// Cada número da página sai de uma função de src/lib/aprender/exemplos.ts, que tem teste: o que
// está na tela é o que o código calcula, e não um valor digitado à mão.
function exemploDePrecoMedio() {
  const compra1 = { quantidade: 10, precoCentavos: emCentavos(20), taxaCentavos: emCentavos(2) };
  const compra2 = { quantidade: 10, precoCentavos: emCentavos(30), taxaCentavos: emCentavos(2) };
  const p1 = depoisDaCompra({ quantidade: 0, pmCentavos: 0 }, compra1);
  const p2 = depoisDaCompra(p1, compra2);
  const p3 = depoisDaVenda(p2, 5);
  return {
    linhas: [
      ["Compra", "10", reais(compra1.precoCentavos), reais(compra1.taxaCentavos), reais(p1.pmCentavos), String(p1.quantidade)],
      ["Compra", "10", reais(compra2.precoCentavos), reais(compra2.taxaCentavos), reais(p2.pmCentavos), String(p2.quantidade)],
      ["Venda", "5", "—", "—", reais(p3.pmCentavos), String(p3.quantidade)],
    ],
    // (custo da posição anterior + custo da compra nova, com a taxa) ÷ quantidade total
    conta: `(${reais(p1.quantidade * p1.pmCentavos)} + ${reais(compra2.quantidade * compra2.precoCentavos + compra2.taxaCentavos)}) ÷ ${p2.quantidade} = ${reais(p2.pmCentavos)}`,
  };
}

function exemploDeAporte() {
  const { compras, sobraCentavos } = aporteDeExemplo(
    [
      { ticker: "MXRF11", metaPct: 60, precoCentavos: emCentavos(10.85), posicaoCentavos: 0 },
      { ticker: "BOVA11", metaPct: 40, precoCentavos: emCentavos(110), posicaoCentavos: 0 },
    ],
    emCentavos(200),
  );
  return {
    linhas: compras.map((c) => [
      c.ticker,
      `${c.metaPct}%`,
      reais(c.deficitCentavos),
      reais(c.precoCentavos),
      String(c.cotas),
      c.cotas > 0 ? reais(c.custoCentavos) : "—",
    ]),
    sobra: reais(sobraCentavos),
  };
}

const bloco = "flex scroll-mt-24 flex-col gap-4 rounded-xl border border-pauta bg-card p-6";
const tituloDoBloco = "font-leitura text-xl leading-[26px] font-semibold text-ink";
const paragrafo = "text-[15px] leading-[22px] text-ink";
const rotuloDoExemplo = "text-xs leading-4 font-medium tracking-wide text-anotacao uppercase";
const notinha = "text-[13px] leading-[19px] font-medium text-anotacao";

const SECOES = [
  { id: "preco-medio", rotulo: "Preço médio" },
  { id: "dividend-yield", rotulo: "Dividend yield" },
  { id: "aporte", rotulo: "Aporte e rebalanceamento" },
  { id: "juro-real", rotulo: "Juro real" },
] as const;

export default function ComoCalculamosPage() {
  const pm = exemploDePrecoMedio();
  const aporte = exemploDeAporte();
  const dy = dividendYieldPct(emCentavos(ATIVO_DE_EXEMPLO.proventos12m.porUnidade), emCentavos(ATIVO_DE_EXEMPLO.preco));
  const { selicMeta, ipca12m } = DADOS_PUBLICOS;
  const real = juroReal(selicMeta.valorPct, ipca12m.valorPct);

  return (
    <div className="flex flex-col gap-6">
      <TopoDaPagina
        trilha={[{ rotulo: "Aprender", href: ROTAS.aprender }, { rotulo: "Como o site calcula" }]}
        voltar={{ href: ROTAS.aprender, rotulo: "Voltar para Aprender" }}
      />
      <TituloDaPagina
        titulo="Como o site calcula"
        anotacao="se o número da sua carteira não bate com outro site, é aqui que você descobre por quê."
      >
        As contas que o PortfolioLab faz por você, cada uma com um exemplo em reais e o que ela não faz.
      </TituloDaPagina>

      {/* Em tela larga, o conteúdo à esquerda e as duas caixas laterais à direita. No celular a ordem é a do
          HTML: "Nesta página" primeiro (é navegação), depois as contas, e "O que o site não faz" no fim. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12">
        <nav aria-label="Nesta página" className="flex flex-col gap-1.5 rounded-xl border border-pauta bg-card p-6 lg:col-start-2 lg:row-start-1">
          <p className="font-leitura text-xl leading-[26px] font-semibold text-ink">Nesta página</p>
          <ul className="flex flex-col">
            {SECOES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex min-h-11 items-center rounded-lg px-2.5 text-[15px] leading-[22px] text-anotacao hover:bg-marca-texto">
                  {s.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section id="preco-medio" aria-labelledby="titulo-preco-medio" className={bloco}>
            <h2 id="titulo-preco-medio" className={tituloDoBloco}>
              Preço médio
            </h2>
            <p className={paragrafo}>
              Cada compra recalcula o preço médio incluindo a taxa. Uma venda não altera o preço médio: é a regra da Receita Federal.
            </p>
            <p className={rotuloDoExemplo}>Exemplo em reais</p>
            <TabelaDeExemplo
              legenda="Exemplo de preço médio: duas compras e uma venda"
              colunas={["Operação", "Quantidade", "Preço", "Taxa", "PM depois", "Cotas"]}
              linhas={pm.linhas}
            />
            <p className={notinha}>
              <span aria-hidden>↳ </span>segunda compra: {pm.conta}.
            </p>
          </section>

          <section id="dividend-yield" aria-labelledby="titulo-dy" className={bloco}>
            <h2 id="titulo-dy" className={tituloDoBloco}>
              Dividend yield
            </h2>
            <p className={paragrafo}>O site soma os proventos que ele mesmo importa nos últimos 12 meses e divide pelo preço atual.</p>
            <p className={rotuloDoExemplo}>Exemplo em reais · {ATIVO_DE_EXEMPLO.ticker}</p>
            <Conta rotulo={`Cálculo do dividend yield da ${ATIVO_DE_EXEMPLO.ticker}`}>
              <Parcela rotulo="Proventos em 12 meses" fundo="papel">
                {brl(ATIVO_DE_EXEMPLO.proventos12m.porUnidade)}
              </Parcela>
              <Sinal>÷</Sinal>
              <Parcela rotulo="Preço atual" fundo="papel">
                {brl(ATIVO_DE_EXEMPLO.preco)}
              </Parcela>
              <Sinal>=</Sinal>
              <Parcela rotulo="DY" resultado>
                {percentual(dy, 2)}
              </Parcela>
            </Conta>
            <Armadilha>
              Dois sites podem mostrar DYs diferentes: o PortfolioLab não usa o campo pronto do Yahoo, e sim os proventos que ele importa.
            </Armadilha>
          </section>

          <section id="aporte" aria-labelledby="titulo-aporte" className={bloco}>
            <h2 id="titulo-aporte" className={tituloDoBloco}>
              Aporte e rebalanceamento
            </h2>
            <p className={paragrafo}>
              O site usa cada aporte para levar a carteira de volta às metas, sem vender nada. Ele compra só unidades inteiras e sempre no ativo
              mais abaixo da meta.
            </p>
            <p className={rotuloDoExemplo}>Exemplo · aporte de {brl(200)}</p>
            <TabelaDeExemplo
              legenda="Exemplo de aporte de R$ 200,00 em dois ativos"
              colunas={["Ativo", "Meta", "Déficit", "Preço", "Compra", "Custo"]}
              linhas={aporte.linhas}
            />
            <p className="text-[15px] leading-[22px] text-ink-2">
              Sobram {aporte.sobra}. O site não compra BOVA11 só para gastar a sobra: uma cota custa mais que o déficit. A sobra vai para o
              próximo aporte.
            </p>
            <p className={notinha}>
              <span aria-hidden>↳ </span>limitação atual: as metas são por ticker, não por classe de ativo.
            </p>
          </section>

          <section id="juro-real" aria-labelledby="titulo-juro-real" className={bloco}>
            <h2 id="titulo-juro-real" className={tituloDoBloco}>
              Juro real
            </h2>
            <p className={paragrafo}>É o juro depois de descontar a inflação. Mostra quanto o seu dinheiro realmente cresce em poder de compra.</p>
            <p className={rotuloDoExemplo}>Fórmula e exemplo</p>
            <p className="rounded-lg bg-marca-texto p-3.5 text-[19px] leading-[26px] font-semibold text-anotacao">(1 + juro) ÷ (1 + inflação) − 1</p>
            <p className="text-[15px] leading-[22px] text-ink-2">
              Com Selic de {numero(selicMeta.valorPct, 2)}% e IPCA de {numero(ipca12m.valorPct, 2)}% em 12 meses: {numero(1 + selicMeta.valorPct / 100, 4)} ÷{" "}
              {numero(1 + ipca12m.valorPct / 100, 4)} − 1 = {numero(real, 2)}% de juro real.
            </p>
            <p className="text-[13px] leading-[19px] text-mute">
              Dados públicos: Selic meta, {selicMeta.fonte} (conferida em {dataCurta(selicMeta.conferidoEm)}); IPCA em 12 meses até{" "}
              {ipca12m.referencia}, {ipca12m.fonte}.
            </p>
          </section>

          <p className="text-[13px] leading-[19px] text-mute">
            Os números de mercado mudam; cada dado público aparece com a fonte e a data em que foi conferido. Conteúdo educacional, não é
            recomendação de investimento.
          </p>
        </div>

        <section aria-labelledby="titulo-nao-faz" className="flex flex-col gap-4 rounded-xl border border-pauta bg-card p-6 lg:col-start-2 lg:row-start-2">
          <h2 id="titulo-nao-faz" className={tituloDoBloco}>
            O que o site não faz
          </h2>
          <ul className="flex flex-col gap-2">
            {["Não recomenda o que comprar: os critérios são didáticos.", "Não tem cotação automática do Tesouro Direto: o preço entra à mão."].map((t) => (
              <li key={t} className="flex gap-2 text-[15px] leading-[22px] text-ink-2">
                <span aria-hidden className="font-semibold text-anotacao">
                  •
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
