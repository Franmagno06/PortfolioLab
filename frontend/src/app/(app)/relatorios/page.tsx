"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { estiloCampo } from "@/components/ui/campo";
import { Card, TituloCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EtiquetaClasse } from "@/components/ui/etiqueta-classe";
import { MensagemErro } from "@/components/ui/mensagem";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError, type Pagina } from "@/lib/api";
import { dataCurta } from "@/lib/format";
import {
  agruparPorAtivo,
  blocosDoResumo,
  gruposDePontos,
  periodoAnterior,
  relatoriosAntigos,
  rotuloDoPeriodo,
  tabelaComparativa,
  type Analise,
  type GrupoDeAtivo,
  type GrupoDePontos,
  type Relatorio,
} from "@/lib/relatorios";

/*
 * Por que existe: reúne, para os ativos da pessoa, o que a empresa ou o fundo entregou à CVM em cada
 * período, e põe um período ao lado do outro. O número de um trimestre sozinho diz pouco; a tabela é o
 * centro da tela. Tudo vem dos dados abertos da CVM pelo backend: a tela não calcula nem interpreta.
 *
 * A conta de demonstração é somente leitura: nela os relatórios já vêm carregados e os controles que
 * gravam (buscar, carregar período, apagar) não aparecem, em vez de aparecerem para devolver 403.
 */

/**
 * A cor da barra de cada grupo de pontos. O título do grupo diz o que ele é; a cor só repete o título.
 * Destaque usa o verde de alta: diz a direção do número (subiu), não que a empresa vai bem.
 */
const barraDoGrupo: Record<GrupoDePontos["chave"], string> = {
  destaque: "var(--color-gain)",
  atencao: "var(--color-etf)",
  critico: "var(--color-loss)",
  info: "var(--color-fii)",
};

/** Um por conta é o teto do backend (COTA_RELATORIOS); cabe numa página só. */
const LIMITE_DA_LISTA = 50;

type Selecao = { tipo: "ativo"; ticker: string; periodo: string | null } | { tipo: "antigo"; id: string };

export default function RelatoriosPage() {
  const [relatorios, setRelatorios] = useState<Relatorio[] | null>(null);
  const [erroDaLista, setErroDaLista] = useState(false);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [ticker, setTicker] = useState("");
  const [meusAtivos, setMeusAtivos] = useState<{ ticker: string }[]>([]);
  const [demo, setDemo] = useState(false);
  /** O que está sendo buscado na CVM agora: "BBAS3" ou "BBAS3 1T26". Uma busca por vez. */
  const [buscando, setBuscando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [confirmandoApagar, setConfirmandoApagar] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let ativo = true;
    api<Pagina<Relatorio>>(`/reports?limite=${LIMITE_DA_LISTA}`)
      .then(({ itens }) => {
        if (ativo) setRelatorios(itens);
      })
      .catch(() => {
        if (ativo) setErroDaLista(true);
      });
    // sugestões do campo: os ativos da carteira. Qualquer ação ou FII da B3 é aceito.
    api<{ ticker: string }[]>("/assets")
      .then((lista) => {
        if (ativo) setMeusAtivos(lista);
      })
      .catch(() => undefined);
    api<{ demo: boolean }>("/auth/me")
      .then((eu) => {
        if (ativo) setDemo(eu.demo === true);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  // ao abrir a confirmação, o foco vai para o lado seguro
  useEffect(() => {
    if (confirmandoApagar) cancelarRef.current?.focus();
  }, [confirmandoApagar]);

  const grupos = useMemo(() => agruparPorAtivo(relatorios ?? []), [relatorios]);
  const antigos = useMemo(() => relatoriosAntigos(relatorios ?? []), [relatorios]);

  // sem escolha feita (ou com a escolha apagada), vale o primeiro ativo da lista
  const grupo: GrupoDeAtivo | null =
    selecao?.tipo === "antigo" ? null : (grupos.find((g) => g.ticker === selecao?.ticker) ?? grupos[0] ?? null);
  const antigo = selecao?.tipo === "antigo" ? (antigos.find((r) => r.id === selecao.id) ?? null) : null;
  const periodoEscolhido = selecao?.tipo === "ativo" ? selecao.periodo : null;
  const relatorio = grupo ? (grupo.periodos.find((p) => p.period === periodoEscolhido) ?? grupo.periodos[0] ?? null) : antigo;

  async function buscar(tickerPedido: string, periodo?: string) {
    const alvo = tickerPedido.trim().toUpperCase();
    if (!alvo || buscando) return;
    setErro(null);
    setAviso("");
    setConfirmandoApagar(null);
    setBuscando(periodo ? `${alvo} ${rotuloDoPeriodo(periodo)}` : alvo);
    try {
      const novo = await api<Relatorio>("/reports", {
        method: "POST",
        body: JSON.stringify(periodo ? { ticker: alvo, periodo } : { ticker: alvo }),
      });
      setRelatorios((atual) => [novo, ...(atual ?? []).filter((r) => r.id !== novo.id)]);
      setSelecao({ tipo: "ativo", ticker: novo.asset?.ticker ?? alvo, periodo: novo.period });
      setAviso(`${novo.fileName} carregado.`);
      if (!periodo) setTicker("");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível consultar a CVM agora. Tente de novo em instantes.");
    } finally {
      setBuscando(null);
    }
  }

  async function apagar(alvo: Relatorio) {
    if (apagando) return;
    setErro(null);
    setApagando(true);
    try {
      await api<void>(`/reports/${alvo.id}`, { method: "DELETE" });
      setRelatorios((atual) => (atual ?? []).filter((r) => r.id !== alvo.id));
      setSelecao(alvo.asset && grupo ? { tipo: "ativo", ticker: alvo.asset.ticker, periodo: null } : null);
      setAviso(`${alvo.fileName} apagado.`);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível apagar o relatório.");
    } finally {
      setApagando(false);
      setConfirmandoApagar(null);
    }
  }

  const vazio = relatorios !== null && grupos.length === 0 && antigos.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Relatórios da CVM"
        descricao="O que cada empresa ou fundo imobiliário entregou à CVM, período a período: resultado, patrimônio e o que mudou de um para o outro."
      />

      {demo ? (
        <p className="rounded-md border border-line bg-card px-4 py-3 text-sm text-ink-2">
          Na conta de demonstração os relatórios já vêm carregados. Com a sua conta, você busca qualquer ação ou fundo
          imobiliário da B3.
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void buscar(ticker);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-2">Ação ou fundo imobiliário</span>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              list="relatorio-ativos"
              name="ticker"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Ex.: BBAS3 ou MXRF11…"
              maxLength={7}
              className={`${estiloCampo} w-56 uppercase placeholder:normal-case`}
            />
          </label>
          <datalist id="relatorio-ativos">
            {meusAtivos.map((a) => (
              <option key={a.ticker} value={a.ticker} />
            ))}
          </datalist>
          <Botao type="submit" disabled={buscando !== null || !ticker.trim()} className="min-h-10">
            Buscar o mais recente
          </Botao>
          <p className="basis-full text-xs text-mute">
            Traz o último período que a CVM já publicou. ETFs e renda fixa não entregam essas demonstrações.
          </p>
        </form>
      )}

      {/* região viva sempre montada: o leitor de tela anuncia o que muda dentro dela */}
      <p role="status" className={buscando || aviso ? "text-sm text-ink-2" : "sr-only"}>
        {buscando ? `Buscando ${buscando} na CVM… Pode levar até um minuto na primeira vez.` : aviso}
      </p>

      {erro && <MensagemErro>{erro}</MensagemErro>}

      {erroDaLista ? (
        <MensagemErro>Não foi possível carregar os seus relatórios. Recarregue a página para tentar de novo.</MensagemErro>
      ) : relatorios === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando relatórios">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md border border-line bg-card" />
          ))}
        </div>
      ) : vazio ? (
        <EmptyState
          titulo="Nenhum relatório ainda"
          descricao={
            demo
              ? "Esta conta de demonstração está sem relatórios carregados no momento."
              : "Digite o código de uma ação ou de um fundo imobiliário acima para trazer o último período publicado na CVM."
          }
        />
      ) : (
        <div className="grid grid-cols-12 items-start gap-6">
          <nav aria-label="Ativos com relatório" className="col-span-12 lg:col-span-3">
            <Card respiro="compacto">
              <ul className="space-y-1">
                {grupos.map((g) => {
                  const ativo = grupo?.ticker === g.ticker;
                  return (
                    <li key={g.ticker}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelecao({ tipo: "ativo", ticker: g.ticker, periodo: null });
                          setConfirmandoApagar(null);
                        }}
                        aria-current={ativo ? "true" : undefined}
                        className={`toque w-full rounded px-3 py-2 text-left text-sm ${ativo ? "bg-ink text-white" : "hover:bg-paper"}`}
                      >
                        <span className="block font-semibold">{g.ticker}</span>
                        <span className={`block truncate text-xs ${ativo ? "text-white/78" : "text-mute"}`}>
                          {g.periodos.length === 1 ? "1 período" : `${g.periodos.length} períodos`}, até{" "}
                          {rotuloDoPeriodo(g.periodos[0]?.period ?? "")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {antigos.length > 0 && (
                <>
                  <h2 className="mt-4 border-t border-line px-3 pt-3 pb-1 text-xs font-semibold text-mute">
                    Guardados antes da mudança
                  </h2>
                  <ul className="space-y-1">
                    {antigos.map((r) => {
                      const ativo = antigo?.id === r.id;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelecao({ tipo: "antigo", id: r.id });
                              setConfirmandoApagar(null);
                            }}
                            aria-current={ativo ? "true" : undefined}
                            className={`toque w-full rounded px-3 py-2 text-left text-sm ${ativo ? "bg-ink text-white" : "hover:bg-paper"}`}
                          >
                            <span className="block truncate font-medium">{r.fileName}</span>
                            <span className={`block text-xs ${ativo ? "text-white/78" : "text-mute"}`}>
                              {dataCurta(r.createdAt)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
          </nav>

          <div className="col-span-12 min-w-0 space-y-6 lg:col-span-9">
            {grupo && relatorio && (
              <CabecalhoDoAtivo
                grupo={grupo}
                selecionado={relatorio}
                aoEscolher={(periodo) => {
                  setSelecao({ tipo: "ativo", ticker: grupo.ticker, periodo });
                  setConfirmandoApagar(null);
                }}
                podeCarregar={!demo}
                buscando={buscando !== null}
                aoCarregarAnterior={(periodo) => void buscar(grupo.ticker, periodo)}
              />
            )}

            {grupo && relatorio && <Comparacao grupo={grupo} selecionado={relatorio} />}

            {antigo && (
              <p className="rounded-md border border-etf/30 bg-etf/7 px-4 py-3 text-sm text-ink-2">
                Este relatório foi guardado quando a tela aceitava PDF e resumo automático. Ele continua aqui para leitura,
                mas o texto não vem dos dados oficiais da CVM e não entra em comparação.
                {!demo && antigo.asset && " Para ter os números oficiais deste ativo, busque o código dele acima."}
              </p>
            )}

            {relatorio?.analysis && (
              <Detalhe
                relatorio={relatorio}
                analise={relatorio.analysis}
                oficial={grupo !== null}
                comIndicadores={grupo === null || grupo.periodos.length < 2}
              />
            )}

            {relatorio && !demo && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {confirmandoApagar === relatorio.id ? (
                  <>
                    <span className="text-ink-2">
                      Apagar {relatorio.fileName} da sua conta?
                      {grupo && " Dá para buscar de novo depois."}
                    </span>
                    <Botao
                      ref={cancelarRef}
                      variante="secundario"
                      tamanho="sm"
                      className="min-h-9"
                      disabled={apagando}
                      onClick={() => setConfirmandoApagar(null)}
                    >
                      Cancelar
                    </Botao>
                    <Botao
                      variante="perigo"
                      tamanho="sm"
                      className="min-h-9"
                      disabled={apagando}
                      onClick={() => void apagar(relatorio)}
                    >
                      {apagando ? "Apagando…" : "Apagar"}
                    </Botao>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoApagar(relatorio.id)}
                    className="toque min-h-9 rounded px-1 text-sm text-ink-2 underline decoration-1 underline-offset-4 hover:text-loss-ink"
                  >
                    Apagar este relatório
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CabecalhoDoAtivo({
  grupo,
  selecionado,
  aoEscolher,
  podeCarregar,
  buscando,
  aoCarregarAnterior,
}: {
  grupo: GrupoDeAtivo;
  selecionado: Relatorio;
  aoEscolher: (periodo: string) => void;
  podeCarregar: boolean;
  buscando: boolean;
  aoCarregarAnterior: (periodo: string) => void;
}) {
  const maisAntigo = grupo.periodos.at(-1)?.period ?? null;
  const anterior = maisAntigo ? periodoAnterior(maisAntigo) : null;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-leitura text-2xl leading-8 font-semibold">{grupo.ticker}</h2>
        {grupo.nome && <span className="text-sm text-ink-2">{grupo.nome}</span>}
        {grupo.tipo && <EtiquetaClasse tipo={grupo.tipo} />}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        {grupo.periodos.map((p) => {
          const ativo = p.id === selecionado.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoEscolher(p.period ?? "")}
              className={`toque tnum min-h-9 rounded border px-3 text-sm font-semibold ${
                ativo ? "border-ink bg-ink text-white" : "border-line bg-card hover:bg-paper"
              }`}
            >
              {rotuloDoPeriodo(p.period ?? "")}
            </button>
          );
        })}
        {podeCarregar && anterior && (
          <button
            type="button"
            disabled={buscando}
            onClick={() => aoCarregarAnterior(anterior)}
            className="toque tnum min-h-9 rounded border border-dashed border-line px-3 text-sm text-ink-2 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
          >
            Carregar {rotuloDoPeriodo(anterior)}
          </button>
        )}
      </div>
    </Card>
  );
}

function Comparacao({ grupo, selecionado }: { grupo: GrupoDeAtivo; selecionado: Relatorio }) {
  const tabela = tabelaComparativa(grupo.periodos);
  if (!tabela) return null;
  const temAnoInteiro = tabela.colunas.some((c) => c.anoInteiro);

  return (
    <section aria-labelledby="titulo-comparacao" className="rounded-md border border-line bg-card">
      <div className="px-6 pt-6">
        <h2 id="titulo-comparacao" className="font-leitura text-xl leading-7 font-semibold">
          Período a período
        </h2>
        <p className="mt-1 text-sm text-mute">
          Entre parênteses, a variação que o próprio documento informa contra a base de comparação dele.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-y border-line text-xs text-mute">
              <th scope="col" className="py-3 pr-3 pl-6 text-left font-semibold">
                Indicador
              </th>
              {tabela.colunas.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={`tnum px-3 py-3 text-right font-semibold last:pr-6 ${c.id === selecionado.id ? "bg-paper text-ink" : ""}`}
                >
                  {c.rotulo}
                  {c.anoInteiro && <span className="font-normal"> (ano)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((l) => (
              <tr key={l.nome} className="border-b border-line last:border-b-0">
                <th scope="row" className="max-w-[260px] py-3 pr-3 pl-6 text-left font-medium text-ink-2">
                  {l.nome}
                  {l.definicao && <span className="mt-0.5 block text-xs leading-snug font-normal text-mute">{l.definicao}</span>}
                </th>
                {l.valores.map((v, i) => {
                  const coluna = tabela.colunas[i];
                  return (
                    <td
                      key={coluna?.id ?? i}
                      className={`tnum px-3 py-3 text-right whitespace-nowrap last:pr-6 ${coluna?.id === selecionado.id ? "bg-paper font-semibold" : ""}`}
                    >
                      {v ?? <span className="text-mute">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {temAnoInteiro && (
        <p className="border-t border-line px-6 py-3 text-xs leading-relaxed text-mute">
          A coluna marcada com (ano) vem da demonstração anual (DFP): receita e lucro são do exercício inteiro, não de
          um trimestre, e não se comparam direto com as colunas ao lado. Patrimônio e ativo são saldos na data e se
          comparam normalmente.
        </p>
      )}
    </section>
  );
}

/**
 * `comIndicadores`: a lista de indicadores só aparece quando a tabela "Período a período" não apareceu
 * (um período só, ou relatório antigo). Com a tabela na tela, repetir os mesmos números embaixo é ruído.
 */
function Detalhe({
  relatorio,
  analise,
  oficial,
  comIndicadores,
}: {
  relatorio: Relatorio;
  analise: Analise;
  oficial: boolean;
  comIndicadores: boolean;
}) {
  const periodo = relatorio.period ? rotuloDoPeriodo(relatorio.period) : null;
  const blocos = blocosDoResumo(analise);
  const grupos = gruposDePontos(analise);

  return (
    <>
      <Card>
        <TituloCard
          acessorio={<span className="rounded-full bg-paper px-3 py-1 text-xs text-mute">{analise.tipoDocumento}</span>}
        >
          {oficial && periodo ? `O que o documento de ${periodo} traz` : "Resumo guardado"}
        </TituloCard>
        <div className="mt-4 space-y-5">
          {blocos.map((bloco, b) => (
            <div key={bloco.titulo ?? b}>
              {bloco.titulo && <h3 className="text-sm font-semibold text-ink">{bloco.titulo}</h3>}
              <ul className={`space-y-2.5 ${bloco.titulo ? "mt-2" : ""}`}>
                {bloco.itens.map((topico, i) => (
                  <li key={i} className="flex max-w-[72ch] gap-3 text-sm leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-2" aria-hidden />
                    <span className="min-w-0 break-words">{topico}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {oficial && (
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-mute">
            Fonte: dados abertos da CVM
            {/* no informe mensal a "data" da CVM é o dia 1 do mês, que só confunde: o mês já está no título */}
            {analise.dataReferencia && relatorio.period?.includes("T") && `, data-base ${dataCurta(analise.dataReferencia)}`}
            . Resumo montado por regra fixa, sem inteligência artificial e sem recomendação.
            {analise.link && (
              <>
                {" "}
                <a
                  href={analise.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded text-ink underline decoration-1 underline-offset-4"
                >
                  Abrir o documento na CVM
                  <span className="sr-only"> (abre em outra aba)</span>
                </a>
              </>
            )}
          </p>
        )}
      </Card>

      {grupos.map((g, i) => (
        <section
          key={g.chave}
          aria-labelledby={`grupo-${g.chave}`}
          className="rounded-md border border-line bg-card p-6"
        >
          <h2 id={`grupo-${g.chave}`} className="font-leitura text-xl leading-7 font-semibold">
            {g.titulo}
          </h2>
          {oficial && i === 0 && (
            <p className="mt-1 text-sm text-mute">
              Marcados por cortes fixos nos números do documento. Dizem para onde o número andou, não o que fazer.
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {g.itens.map((p, j) => (
              <li key={j} className="rounded border-l-3 bg-paper py-3 pr-4 pl-4" style={{ borderColor: barraDoGrupo[g.chave] }}>
                <p className="text-sm font-semibold">{p.titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{p.detalhe}</p>
                {p.criterio && <p className="mt-1.5 text-xs text-mute">Critério: {p.criterio}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {comIndicadores && analise.indicadores.length > 0 && (
        <Card>
          <TituloCard>{oficial ? "Indicadores do período" : "Indicadores guardados"}</TituloCard>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {analise.indicadores.map((ind, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
                <dt className="min-w-0 text-ink-2">
                  {ind.nome}
                  {ind.definicao && <span className="mt-0.5 block text-xs leading-snug text-mute">{ind.definicao}</span>}
                </dt>
                <dd className="tnum shrink-0 font-semibold">{ind.valor}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}
