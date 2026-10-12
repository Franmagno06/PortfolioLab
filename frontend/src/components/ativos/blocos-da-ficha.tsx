import Link from "next/link";
import { Dica } from "@/components/ativos/dica";
import { Anotacao, Avatar, VariacaoDoDia } from "@/components/ativos/pecas";
import { Secao, type EstadoDaSecao } from "@/components/ativos/secao";
import type { Bloco, ComposicaoDoFundo as Composicao, FiiFicha, ResultadoTrimestral, TipoFii } from "@/lib/ativos-tipos";
import { brl, brlOuTraco, dataCurta, dataDeLeitura, mesAno, numero } from "@/lib/format";
import type { IdDaDica } from "@/lib/indicadores-explicados";
import { ROTAS } from "@/lib/navegacao";

/** Os blocos da ficha que não dependem da classe do ativo: a ação e o FII usam os mesmos. */

const chip = "inline-flex items-center gap-1 rounded-full bg-marca-texto px-2.5 py-1 text-[13px] font-medium text-anotacao";

/**
 * Como a seção se apresenta para o que a fonte devolveu: sem dado nenhum é erro (a fonte estava fora
 * do ar e nunca foi lida), lista vazia é "vazio" (a fonte respondeu e não há nada), o resto é pronto.
 */
export function estadoDoBloco<T>(bloco: Bloco<T>, estaVazio: (dados: T) => boolean): EstadoDaSecao {
  if (bloco.dados === null) return "erro";
  return estaVazio(bloco.dados) ? "vazio" : "pronto";
}

const listaVazia = (d: unknown[]) => d.length === 0;

/** De onde vêm os números e de quando são; se a última leitura falhou, avisa que podem estar defasados. */
export function NotaDaFonte({
  fonte,
  estado,
  atualizadoEm,
  className = "mt-4",
}: {
  fonte: string;
  estado: Bloco<unknown>["estado"];
  atualizadoEm: string | null;
  className?: string;
}) {
  return (
    <p className={`${className} text-xs leading-[18px] text-mute`}>
      Fonte: {fonte}
      {atualizadoEm && `, lido em ${dataDeLeitura(atualizadoEm)}`}.
      {estado === "desatualizado" && " A fonte não respondeu na última tentativa, então estes dados podem estar defasados."}
    </p>
  );
}

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
  preco: number | null;
  variacaoDia: number | null;
  fechamentoEm: string | null;
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
        <p className="tnum text-[32px] leading-10 font-semibold tracking-[-0.01em] text-ink">{brlOuTraco(preco)}</p>
        <p className="mt-1 text-sm text-mute">
          {preco === null ? (
            "O Yahoo Finance não informou o preço agora."
          ) : (
            <>
              <VariacaoDoDia valor={variacaoDia} />
              {fechamentoEm ? ` · fechamento de ${dataCurta(fechamentoEm)}` : " · último preço conhecido, sem data de fechamento"}
            </>
          )}
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

/** A CVM publica em reais; a tabela mostra em bilhões, com duas casas, que cabe até nas empresas menores. */
const bilhoes = (reais: number) => numero(reais / 1_000_000_000, 2);

export function ResultadosTrimestrais({ bloco }: { bloco: Bloco<ResultadoTrimestral[]> }) {
  const linhas = bloco.dados ?? [];

  return (
    <Secao
      id="resultados"
      titulo="Resultados trimestrais"
      subtitulo="Lucro e patrimônio de cada trimestre, em R$ bilhões, como a empresa informou à CVM (ITR e DFP)."
      estado={estadoDoBloco(bloco, listaVazia)}
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
              <td className="tnum py-3 text-right text-[15px] text-ink">{bilhoes(l.lucroLiquido)}</td>
              <td className="tnum py-3 text-right text-[15px] text-ink">{bilhoes(l.patrimonioLiquido)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Anotacao className="mt-4">Olhe a tendência ao longo dos trimestres, não um trimestre isolado.</Anotacao>
      <NotaDaFonte fonte="CVM (dados abertos)" estado={bloco.estado} atualizadoEm={bloco.atualizadoEm} />
    </Secao>
  );
}

/** As cinco partes do informe mensal, na cor da classe de ativo que representam no resto do site. */
const FAIXAS: { chave: keyof Composicao; rotulo: string; cor: string }[] = [
  { chave: "imoveis", rotulo: "Imóveis", cor: "var(--color-acao)" },
  { chave: "papel", rotulo: "CRI e outros títulos de dívida (papel)", cor: "var(--color-fii)" },
  { chave: "cotasDeFii", rotulo: "Cotas de outros FIIs", cor: "var(--color-etf)" },
  { chave: "liquidez", rotulo: "Renda fixa e caixa (liquidez)", cor: "var(--color-rf)" },
  { chave: "outros", rotulo: "Outros", cor: "var(--color-mute)" },
];

export function ComposicaoDoFundo({
  bloco,
  informe,
  leitura,
}: {
  bloco: Bloco<Composicao>;
  informe: FiiFicha["informe"];
  leitura: string;
}) {
  const faixas = bloco.dados
    ? FAIXAS.map((f) => ({ ...f, pct: bloco.dados?.[f.chave] ?? 0 }))
        .filter((f) => f.pct > 0)
        .sort((a, b) => b.pct - a.pct)
    : [];

  return (
    <Secao
      id="composicao"
      titulo="Composição da carteira do fundo"
      subtitulo={`Em % do ativo total do fundo${informe.competencia ? `, no informe mensal de ${mesAno(informe.competencia)}` : ""}.`}
      estado={estadoDoBloco(bloco, () => faixas.length === 0)}
      vazio={<p className="text-sm text-ink-2">O informe mensal da CVM não trouxe a composição deste fundo.</p>}
    >
      <ul className="space-y-4">
        {faixas.map((f) => (
          <li key={f.chave}>
            <div className="flex items-baseline justify-between gap-4 text-[15px]">
              <span className="text-ink">{f.rotulo}</span>
              <span className="tnum font-semibold text-ink">{numero(f.pct, 1)}%</span>
            </div>
            <div aria-hidden className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${Math.min(f.pct, 100)}%`, background: f.cor }} />
            </div>
          </li>
        ))}
      </ul>
      <Anotacao className="mt-5">{leitura}</Anotacao>
      <NotaDaFonte fonte="informe mensal de FII da CVM" estado={bloco.estado} atualizadoEm={bloco.atualizadoEm} />
    </Secao>
  );
}

export function ProventosDoAtivo({
  titulo,
  subtitulo,
  bloco,
}: {
  titulo: string;
  subtitulo: string;
  bloco: Bloco<{ dataEx: string; valor: number }[]>;
}) {
  const proventos = bloco.dados ?? [];

  return (
    <Secao
      id="proventos"
      titulo={titulo}
      subtitulo={subtitulo}
      estado={estadoDoBloco(bloco, listaVazia)}
      vazio={<p className="text-sm text-ink-2">Nenhum provento nos últimos 12 meses.</p>}
    >
      <ul>
        {proventos.map((p) => (
          <li key={p.dataEx} className="flex items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
            <div>
              <p className="tnum text-[15px] text-ink">{dataCurta(p.dataEx)}</p>
              <p className="text-xs text-mute">data-ex</p>
            </div>
            <p className="tnum text-[15px] font-semibold text-ink">{brl(p.valor)}</p>
          </li>
        ))}
      </ul>
      <NotaDaFonte fonte="Yahoo Finance" estado={bloco.estado} atualizadoEm={bloco.atualizadoEm} />
    </Secao>
  );
}

export function NoticiasDoAtivo({
  ticker,
  bloco,
}: {
  ticker: string;
  bloco: Bloco<{ titulo: string; fonte: string; publicadaEm: string; url: string }[]>;
}) {
  const noticias = bloco.dados ?? [];

  return (
    <Secao
      id="noticias"
      titulo={`Notícias sobre ${ticker}`}
      subtitulo="Manchetes dos últimos dias que citam o ativo, nos feeds públicos de portais de economia. O link abre o site de quem publicou."
      estado={estadoDoBloco(bloco, listaVazia)}
      vazio={<p className="text-sm text-ink-2">Nenhuma notícia recente cita {ticker}.</p>}
    >
      <ul>
        {noticias.map((n) => (
          <li key={n.url} className="border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="rounded underline-offset-4 hover:underline">
              <span className="text-[15px] leading-[22px] font-medium text-ink">{n.titulo}</span>
            </a>
            <p className="mt-1 text-xs text-mute">
              {n.fonte} · {dataDeLeitura(n.publicadaEm)}
            </p>
          </li>
        ))}
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
