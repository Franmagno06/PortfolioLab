import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Migalhas, Voltar } from "@/components/ativos/pecas";
import { Revelar } from "@/components/movimento/revelar";
import { BotoesDaFicha } from "@/components/indices/botoes-da-ficha";
import { PainelDoIndice } from "@/components/indices/painel-do-indice";
import {
  ArmadilhaDoIndice,
  BlocoDeArtigo,
  CabecalhoDaFicha,
  CARTAO,
  CartaoLateral,
  CartoesDeNumero,
  DataEFonte,
  NotaDaFonte,
  TextoComDestaques,
  ValorDeHoje,
  Variacao,
  VejaTambem,
} from "@/components/indices/pecas-da-ficha";
import { buscarArtigo } from "@/lib/aprender/artigos";
import { lerDadosDosIndices } from "@/lib/indices-api";
import { numero, percentual } from "@/lib/format";
import { acharIndice, PERGUNTA_DA_FICHA, SLUGS, variacaoComSinal, type Indice } from "@/lib/indices";
import {
  destaqueDoIndice,
  dadosVazios,
  efeitoNoBolso,
  historicoCurtoDoIndice,
  linhaFixaDoResumo,
  notaDaFonte,
  notaDoUltimoPonto,
  paragrafoDeHoje,
  provedorDaApi,
  tabelaDoIndice,
  variacaoEmMeses,
  type TabelaDoIndice,
} from "@/lib/indices-dados";
import { ROTAS } from "@/lib/navegacao";

// Sempre dinâmica, como as páginas de ativos: os dados são lidos no pedido, nunca assados no build com a API fora.
export const revalidate = 0;

// As oito fichas saem prontas do build. Um slug fora da lista cai no notFound() abaixo, que mostra o
// not-found.tsx dos índices (com cabeçalho e saída), e não o 404 genérico do Next.
export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const indice = acharIndice(slug);
  if (!indice) return { title: "Índice não encontrado | PortfolioLab" };
  return {
    title: `${indice.nome}: gráfico e o que o índice mede | PortfolioLab`,
    description: `${indice.nome} (${indice.etiqueta.toLowerCase()}): ${indice.descricao} Gráfico com o histórico, resumo do período e como ler o número.`,
  };
}

/** A tabela própria de cada taxa: mudanças da Selic, IPCA mês a mês, CDI ano a ano. */
function TabelaDaTaxa({ tabela }: { tabela: TabelaDoIndice }) {
  return (
    <section aria-labelledby="tabela-do-indice" className={`${CARTAO} p-6 sm:p-7`}>
      <h2 id="tabela-do-indice" className="font-leitura text-[24px] leading-[32px] font-semibold text-ink sm:text-[28px] sm:leading-[36px]">
        {tabela.titulo}
      </h2>
      <p className="mt-1 text-[13px] leading-[19px] text-mute">{tabela.subtitulo}</p>
      {/* relative: os textos sr-only das células são absolute e, sem isto, escapariam da rolagem e alargariam a página */}
      <div className="relative mt-4 overflow-x-auto rounded-md border border-pauta">
        <table className="w-full min-w-[480px] text-left text-[13px] leading-[19px]">
          <thead className="bg-paper text-xs leading-4 text-ink">
            <tr>
              {tabela.colunas.map((c) => (
                <th key={c} scope="col" className="px-4 py-2.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((linha) => (
              <tr key={linha.chave} className="border-t border-pauta even:bg-[#fafafc]">
                {linha.celulas.map((celula, i) => {
                  const conteudo =
                    celula.variacao === undefined ? celula.texto : <Variacao valor={celula.variacao} texto={celula.texto} neutra />;
                  return i === 0 ? (
                    <th key={i} scope="row" className="tnum px-4 py-2.5 font-medium text-ink">
                      {conteudo}
                    </th>
                  ) : (
                    <td key={i} className="tnum px-4 py-2.5 text-ink">
                      {conteudo}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LinkDoArtigo({ indice }: { indice: Indice }) {
  const artigo = buscarArtigo(indice.artigo);
  if (!artigo) return null;
  return (
    <p className="font-interface text-[15px] leading-[22px] font-medium">
      <Link href={`${ROTAS.aprender}/${artigo.slug}`} className="text-anotacao underline decoration-anotacao/40 decoration-1 underline-offset-4 hover:decoration-anotacao">
        Quer entender melhor? Leia: {artigo.titulo}
        <span aria-hidden>&nbsp;→</span>
      </Link>
    </p>
  );
}

export default async function FichaDoIndice({ params }: Props) {
  const { slug } = await params;
  const indice = acharIndice(slug);
  if (!indice) notFound();
  const lidos = await lerDadosDosIndices();
  const dados = lidos ?? dadosVazios();

  const ehTaxa = indice.tipo === "taxa";
  const maiorPeriodo = indice.periodos[indice.periodos.length - 1] ?? "Max";
  const serie = await provedorDaApi(lidos).getSerie(indice.slug, maiorPeriodo);
  const destaque = destaqueDoIndice(indice, dados);
  const tabela = tabelaDoIndice(indice, dados);
  const v12 = variacaoEmMeses(indice.slug, 12, dados);
  const v60 = variacaoEmMeses(indice.slug, 60, dados);
  const historicoCurto = historicoCurtoDoIndice(indice, dados);

  return (
    <>
      <Migalhas
        itens={[
          { rotulo: "Início", href: ROTAS.inicio },
          { rotulo: "Ativos" },
          { rotulo: "Índices", href: ROTAS.indices },
          { rotulo: indice.nome },
        ]}
      />
      <div className="mt-3">
        <Voltar href={ROTAS.indices} rotulo="Voltar para índices" />
      </div>

      {/*
        A grade da ficha. No computador: o cabeçalho, o gráfico e o texto na coluna da esquerda, e a
        coluna lateral ocupando a altura das três linhas. No celular, uma coluna só, na ordem do DOM:
        cabeçalho, gráfico, lateral (o resumo do período logo abaixo do gráfico) e, por fim, o texto.
      */}
      <div className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_auto_1fr] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <CabecalhoDaFicha
            indice={indice}
            direita={ehTaxa ? <ValorDeHoje indice={indice} valor={destaque.semDados ? null : destaque.valor} atualizadoEm={dados.atualizadoEm} /> : <BotoesDaFicha nome={indice.nome} />}
          />
          {!ehTaxa && (
            <>
              <CartoesDeNumero
                itens={[
                  { rotulo: "Valor atual", texto: destaque.semDados ? "—" : numero(destaque.valor, 2), variacao: null },
                  { rotulo: "Variação em 12 meses", texto: v12 === null ? "—" : variacaoComSinal(v12), variacao: v12 },
                  { rotulo: "Variação em 60 meses", texto: v60 === null ? "—" : variacaoComSinal(v60), variacao: v60 },
                ]}
              />
              <DataEFonte indice={indice} atualizadoEm={dados.atualizadoEm} />
            </>
          )}
        </div>

        <PainelDoIndice
          indice={indice}
          serie={serie}
          hoje={ehTaxa ? percentual(destaque.valor, 2) : numero(destaque.valor, indice.slug === "sp500" ? 2 : 0)}
          linhaFixa={ehTaxa ? linhaFixaDoResumo(indice, dados) : undefined}
          notaDoUltimo={notaDoUltimoPonto(indice, dados)}
          historicoCurto={historicoCurto}
          lateral={
            <>
              {ehTaxa && (
                <CartaoLateral titulo="Como isso afeta o seu bolso">
                  <p className="text-[15px] leading-[22px] text-ink-2">{efeitoNoBolso(indice, dados)}</p>
                </CartaoLateral>
              )}
              <ArmadilhaDoIndice texto={indice.armadilha} />
              <VejaTambem links={indice.veja_tambem} />
            </>
          }
        />

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-3">
          <BlocoDeArtigo titulo={PERGUNTA_DA_FICHA[indice.slug]}>
            {ehTaxa && <TextoComDestaques trechos={paragrafoDeHoje(indice, dados)} />}
            {indice.explicacao.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {indice.comoFunciona && (
              <>
                <h3 className="pt-2 text-[22px] leading-[30px] font-semibold text-ink sm:text-[24px] sm:leading-[32px]">
                  Como ele funciona
                </h3>
                <p>{indice.comoFunciona}</p>
              </>
            )}
            <LinkDoArtigo indice={indice} />
          </BlocoDeArtigo>
          {/* o texto longo nunca entra com animação; só a tabela, que é um bloco curto e separado */}
          {tabela && (
            <Revelar>
              <TabelaDaTaxa tabela={tabela} />
            </Revelar>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Voltar href={ROTAS.indices} rotulo="Voltar para índices" />
      </div>

      <NotaDaFonte>
        {notaDaFonte(indice, dados)}
        {!ehTaxa && " Cotação com atraso de cerca de 15 minutos."} Nada aqui é recomendação de investimento.
      </NotaDaFonte>
    </>
  );
}
