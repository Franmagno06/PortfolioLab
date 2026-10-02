import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BotaoDemo } from "@/components/site/botao-demo";
import { DesafioAporte } from "@/components/site/desafio-aporte";
import { Marca, Wordmark } from "@/components/ui/marca";
import { CARTEIRA_EXEMPLO, pesoPorClasse } from "@/lib/carteira-exemplo";
import { coresClasse } from "@/lib/format";
import telaDashboard from "./telas/dashboard.jpg";
import telaSimulacao from "./telas/simulacao.jpg";

export const metadata: Metadata = {
  title: "PortfolioLab — sua carteira da B3, com o próximo aporte calculado",
  description:
    "Organize ações, fundos imobiliários e ETFs, descubra onde colocar o aporte do mês para chegar às suas metas e entenda cada número no caminho. Gratuito e educacional.",
};

// Página estática: nada aqui depende de quem está vendo. Quem já tem sessão e
// clica em "Entrar" é levado ao dashboard pelo proxy.

const secoes = [
  { id: "o-que-e", rotulo: "O que é" },
  { id: "desafio", rotulo: "Desafio do aporte" },
  { id: "ferramentas", rotulo: "Ferramentas" },
  { id: "aprender", rotulo: "Aprender" },
];

const NOME_CLASSE = { FII: "Fundos imobiliários", ACAO: "Ações", ETF: "ETFs" } as const;

// A fita do topo usa a carteira do desafio: é a mesma carteira que o visitante
// vai consertar logo abaixo.
const pesos = pesoPorClasse(CARTEIRA_EXEMPLO);

function umaCasa(valor: number) {
  return valor.toFixed(0);
}

function Fita({ rotulo, campo }: { rotulo: string; campo: "atual" | "meta" }) {
  return (
    <div>
      <p className="mb-2 text-sm text-white/70">{rotulo}</p>
      <div className="flex h-11 gap-0.5 overflow-hidden rounded-lg">
        {pesos.map((p) => (
          <div
            key={p.classe}
            className="flex items-center px-3 text-sm font-semibold text-white"
            style={{ width: `${p[campo]}%`, background: coresClasse[p.classe] }}
          >
            <span className="tnum font-mono">{umaCasa(p[campo])}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const conceitos = [
  {
    termo: "Preço médio",
    explicacao:
      "Quanto você pagou, em média, por cada cota, contando as taxas. É a régua do seu resultado: acima dele você está ganhando, abaixo, perdendo.",
    exemplo:
      "Comprou 10 cotas a R$ 10 e depois 10 a R$ 12: seu preço médio é R$ 11, não o preço de hoje.",
  },
  {
    termo: "P/VP",
    explicacao:
      "Preço da cota dividido pelo valor patrimonial dela. Diz quanto o mercado paga por cada real que o fundo ou a empresa tem de patrimônio.",
    exemplo:
      "P/VP de 0,90 quer dizer que a cota custa 90 centavos para cada R$ 1 de patrimônio. Não é sinal de barato por si só: pode ser desconfiança do mercado.",
  },
  {
    termo: "Dividend yield",
    explicacao:
      "Quanto o ativo pagou em proventos nos últimos 12 meses, em relação ao preço. Olha para trás, não promete o futuro.",
    exemplo: "Uma cota de R$ 100 que pagou R$ 9 em um ano tem dividend yield de 9%.",
  },
  {
    termo: "Rebalanceamento por aporte",
    explicacao:
      "Em vez de vender o que passou da meta, você corrige a carteira com o dinheiro novo, direcionando cada aporte para quem ficou para trás.",
    exemplo: "É exatamente o que o desafio acima pede, e o que a simulação do PortfolioLab calcula.",
  },
];

export default function SitePage() {
  return (
    <div className="bg-paper">
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <header data-superficie="navy" className="sticky top-0 z-20 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-white">
            <Marca tamanho={24} />
            <Wordmark className="text-lg" />
          </Link>
          <nav aria-label="Seções da página" className="hidden flex-1 lg:block">
            <ul className="flex gap-1">
              {secoes.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="rounded-md px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {s.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-semibold text-white/85 hover:text-white"
            >
              Entrar
            </Link>
            <div className="hidden sm:block">
              <BotaoDemo compacto rotulo="Ver a demonstração" />
            </div>
          </div>
        </div>
      </header>

      <main id="conteudo">
        {/* ── O que é ──────────────────────────────────────────────────── */}
        <section id="o-que-e" data-superficie="navy" className="bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-24 lg:pb-28">
            <div>
              <h1 className="max-w-xl text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Saiba onde colocar o aporte do mês, e entenda por quê.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80">
                O PortfolioLab reúne suas ações, fundos imobiliários e ETFs da B3, mostra quanto cada
                um pesa na carteira e calcula quanto comprar de cada ativo para chegar às metas que
                você definiu.
              </p>
              <div className="mt-9 flex flex-wrap items-start gap-4">
                <BotaoDemo />
                <Link
                  href="/registro"
                  className="rounded-lg border border-white/30 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Criar minha conta
                </Link>
              </div>
              <p className="mt-6 max-w-md text-sm text-white/60">
                Gratuito e educacional. A demonstração já vem com 16 ativos reais; nada aqui é
                recomendação de investimento.
              </p>
            </div>

            {/* O conceito do produto numa imagem: a carteira de hoje contra a
                carteira desejada. As cores são as classes de ativo da marca. */}
            <figure className="rounded-2xl border border-white/10 bg-white/4 p-6 sm:p-8">
              <div className="space-y-6">
                <Fita rotulo="Carteira de exemplo, hoje" campo="atual" />
                <Fita rotulo="As metas definidas para ela" campo="meta" />
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
                {pesos.map((p) => (
                  <li key={p.classe} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: coresClasse[p.classe] }}
                    />
                    {NOME_CLASSE[p.classe]}
                  </li>
                ))}
              </ul>
              <figcaption className="mt-6 border-t border-white/10 pt-5 text-sm leading-relaxed text-white/70">
                Os fundos imobiliários passaram da meta e as ações ficaram para trás. Com R$ 1.000,
                dá para aproximar as duas fitas sem vender nada. Tente logo abaixo.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── Desafio do aporte ───────────────────────────────────────── */}
        <section id="desafio">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Desafio do aporte</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                Você tem R$ 1.000 para esta carteira de exemplo. Monte a compra que deixa a carteira
                mais perto das metas e depois compare com o que o PortfolioLab faria.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-mute">
                Os ativos são reais e os preços são uma referência fixa de outubro de 2026; as
                quantidades foram inventadas para o exemplo. &ldquo;Fora das metas&rdquo; conta
                quantos pontos percentuais da carteira estão no lugar errado: zero é a carteira igual
                às metas.
              </p>
            </div>
            <div className="mt-10">
              <DesafioAporte />
            </div>
          </div>
        </section>

        {/* ── Ferramentas ─────────────────────────────────────────────── */}
        <section id="ferramentas" className="border-t border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              O que você faz no PortfolioLab
            </h2>

            <div className="mt-14 space-y-20">
              <article className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">
                    Veja a carteira inteira num lugar só
                  </h3>
                  <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
                    Registre compras e vendas e o resto é calculado: preço médio pela regra da Receita,
                    resultado de cada ativo, proventos recebidos e quanto cada classe pesa no total.
                  </p>
                </div>
                <Image
                  src={telaDashboard}
                  alt="Dashboard do PortfolioLab com patrimônio de R$ 173 mil, alocação por classe e os ativos mais longe da meta"
                  sizes="(min-width: 1024px) 640px, 100vw"
                  placeholder="blur"
                  className="rounded-xl border border-line shadow-[0_24px_48px_-24px_rgb(14_27_51/0.35)]"
                />
              </article>

              <article className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
                <Image
                  src={telaSimulacao}
                  alt="Simulação de aporte de R$ 1.000 mostrando o que comprar e a alocação antes e depois"
                  sizes="(min-width: 1024px) 640px, 100vw"
                  placeholder="blur"
                  className="rounded-xl border border-line shadow-[0_24px_48px_-24px_rgb(14_27_51/0.35)] lg:order-first"
                />
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">
                    Saiba o que comprar no próximo aporte
                  </h3>
                  <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
                    Defina a meta de cada ativo e informe quanto vai investir. A simulação diz quantas
                    cotas comprar de cada um e mostra como a carteira fica depois, sempre em cotas
                    inteiras.
                  </p>
                </div>
              </article>

              <div className="grid gap-6 md:grid-cols-2">
                <article className="rounded-2xl border border-line p-7">
                  <h3 className="text-xl font-semibold tracking-tight">
                    Leia relatórios sem passar a tarde neles
                  </h3>
                  <p className="mt-3 leading-relaxed text-ink-soft">
                    Envie o PDF do relatório gerencial de um fundo ou do release trimestral de uma
                    empresa. A IA resume, aponta os alertas e responde às suas perguntas sobre o
                    documento.
                  </p>
                </article>
                <article className="rounded-2xl border border-line p-7">
                  <h3 className="text-xl font-semibold tracking-tight">
                    Acompanhe indicadores e notícias dos seus ativos
                  </h3>
                  <p className="mt-3 leading-relaxed text-ink-soft">
                    P/L, P/VP, ROE e margem das ações da sua carteira, e as notícias do mercado com
                    destaque para as que citam o que você tem.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* ── Aprender ────────────────────────────────────────────────── */}
        <section id="aprender" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Os números da tela, explicados
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                Investir começa por entender o que se está olhando. Estes são alguns dos conceitos que
                aparecem no PortfolioLab.
              </p>
            </div>
            <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {conceitos.map((c) => (
                <div key={c.termo} className="border-t-2 border-ink pt-5">
                  <dt className="text-xl font-semibold tracking-tight">{c.termo}</dt>
                  <dd className="mt-2 leading-relaxed text-ink-soft">{c.explicacao}</dd>
                  <dd className="mt-3 text-sm leading-relaxed text-mute">{c.exemplo}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Chamada final ───────────────────────────────────────────── */}
        <section data-superficie="navy" className="bg-ink text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold tracking-tight">
                Comece pela carteira de demonstração
              </h2>
              <p className="mt-3 leading-relaxed text-white/75">
                16 ativos reais, 27 transações e metas que fecham 100%. Mexa à vontade antes de montar
                a sua.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <BotaoDemo />
              <Link
                href="/registro"
                className="rounded-lg border border-white/30 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Criar minha conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Azul, e não papel: o "Lab" do wordmark é menta, que só tem contraste sobre navy */}
      <footer data-superficie="navy" className="border-t border-white/10 bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2 text-white">
            <Marca tamanho={18} />
            <Wordmark />
          </span>
          <p className="max-w-xl">
            Projeto educacional. Nada aqui é recomendação de investimento. Cotações da B3 via Yahoo
            Finance, com atraso.
          </p>
        </div>
      </footer>
    </div>
  );
}
