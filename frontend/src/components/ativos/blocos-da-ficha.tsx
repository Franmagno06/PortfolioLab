import Link from "next/link";
import { Dica } from "@/components/ativos/dica";
import { Anotacao, Avatar, VariacaoDoDia } from "@/components/ativos/pecas";
import { Secao } from "@/components/ativos/secao";
import type { TipoFii } from "@/lib/ativos-catalogo";
import type { FaixaDaCarteira, NoticiaDoAtivo, Provento, ResultadoTrimestral } from "@/lib/ativos-fichas";
import { brl, dataCurta, numero } from "@/lib/format";
import type { IdDaDica } from "@/lib/indicadores-explicados";
import { ROTAS } from "@/lib/navegacao";

/** Os blocos da ficha que não dependem da classe do ativo: a ação e o FII usam os mesmos. */

const chip = "inline-flex items-center gap-1 rounded-full bg-marca-texto px-2.5 py-1 text-[13px] font-medium text-anotacao";

export function CabecalhoDoAtivo({
  ticker,
  nome,
  chips,
  preco,
  variacaoDia,
  fechamentoEm,
  tipoFii,
}: {
  ticker: string;
  nome: string;
  /** Setor e espécie, ou tipo e segmento: cada um é um chip, e o "?" vai dentro do chip. */
  chips: { rotulo: string; dica?: IdDaDica }[];
  preco: number;
  variacaoDia: number;
  fechamentoEm: string;
  /** Só no FII: escolhe o ícone do avatar. Ação usa o logo da empresa. */
  tipoFii?: TipoFii;
}) {
  return (
    <header className="rounded-md border border-line bg-card px-6 py-5 md:flex md:items-center md:justify-between md:gap-8">
      <div className="flex items-center gap-4 md:gap-5">
        <Avatar ticker={ticker} tamanho="ficha" tipoFii={tipoFii} />
        <div className="min-w-0">
          <h1 className="font-leitura text-[34px] leading-[40px] font-semibold tracking-[-0.01em] text-balance text-ink md:text-4xl md:leading-[44px]">
            {ticker}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[15px] text-ink-2">{nome}</span>
            {chips.map((c) => (
              <span key={c.rotulo} className={chip}>
                {c.rotulo}
                {c.dica && <Dica id={c.dica} />}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 md:mt-0 md:text-right">
        <p className="tnum text-[32px] leading-10 font-semibold tracking-[-0.01em] text-ink">{brl(preco)}</p>
        <p className="mt-1 text-sm text-mute">
          <VariacaoDoDia valor={variacaoDia} /> hoje · fechamento de {dataCurta(fechamentoEm)}
        </p>
      </div>
    </header>
  );
}

export function BotaoRegistrarCompra() {
  return (
    <Link
      href={ROTAS.carteira}
      className="block rounded bg-ink px-4 py-3 text-center text-[15px] font-semibold text-white hover:bg-ink-lift"
    >
      Registrar compra
    </Link>
  );
}

export function ResultadosTrimestrais({ linhas }: { linhas: ResultadoTrimestral[] }) {
  return (
    <Secao
      id="resultados"
      titulo="Resultados trimestrais"
      subtitulo="Lucro e patrimônio de cada trimestre, em R$ bilhões. Dados de exemplo no formato da CVM (ITR)."
      estado={linhas.length === 0 ? "vazio" : "pronto"}
      vazio={<p className="text-sm text-ink-2">A CVM ainda não publicou resultados para este ativo.</p>}
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Lucro líquido e patrimônio líquido por trimestre, em bilhões de reais</caption>
        <thead>
          <tr className="text-xs text-mute">
            <th scope="col" className="pb-2 text-left font-medium">Trimestre</th>
            <th scope="col" className="pb-2 text-right font-medium">Lucro líquido</th>
            <th scope="col" className="pb-2 text-right font-medium">Patrimônio líquido</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.periodo} className="border-t border-line">
              <th scope="row" className="py-3 text-left text-[15px] font-normal text-ink">{l.periodo}</th>
              <td className="tnum py-3 text-right text-[15px] text-ink">{numero(l.lucroLiquido, 1)}</td>
              <td className="tnum py-3 text-right text-[15px] text-ink">{numero(l.patrimonioLiquido, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Anotacao className="mt-4">Olhe a tendência ao longo dos trimestres, não um trimestre isolado.</Anotacao>
    </Secao>
  );
}

export function ComposicaoDoFundo({ faixas, leitura }: { faixas: FaixaDaCarteira[]; leitura: string }) {
  // Cada tipo de ativo do fundo tem a cor da sua classe no resto do site.
  const corDa = (rotulo: string) =>
    rotulo.startsWith("CRI") ? "var(--color-fii)" : rotulo.startsWith("Cotas") ? "var(--color-etf)" : rotulo.startsWith("Renda") ? "var(--color-rf)" : "var(--color-acao)";
  const ordenadas = [...faixas].sort((a, b) => b.pct - a.pct);

  return (
    <Secao
      id="composicao"
      titulo="Composição da carteira do fundo"
      subtitulo="Em % do patrimônio. Dados de exemplo no formato do informe mensal da CVM."
    >
      <ul className="space-y-4">
        {ordenadas.map((f) => (
          <li key={f.rotulo}>
            <div className="flex items-baseline justify-between gap-4 text-[15px]">
              <span className="text-ink">{f.rotulo}</span>
              <span className="tnum font-semibold text-ink">{numero(f.pct)}%</span>
            </div>
            <div aria-hidden className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${f.pct}%`, background: corDa(f.rotulo) }} />
            </div>
          </li>
        ))}
      </ul>
      <Anotacao className="mt-5">{leitura}</Anotacao>
    </Secao>
  );
}

export function ProventosDoAtivo({
  titulo,
  subtitulo,
  proventos,
}: {
  titulo: string;
  subtitulo: string;
  proventos: Provento[];
}) {
  return (
    <Secao
      id="proventos"
      titulo={titulo}
      subtitulo={subtitulo}
      estado={proventos.length === 0 ? "vazio" : "pronto"}
      vazio={<p className="text-sm text-ink-2">Nenhum provento nos últimos 12 meses.</p>}
    >
      <ul>
        {proventos.map((p) => (
          <li key={p.dataEx} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
            <div>
              <p className="tnum text-[15px] text-ink">{dataCurta(p.dataEx)}</p>
              <p className="text-xs text-mute">
                data-ex · {p.tipo}
              </p>
            </div>
            <p className="tnum text-[15px] font-semibold text-ink">{brl(p.valor)}</p>
          </li>
        ))}
      </ul>
    </Secao>
  );
}

export function NoticiasDoAtivo({ ticker, noticias }: { ticker: string; noticias: NoticiaDoAtivo[] }) {
  return (
    <Secao
      id="noticias"
      titulo={`Notícias sobre ${ticker}`}
      subtitulo="Manchetes de exemplo. As reais virão do feed de notícias do site."
      estado={noticias.length === 0 ? "vazio" : "pronto"}
      vazio={<p className="text-sm text-ink-2">Nenhuma notícia recente cita {ticker}.</p>}
    >
      <ul>
        {noticias.map((n) => {
          const titulo = <span className="text-[15px] leading-[22px] font-medium text-ink">{n.titulo}</span>;
          return (
            <li key={n.titulo} className="border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
              {n.url ? (
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="rounded underline-offset-4 hover:underline">
                  {titulo}
                </a>
              ) : (
                titulo
              )}
              <p className="mt-1 text-xs text-mute">
                {n.fonte} · {dataCurta(n.publicadaEm)}
              </p>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

/** Os relatórios que a pessoa enviou sobre este ativo. Sem login não há nenhum: o estado vazio leva à tela de Relatórios. */
export function RelatoriosDoAtivo({ ticker, tipo }: { ticker: string; tipo: "empresa" | "fundo" }) {
  return (
    <Secao
      id="relatorios"
      titulo={`Relatórios de ${ticker}`}
      estado="vazio"
      vazio={
        <div className="rounded bg-marca-texto p-4">
          <p className="text-[15px] leading-[22px] font-medium text-ink">
            Você ainda não enviou nenhum relatório {tipo === "empresa" ? "desta empresa" : "deste fundo"}.
          </p>
          <p className="mt-2 text-[13px] leading-[19px] text-ink-2">
            Envie {tipo === "empresa" ? "o release" : "o relatório gerencial"} em PDF na tela de Relatórios e a análise
            aparece aqui.
          </p>
          <Link
            href={ROTAS.relatorios}
            className="mt-3 inline-flex min-h-11 items-center rounded border border-ink bg-card px-4 text-sm font-semibold text-ink hover:bg-caderno"
          >
            Ir para Relatórios
          </Link>
        </div>
      }
    />
  );
}
