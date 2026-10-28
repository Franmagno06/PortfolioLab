import type { Metadata } from "next";
import Link from "next/link";
import { Anotacao, Migalhas } from "@/components/ativos/pecas";
import { CardDeIndice } from "@/components/indices/card-de-indice";
import { OrdenarIndices } from "@/components/indices/ordenar-indices";
import { NotaDaFonte } from "@/components/indices/pecas-da-ficha";
import { MensagemAviso } from "@/components/ui/mensagem";
import { CATEGORIAS, lerCategoria, lerOrdem, type Categoria } from "@/lib/indices";
import { lerDadosDosIndices } from "@/lib/indices-api";
import { algumIndiceSemDados, dadosVazios, destaqueDoIndice, ordenarEFiltrar, provedorDaApi } from "@/lib/indices-dados";
import { ROTAS } from "@/lib/navegacao";

export const metadata: Metadata = {
  title: "Índices: Selic, IPCA, CDI, Ibovespa e outros | PortfolioLab",
  description:
    "Os termômetros da economia e da bolsa: juros, inflação e os principais índices de ações e de fundos imobiliários, cada um com gráfico e explicação.",
};

// Sempre dinâmica, como as páginas de ativos: lida no pedido (e guardada 2 min pelo fetch), nunca assada no build com a API fora.
export const revalidate = 0;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** O endereço de um chip: troca a categoria e mantém a ordem escolhida. */
function hrefDaCategoria(categoria: Categoria | null, ordem: string) {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (ordem !== "buscados") params.set("ordem", ordem);
  const busca = params.toString();
  return busca ? `${ROTAS.indices}?${busca}` : ROTAS.indices;
}

export default async function IndicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const ordem = lerOrdem(params.ordem);
  const categoria = lerCategoria(params.categoria);
  const lidos = await lerDadosDosIndices();
  const dados = lidos ?? dadosVazios();
  const todos = await provedorDaApi(lidos).listarIndices();
  const visiveis = ordenarEFiltrar(todos, ordem, categoria, dados);

  const chips = [
    { id: null, rotulo: "Todos", total: todos.length },
    ...CATEGORIAS.map((c) => ({ id: c.id, rotulo: c.rotulo, total: todos.filter((i) => i.categoria === c.id).length })),
  ];

  return (
    <>
      <Migalhas itens={[{ rotulo: "Início", href: ROTAS.inicio }, { rotulo: "Ativos" }, { rotulo: "Índices" }]} />

      <div className="mt-6 mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <header className="max-w-[700px]">
          <h1 className="font-leitura text-[34px] leading-[42px] font-semibold tracking-[-0.01em] text-balance text-ink lg:text-[40px] lg:leading-[48px]">
            Índices
          </h1>
          <p className="mt-2 text-base leading-[26px] text-ink-2">
            Os termômetros da economia e da bolsa: juros, inflação e o desempenho de carteiras de referência de ações e
            de fundos imobiliários. Clique num índice para ver o gráfico e entender o que ele mede.
          </p>
          <Anotacao className="mt-3">Toque no “?” de cada card: ele explica o número em uma frase.</Anotacao>
        </header>
        <OrdenarIndices ordem={ordem} categoria={categoria} />
      </div>

      <nav aria-label="Categorias de índices" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const ativo = chip.id === categoria;
            return (
              <li key={chip.rotulo}>
                <Link
                  href={hrefDaCategoria(chip.id, ordem)}
                  aria-current={ativo ? "true" : undefined}
                  scroll={false}
                  className={`toque inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] leading-[22px] font-semibold ${
                    ativo ? "border-ink bg-ink text-white" : "border-pauta bg-card text-ink hover:border-ink focus-visible:border-ink"
                  }`}
                >
                  {chip.rotulo} ({chip.total})
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="sr-only" role="status">
        {visiveis.length} {visiveis.length === 1 ? "índice" : "índices"} na lista.
      </p>

      {!lidos ? (
        <div className="mb-5">
          <MensagemAviso titulo="Não conseguimos buscar os índices agora. Tente de novo em alguns minutos." />
        </div>
      ) : (
        algumIndiceSemDados(todos, dados) && (
          <div className="mb-5">
            <MensagemAviso titulo="Não conseguimos buscar alguns índices agora. Os que estão com “—” voltam em alguns minutos." />
          </div>
        )
      )}

      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {visiveis.map((indice) => (
          <li key={indice.slug} className="flex">
            <CardDeIndice indice={indice} destaque={destaqueDoIndice(indice, dados)} />
          </li>
        ))}
      </ul>

      <NotaDaFonte>
        Selic, CDI e IPCA vêm do Banco Central (SGS); Ibovespa, IFIX, Small Caps, IDIV e S&amp;P 500, via Yahoo Finance. Cada ficha mostra a fonte e a data do último dado. Nada aqui é recomendação de investimento.
      </NotaDaFonte>
    </>
  );
}
