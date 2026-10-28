import type { ReactNode } from "react";
import Link from "next/link";
import { Minigrafico } from "@/components/movimento/minigrafico";
import { NumeroQueConta } from "@/components/movimento/numero-que-conta";
import { Revelar } from "@/components/movimento/revelar";
import { numero, pct, percentual } from "@/lib/format";
import { QUANTIDADE_DE_FICHAS, type numerosDoBento } from "@/lib/home-dados";
import { rotaDoIndice } from "@/lib/indices";
import { ROTAS } from "@/lib/navegacao";
import { juroReal } from "@/lib/site-dados";

/*
 * Por que existe: o bento junta os números do mês e as portas de entrada das fichas num só lugar, e
 * cada quadro é um link inteiro (alvo grande, um só foco). A frase que explica o número sobe no hover e
 * no foco só onde há mouse (tela larga); no celular ela fica sempre à vista, porque toque não tem hover.
 * Com a referência fixa não há minigráfico nem fonte "ao vivo": nunca se mistura fixo com ao vivo.
 */

type Dados = ReturnType<typeof numerosDoBento>;

const recipiente = "mx-auto w-full max-w-[1200px] px-6";
const quadroBase =
  "interativo flex h-full min-h-[148px] flex-col justify-between gap-4 rounded-[14px] border p-5 focus-visible:outline-offset-2";
const rotuloDoQuadro = "text-[15px] font-semibold";
const valorDoQuadro = "font-leitura text-[28px] leading-8 font-semibold tracking-[-0.01em]";

function Quadro({
  href,
  escuro,
  explicacao,
  children,
}: {
  href: string;
  escuro?: boolean;
  explicacao: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${quadroBase} ${escuro ? "border-ink bg-ink text-white" : "border-line bg-paper text-ink"}`}
    >
      <span className="flex flex-col gap-1.5">{children}</span>
      <span
        data-explicacao
        className={`explicacao-bento block text-[13px] leading-[19px] ${escuro ? "text-white/78" : "text-ink-2"}`}
      >
        {explicacao}
      </span>
    </Link>
  );
}

function QuadroDeLista({
  rotulo,
  href,
  fichas,
  explicacao,
}: {
  rotulo: string;
  href: string;
  fichas: number;
  explicacao: string;
}) {
  return (
    <Quadro href={href} explicacao={explicacao}>
      <span className={rotuloDoQuadro}>{rotulo}</span>
      <span className={valorDoQuadro}>{fichas} fichas</span>
      <span className="text-[13px] font-semibold text-ink">
        Ver a lista
        <span aria-hidden className="seta">
          &nbsp;→
        </span>
      </span>
    </Quadro>
  );
}

/**
 * `reservarMinigrafico`: com os números fixos à espera dos reais (NumerosDoMesRecuperaveis), guarda a altura
 * do minigráfico do Ibovespa para a troca não empurrar o resto da página.
 */
export function BentoAtivosIndices({ dados, reservarMinigrafico = false }: { dados: Dados; reservarMinigrafico?: boolean }) {
  const { numeros, minigraficoIbovespa } = dados;
  const { selic, ipca12m, ipcaReferencia, ibovespa, ifix, fechamento, aoVivo, intradiario } = numeros;
  const variacao = ibovespa.variacaoNoMes;
  const real = juroReal(selic, ipca12m);

  return (
    <section id="ativos-e-indices" aria-labelledby="titulo-ativos-indices" className="bg-card">
      <div className={`${recipiente} py-20 lg:py-28`}>
        <div className="max-w-[680px]">
          <h2
            id="titulo-ativos-indices"
            className="font-leitura text-[30px] leading-9 font-semibold tracking-[-0.01em] text-ink lg:text-[40px] lg:leading-[48px]"
          >
            Ativos e índices
          </h2>
          <p className="mt-[18px] font-leitura text-lg leading-[30px] text-ink-2">
            Os números do mês e a porta de entrada para as fichas de ações, FIIs e ETFs. Cada quadro explica o que
            o número quer dizer.
          </p>
          <p className="mt-3 text-[13px] leading-[19px] text-mute">
            {aoVivo ? (
              <>
                {intradiario ? "Cotação" : "Fechamento"} de {fechamento}; IPCA em 12 meses até {ipcaReferencia}.
                Fontes: Banco Central, IBGE e B3, via Yahoo Finance. Cotação com atraso de cerca de 15 minutos.
              </>
            ) : (
              <>
                Referência fixa de {fechamento}, não atualizada ao vivo; IPCA em 12 meses até {ipcaReferencia}.
                Fontes: Banco Central, IBGE e B3.
              </>
            )}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Revelar className="col-span-2 md:row-span-2">
            <Quadro href={rotaDoIndice("ibovespa")} escuro explicacao="As ações mais negociadas da B3.">
              <span className={rotuloDoQuadro}>Ibovespa</span>
              <span className="font-leitura text-[40px] leading-[44px] font-semibold tracking-[-0.015em] lg:text-[48px] lg:leading-[52px]">
                <NumeroQueConta valor={ibovespa.pontos} formato="pontos" />
                <span className="ml-2 font-sans text-[15px] font-normal text-white/78">pontos</span>
              </span>
              {variacao !== null && (
                // o quadro é navy: lá o coral de fundo claro (text-loss) reprova em contraste
                <span className={`text-[15px] font-semibold ${variacao >= 0 ? "text-gain" : "text-loss-on-dark"}`}>
                  {pct(variacao)}
                  <span className="font-normal text-white/78"> no mês</span>
                </span>
              )}
              {minigraficoIbovespa && (
                <span className="mt-2 block text-white">
                  <Minigrafico
                    valores={minigraficoIbovespa}
                    largura={220}
                    altura={56}
                    rotulo="Ibovespa: último fechamento de cada um dos últimos 12 meses"
                  />
                </span>
              )}
              {!minigraficoIbovespa && reservarMinigrafico && (
                <span data-lugar-do-minigrafico aria-hidden="true" className="mt-2 block h-14" />
              )}
            </Quadro>
          </Revelar>

          <Revelar atrasoMs={90}>
            <Quadro href={rotaDoIndice("selic")} explicacao="Juro básico do país, definido pelo Copom a cada cerca de 45 dias.">
              <span className={rotuloDoQuadro}>Selic</span>
              <span className={valorDoQuadro}>{percentual(selic, 2)}</span>
              <span className="text-[13px] text-mute">ao ano</span>
            </Quadro>
          </Revelar>

          <Revelar atrasoMs={180}>
            <Quadro href={rotaDoIndice("ipca")} explicacao="A inflação oficial, medida pelo IBGE.">
              <span className={rotuloDoQuadro}>IPCA 12 meses</span>
              <span className={valorDoQuadro}>{percentual(ipca12m, 2)}</span>
              <span className="text-[13px] text-mute">até {ipcaReferencia}</span>
            </Quadro>
          </Revelar>

          {/* O juro real não tem página própria: leva à da Selic, a taxa de onde a conta parte. */}
          <Revelar atrasoMs={270} className="col-span-2">
            <Quadro href={rotaDoIndice("selic")} explicacao="O que a renda fixa rende acima da inflação.">
              <span className={rotuloDoQuadro}>Juro real</span>
              <span className={valorDoQuadro}>{percentual(real, 2)}</span>
              <span className="text-[13px] text-mute">ao ano, Selic descontada a inflação</span>
            </Quadro>
          </Revelar>

          <Revelar>
            <Quadro href={rotaDoIndice("ifix")} explicacao="Os fundos imobiliários mais negociados da B3.">
              <span className={rotuloDoQuadro}>IFIX</span>
              <span className={valorDoQuadro}>{numero(ifix.pontos)}</span>
              <span className="text-[13px] text-mute">pontos</span>
            </Quadro>
          </Revelar>

          <Revelar atrasoMs={90}>
            <QuadroDeLista
              rotulo="Ações"
              href={ROTAS.acoes}
              fichas={QUANTIDADE_DE_FICHAS.acoes}
              explicacao="Fatias de empresas de capital aberto, com cotação, indicadores e notícias."
            />
          </Revelar>

          <Revelar atrasoMs={180}>
            <QuadroDeLista
              rotulo="FIIs"
              href={ROTAS.fiis}
              fichas={QUANTIDADE_DE_FICHAS.fiis}
              explicacao="Fundos imobiliários, com cotação, proventos e informe mensal."
            />
          </Revelar>

          <Revelar atrasoMs={270}>
            <QuadroDeLista
              rotulo="ETFs"
              href={ROTAS.etfs}
              fichas={QUANTIDADE_DE_FICHAS.etfs}
              explicacao="Fundos que seguem um índice e são negociados como ações."
            />
          </Revelar>
        </div>
      </div>
    </section>
  );
}
