import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArtigoEmDestaque } from "@/components/aprender/artigo-em-destaque";
import { CardArtigo } from "@/components/aprender/card-artigo";
import { GraficoDeFundo } from "@/components/movimento/grafico-de-fundo";
import { Revelar } from "@/components/movimento/revelar";
import { AtivoAnotado, PainelDeCriterios } from "@/components/site/ativo-anotado";
import { BotaoDemo } from "@/components/site/botao-demo";
import { CabecalhoSite } from "@/components/site/cabecalho-site";
import { DesafioAporte } from "@/components/site/desafio-aporte";
import { NumerosDoMesAoVivo, NumerosDoMesFixos } from "@/components/site/numeros-do-mes";
import { RodapeSite } from "@/components/site/rodape-site";
import { artigoEmDestaque, listarArtigos } from "@/lib/aprender/artigos";
import { APORTE_DO_DESAFIO, CARTEIRA_DE_NOVEMBRO } from "@/lib/carteira-exemplo";
import { brlSemCentavos } from "@/lib/format";
import { artigosParaComecar } from "@/lib/home-dados";
import { ROTAS } from "@/lib/navegacao";
import { CONTA_DEMO, NUMEROS_DO_MES } from "@/lib/site-dados";

/**
 * Os números do mês vêm do Banco Central e do Yahoo a cada visita (a leitura guarda a resposta por 2 min).
 * Só a seção deles espera o backend: ela chega por streaming, sob <Suspense>, e o resto abre na hora.
 */
export const revalidate = 0;

export const metadata: Metadata = {
  title: "PortfolioLab: invista aprendendo, aprenda investindo",
  description:
    "Acompanhe sua carteira da B3 e entenda cada decisão: onde colocar o aporte do mês, quanto você recebe de proventos e o que cada indicador quer dizer. Gratuito e educacional.",
};

/*
 * Página inicial v2 — "caderno de laboratório". Um único recurso marcante: as
 * anotações na margem, em Literata itálico roxo, ao lado de cada número real.
 * O resto é calmo e textual. Nada aqui depende de quem vê. Os números do mês vêm
 * dos índices reais (components/site/numeros-do-mes) e caem nos fixos se a leitura falhar; o
 * resto sai de lib/site-dados e lib/carteira-exemplo, formatados só por lib/format.
 */

const recipiente = "mx-auto w-full max-w-[1200px] px-6";
const tituloDeSecao =
  "font-leitura text-[30px] leading-9 font-semibold tracking-[-0.01em] text-ink lg:text-[40px] lg:leading-[48px]";
const apoioDeSecao = "font-leitura text-lg leading-[30px] text-ink-2";
const linkClaro =
  "px-0.5 py-3 text-base font-semibold text-white underline decoration-1 underline-offset-4 hover:text-white/78";

const linkEscuro =
  "inline-flex min-h-11 items-center text-base font-semibold text-ink underline decoration-1 underline-offset-4 hover:text-ink-lift";

const FERRAMENTAS = [
  {
    titulo: "Simular o aporte do mês",
    href: ROTAS.simulacao,
    descricao:
      "Informe quanto vai investir e veja quantas cotas comprar de cada ativo para se aproximar das metas, sempre em cotas inteiras.",
  },
  {
    titulo: "Acompanhar a carteira inteira",
    href: ROTAS.dashboard,
    descricao:
      "Registre compras e vendas. O preço médio segue a regra da Receita Federal e os proventos entram sozinhos.",
  },
  {
    titulo: "Ler relatórios com ajuda",
    href: ROTAS.relatorios,
    descricao:
      "Envie o relatório de um fundo ou o release de uma empresa. Os números vêm da CVM e a IA explica o que mudou.",
  },
];

export default function SitePage() {
  const destaque = artigoEmDestaque();
  const cartoes = artigosParaComecar(listarArtigos(), destaque?.slug);

  return (
    <>
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>

      <CabecalhoSite />

      <main id="conteudo">
        {/* ── 1. Topo ───────────────────────────────────────────────────
            Por que assim: a primeira coisa que o visitante lê diz o que ele vai APRENDER aqui; o gráfico
            ao fundo sinaliza "mercado" sem competir com o título (e tem botão de pausa). Sem <Revelar>:
            a primeira dobra nunca espera animação. */}
        <section aria-labelledby="titulo-topo" data-superficie="navy" className="relative overflow-hidden bg-ink text-white">
          <GraficoDeFundo className="text-white" />
          <div className={`${recipiente} relative z-10 flex flex-col gap-7 pt-16 pb-28 lg:pt-[104px] lg:pb-24`}>
            <h1
              id="titulo-topo"
              className="max-w-[760px] font-leitura text-[36px] leading-[42px] font-semibold tracking-[-0.015em] text-balance text-white lg:text-[56px] lg:leading-[64px]"
            >
              Entenda o que você compra antes de investir.
            </h1>
            <p className="max-w-[620px] font-leitura text-lg leading-[29px] text-white/78 lg:text-xl lg:leading-[33px]">
              Artigos curtos, páginas de cada ativo e os índices do mercado, com as contas feitas e cada termo
              explicado. A sua carteira vem depois, como complemento, para você acompanhar o que aprendeu.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
              <Link
                href={ROTAS.aprender}
                className="interativo inline-flex min-h-11 items-center justify-center rounded border border-transparent bg-white px-5 py-[11px] text-base font-semibold text-ink hover:bg-paper"
              >
                Começar pelos artigos<span aria-hidden className="seta">&nbsp;→</span>
              </Link>
              <BotaoDemo />
              <Link href={ROTAS.registro} className={linkClaro}>
                Criar minha conta
              </Link>
            </div>
            <p className="text-[13px] text-white/62">
              Gratuito e educacional. Nada aqui é recomendação de investimento.
            </p>
          </div>
        </section>

        {/* ── 2. Os números do mês ───────────────────────────────────── */}
        <Suspense fallback={<NumerosDoMesFixos />}>
          <NumerosDoMesAoVivo />
        </Suspense>

        {/* ── 2. Comece por aqui ─────────────────────────────────────────
            Por que assim: o visitante vê artigos de verdade (não promessas) e escolhe por onde entrar;
            os cartões priorizam quem está começando para o destaque do dia não esconder o básico. */}
        <section id="comece-por-aqui" aria-labelledby="titulo-comece" className="bg-caderno">
          <div className={`${recipiente} py-20 lg:py-28`}>
            <Revelar>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-[680px]">
                  <h2 id="titulo-comece" className={tituloDeSecao}>
                    Comece por aqui
                  </h2>
                  <p className={`mt-[18px] ${apoioDeSecao}`}>
                    Leituras curtas e sem jargão. Escolha o assunto que está mais perto da sua
                    dúvida de hoje.
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-6">
                  <Link href={ROTAS.aprender} className={linkEscuro}>
                    Ver todos os artigos
                  </Link>
                  <Link href={ROTAS.glossario} className={linkEscuro}>
                    Glossário
                  </Link>
                </div>
              </div>
            </Revelar>

            {destaque && (
              <div className="mt-10">
                <Revelar>
                  <ArtigoEmDestaque artigo={destaque} nivelDoTitulo="h3" />
                </Revelar>
              </div>
            )}

            <ul role="list" className="mt-6 grid gap-6 md:grid-cols-3">
              {cartoes.map((a, i) => (
                <li key={a.slug} className="flex">
                  <Revelar atrasoMs={i * 90} className="flex w-full">
                    <CardArtigo artigo={a} />
                  </Revelar>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 4. Agora é com você: o aporte de novembro ──────────────── */}
        <section id="desafio" aria-labelledby="titulo-desafio" className="bg-card">
          <div className={`${recipiente} pt-20 pb-20 lg:pt-[104px] lg:pb-28`}>
            <div className="max-w-[680px]">
              <h2 id="titulo-desafio" className={tituloDeSecao}>
                Agora é com você: o aporte de novembro
              </h2>
              <p className={`mt-[18px] ${apoioDeSecao}`}>
                Depois das compras de outubro, a carteira de exemplo recebe mais{" "}
                {brlSemCentavos(APORTE_DO_DESAFIO)}. Monte a compra que deixa a carteira mais perto das metas e
                compare com o cálculo do PortfolioLab.
              </p>
              <p className="mt-3 text-sm leading-[21px] text-mute">
                Os ativos são reais e os preços são uma referência fixa de {NUMEROS_DO_MES.rotulo}. “Fora das metas” conta
                quantos pontos percentuais da carteira estão no lugar errado: zero é a carteira igual às metas.
              </p>
            </div>
            <div className="mt-12">
              <DesafioAporte carteira={CARTEIRA_DE_NOVEMBRO} />
            </div>
          </div>
        </section>

        {/* ── 5. Cada número vem com a explicação ao lado ────────────── */}
        <section id="como-ler-um-ativo" aria-labelledby="titulo-como-ler" className="bg-caderno">
          <div className={`${recipiente} py-20 lg:py-28`}>
            <div className="max-w-[680px]">
              <h2 id="titulo-como-ler" className={tituloDeSecao}>
                Cada número vem com a explicação ao lado
              </h2>
              <p className={`mt-[18px] ${apoioDeSecao}`}>
                Sem nota e sem ranking de “melhores”. Você aprende o que cada indicador mede, compara com o setor
                e decide com os seus próprios critérios.
              </p>
            </div>
            <div className="mt-12 grid items-start gap-8 lg:grid-cols-[760px_1fr]">
              <AtivoAnotado />
              <PainelDeCriterios />
            </div>
          </div>
        </section>

        {/* ── 6. O que você faz no PortfolioLab ──────────────────────── */}
        <section aria-labelledby="titulo-ferramentas" className="bg-card">
          <div
            className={`${recipiente} grid gap-10 pt-20 pb-20 lg:grid-cols-[400px_1fr] lg:gap-16 lg:pt-[104px] lg:pb-28`}
          >
            <div>
              <h2 id="titulo-ferramentas" className={tituloDeSecao}>
                O que você faz no PortfolioLab
              </h2>
              <p className={`mt-[18px] ${apoioDeSecao}`}>
                Ferramentas para decidir com calma, sempre com a explicação junto.
              </p>
            </div>
            <ul role="list" className="border-t border-pauta">
              {FERRAMENTAS.map((f) => (
                <li key={f.titulo} className="border-b border-pauta pt-[22px] pb-6">
                  <Link
                    href={f.href}
                    className="font-leitura text-[22px] leading-7 font-semibold text-ink decoration-1 underline-offset-4 hover:underline"
                  >
                    {f.titulo}
                  </Link>
                  <p className="mt-1.5 text-[15px] leading-[23px] text-ink-2">{f.descricao}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 7. Chamada final ───────────────────────────────────────── */}
        <section aria-labelledby="titulo-chamada" data-superficie="navy" className="bg-ink text-white">
          <div
            className={`${recipiente} flex flex-col gap-8 py-20 lg:flex-row lg:items-center lg:justify-between`}
          >
            <div className="min-w-0">
              <h2
                id="titulo-chamada"
                className="font-leitura text-[30px] leading-9 font-semibold text-white lg:text-4xl lg:leading-[44px]"
              >
                Comece pela carteira de demonstração
              </h2>
              <p className="mt-3 max-w-[560px] font-leitura text-lg leading-[30px] text-white/78">
                {CONTA_DEMO.ativos} ativos reais e {CONTA_DEMO.transacoes} transações, prontos para você explorar
                antes de montar a sua.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-5">
              <BotaoDemo />
              <Link href={ROTAS.registro} className={linkClaro}>
                Criar minha conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <RodapeSite />
    </>
  );
}
