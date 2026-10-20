import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AtivoAnotado, PainelDeCriterios } from "@/components/site/ativo-anotado";
import { BotaoDemo } from "@/components/site/botao-demo";
import { CabecalhoSite } from "@/components/site/cabecalho-site";
import { DesafioAporte } from "@/components/site/desafio-aporte";
import { FolhaDoAporte } from "@/components/site/folha-do-aporte";
import { NumerosDoMesAoVivo, NumerosDoMesFixos } from "@/components/site/numeros-do-mes";
import { RodapeSite } from "@/components/site/rodape-site";
import { APORTE_DO_DESAFIO, CARTEIRA_DE_NOVEMBRO } from "@/lib/carteira-exemplo";
import { brlSemCentavos } from "@/lib/format";
import { ROTAS } from "@/lib/navegacao";
import { CONTA_DEMO, NUMEROS_DO_MES, TRILHAS } from "@/lib/site-dados";

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
  return (
    <>
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>

      <CabecalhoSite />

      <main id="conteudo">
        {/* ── 1. Topo ─────────────────────────────────────────────────── */}
        <section aria-labelledby="titulo-topo" data-superficie="navy" className="bg-ink text-white">
          <div
            className={`${recipiente} flex flex-col gap-12 pt-16 pb-16 lg:grid lg:grid-cols-[536px_568px] lg:gap-12 lg:pt-[104px] lg:pb-14`}
          >
            <div className="space-y-7">
              <h1
                id="titulo-topo"
                className="font-leitura text-[36px] leading-[42px] font-semibold tracking-[-0.015em] text-white lg:text-[52px] lg:leading-[60px]"
              >
                <span className="block">Invista aprendendo.</span>
                <span className="block">Aprenda investindo.</span>
              </h1>
              <p className="max-w-[520px] font-leitura text-lg leading-[29px] text-white/78 lg:text-xl lg:leading-[33px]">
                O PortfolioLab acompanha a sua carteira da B3 e explica cada decisão: onde colocar o aporte do
                mês, quanto você recebe de proventos e o que cada indicador quer dizer. Para construir
                patrimônio com calma, em ativos que você entende.
              </p>
              <div className="flex flex-wrap items-start gap-5 pt-1">
                <BotaoDemo />
                <Link href={ROTAS.registro} className={linkClaro}>
                  Criar minha conta
                </Link>
              </div>
              <p className="text-[13px] text-white/62">
                Gratuito e educacional. Nada aqui é recomendação de investimento.
              </p>
            </div>

            {/* As folhas atravessam a borda da área azul: no desktop a coluna
                tem altura zero e a folha transborda por cima da seção seguinte,
                que compensa com o padding de 168 px no topo. */}
            <div className="relative z-10 lg:h-0">
              <div className="lg:-mt-2">
                <FolhaDoAporte />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Os números do mês ───────────────────────────────────── */}
        <Suspense fallback={<NumerosDoMesFixos />}>
          <NumerosDoMesAoVivo />
        </Suspense>

        {/* ── 3. Por onde começar ────────────────────────────────────── */}
        <section aria-labelledby="titulo-comecar" className="bg-caderno">
          <div
            className={`${recipiente} grid gap-10 pt-20 pb-20 lg:grid-cols-[400px_1fr] lg:gap-16 lg:pt-[104px] lg:pb-28`}
          >
            <div>
              <h2 id="titulo-comecar" className={tituloDeSecao}>
                Por onde começar
              </h2>
              <p className={`mt-[18px] ${apoioDeSecao}`}>
                Trilhas curtas, na ordem em que as dúvidas costumam aparecer. As aulas estão sendo escritas; a
                ordem já está decidida.
              </p>
            </div>

            {/* O único lugar numerado da página: as trilhas são uma sequência */}
            <ol role="list" className="border-t border-pauta">
              {TRILHAS.map((t) => (
                <li key={t.numero} className="flex gap-5 border-b border-pauta pt-5 pb-[22px]">
                  <span aria-hidden className="w-8 shrink-0 font-leitura text-[30px] leading-[34px] text-mute">
                    {t.numero}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                      <h3 className="font-leitura text-[21px] leading-7 font-semibold text-ink">{t.titulo}</h3>
                      <span aria-hidden className="hidden min-w-6 flex-1 border-b border-dotted border-mute sm:block" />
                      <span className="shrink-0 text-sm font-medium text-ink-2">{t.aulas} aulas, em breve</span>
                    </div>
                    <p className="mt-1.5 text-[15px] leading-[22px] text-ink-2">{t.descricao}</p>
                  </div>
                </li>
              ))}
            </ol>
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
