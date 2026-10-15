import type { Metadata } from "next";
import { Armadilha } from "@/components/aprender/armadilha";
import { TopoDaPagina, TituloDaPagina } from "@/components/aprender/cabecalho-da-pagina";
import { INDICADORES } from "@/content/aprender/indicadores";
import { ROTAS } from "@/lib/navegacao";
import { ATIVO_DE_EXEMPLO } from "@/lib/site-dados";

export const metadata: Metadata = {
  title: "Indicadores explicados · PortfolioLab",
  description: "Para cada indicador: o que ele mede, a fórmula, como ler e onde ele engana. Os exemplos usam a mesma empresa.",
};

export default function IndicadoresPage() {
  return (
    // "como-ler-um-ativo" é a âncora antiga, de quando os indicadores moravam na página inicial.
    // Links que ainda a usem continuam chegando aqui, no alto da lista.
    <div id="como-ler-um-ativo" className="flex flex-col gap-6">
      <TopoDaPagina
        trilha={[{ rotulo: "Aprender", href: ROTAS.aprender }, { rotulo: "Indicadores explicados" }]}
        voltar={{ href: ROTAS.aprender, rotulo: "Voltar para Aprender" }}
      />
      <TituloDaPagina
        titulo="Indicadores explicados"
        anotacao="as fichas de ativos linkam direto para cada indicador (por exemplo, #pl e #dy)."
      >
        Para cada indicador: o que ele mede, a fórmula, como ler e onde ele engana. Os de ações usam a mesma empresa, a {ATIVO_DE_EXEMPLO.ticker}; os demais, uma conta hipotética, marcada como tal.
      </TituloDaPagina>

      {/* Em tela larga, o conteúdo à esquerda e as duas caixas laterais à direita. No celular a ordem é a do
          HTML: o índice "Neste guia" primeiro (é navegação), depois os indicadores, e a nota das faixas no fim. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12">
        <nav aria-label="Neste guia" className="flex flex-col gap-1.5 rounded-xl border border-pauta bg-card p-6 lg:col-start-2 lg:row-start-1">
          <p className="font-leitura text-xl leading-[26px] font-semibold text-ink">Neste guia</p>
          <ul className="flex flex-col">
            {INDICADORES.map((i) => (
              <li key={i.id}>
                <a href={`#${i.id}`} className="flex min-h-11 items-center rounded-lg px-2.5 text-[15px] leading-[22px] text-anotacao hover:bg-marca-texto">
                  {i.nome}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {INDICADORES.map((i) => (
            <section key={i.id} id={i.id} aria-labelledby={`titulo-${i.id}`} className="flex scroll-mt-24 flex-col gap-4 rounded-xl border border-pauta bg-card p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`titulo-${i.id}`} className="font-leitura text-xl leading-[26px] font-semibold text-ink">
                  {i.nome}
                </h2>
                <a href={`#${i.id}`} aria-label={`Link para ${i.nome}`} className="rounded text-[13px] leading-[19px] text-mute hover:text-ink">
                  #{i.id}
                </a>
              </div>

              <div className="flex flex-col gap-1 rounded-lg bg-marca-texto p-3.5 text-anotacao">
                <p className="text-xs leading-4 font-medium tracking-wide uppercase">Fórmula</p>
                <p className="text-[19px] leading-[26px] font-semibold">{i.formula}</p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-xs leading-4 font-medium tracking-wide text-anotacao uppercase">Como ler</p>
                <p className="text-[15px] leading-[22px] text-ink">{i.comoLer}</p>
              </div>

              <Armadilha>{i.armadilha}</Armadilha>

              <p className="flex flex-wrap items-center gap-2.5 border-t border-pauta pt-3">
                <span className="text-[13px] leading-[19px] text-ink-2">{i.exemploRotulo}:</span>
                <strong className="tnum text-[15px] leading-[22px] font-semibold text-ink">{i.exemplo}</strong>
              </p>
            </section>
          ))}

          <p className="text-[13px] leading-[19px] font-medium text-anotacao">
            <span aria-hidden>↳ </span>
            Dados do exemplo: fechamento de {ATIVO_DE_EXEMPLO.fechamento}; fonte da metodologia: HG Brasil, análise fundamentalista. Os
            exemplos hipotéticos servem para mostrar a conta, não descrevem nenhuma empresa ou fundo de verdade.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 rounded-xl bg-marca-texto p-5 lg:col-start-2 lg:row-start-2">
          <p className="text-[15px] leading-[22px] font-semibold text-anotacao">Faixas são referências, não regras</p>
          <p className="text-[13px] leading-[19px] text-ink-2">
            As fontes divergem e o mesmo número significa coisas diferentes em setores diferentes. Nada aqui é recomendação de investimento.
          </p>
        </div>
      </div>
    </div>
  );
}
