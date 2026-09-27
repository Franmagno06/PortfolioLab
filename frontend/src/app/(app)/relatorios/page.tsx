"use client";

import { useEffect, useRef, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Card, TituloCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { estiloCampo } from "@/components/ui/campo";
import { MensagemErro } from "@/components/ui/mensagem";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError, apiUpload, type Pagina } from "@/lib/api";

type Alerta = { titulo: string; severidade: "info" | "atencao" | "critico"; detalhe: string };

type Analise = {
  tipoDocumento: string;
  resumoExecutivo: string[];
  alertas: Alerta[];
  indicadores: { nome: string; valor: string }[];
};

type Relatorio = {
  id: string;
  fileName: string;
  createdAt: string;
  analysis: Analise | null;
  /** CVM: números oficiais, sem o texto do PDF (e sem chat). PDF: documento lido inteiro. */
  source: "CVM" | "PDF";
  /** "2026-T1" ou "2026-03", quando a capa trazia o período. */
  period: string | null;
  asset: { ticker: string } | null;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-T1" vira "1T26"; "2026-03" vira "mar/2026". */
function rotuloPeriodo(periodo: string): string {
  const [ano, parte] = periodo.split("-");
  if (!ano || !parte) return periodo;
  if (parte.startsWith("T")) return `${parte.slice(1)}T${ano.slice(-2)}`;
  return `${MESES[Number(parte) - 1] ?? parte}/${ano}`;
}

type MensagemChat = { role: "user" | "assistant"; content: string };

// Severidade: barra lateral colorida + texto em tinta cheia. A versão anterior
// pintava o título na cor da severidade sobre um fundo tingido dela — o âmbar
// dava menos de 4.5:1. A cor passou a marcar, não a escrever.
const severidades: Record<Alerta["severidade"], { barra: string; rotulo: string }> = {
  critico: { barra: "var(--color-loss)", rotulo: "Crítico" },
  atencao: { barra: "var(--color-etf)", rotulo: "Atenção" },
  info: { barra: "var(--color-fii)", rotulo: "Info" },
};

export default function RelatoriosPage() {
  const [relatorios, setRelatorios] = useState<Relatorio[] | null>(null);
  const [selecionado, setSelecionado] = useState<Relatorio | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chat, setChat] = useState<MensagemChat[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [perguntando, setPerguntando] = useState(false);
  const [ticker, setTicker] = useState("");
  const [meusAtivos, setMeusAtivos] = useState<{ ticker: string }[]>([]);
  const inputArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Pagina<Relatorio>>("/reports")
      .then(({ itens }) => {
        setRelatorios(itens);
        if (itens.length > 0) setSelecionado(itens[0] ?? null);
      })
      .catch(() => setRelatorios([]));
    // só para sugerir no campo; qualquer ticker da B3 é aceito
    api<{ ticker: string }[]>("/assets")
      .then(setMeusAtivos)
      .catch(() => setMeusAtivos([]));
  }, []);

  async function enviarPdf(arquivo: File) {
    setErro(null);
    setEnviando(true);
    try {
      const form = new FormData();
      // opcional: com ele, ações e FIIs são analisados com os dados da CVM
      if (ticker.trim()) form.append("ticker", ticker.trim().toUpperCase());
      form.append("file", arquivo);
      const novo = await apiUpload<Relatorio>("/reports", form);
      setRelatorios((atual) => [novo, ...(atual ?? [])]);
      setSelecionado(novo);
      setChat([]);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao analisar o PDF");
    } finally {
      setEnviando(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  }

  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionado || !pergunta.trim()) return;
    const minhaPergunta = pergunta.trim();
    setPergunta("");
    setErro(null);
    setChat((c) => [...c, { role: "user", content: minhaPergunta }]);
    setPerguntando(true);
    try {
      const { answer } = await api<{ answer: string }>(`/reports/${selecionado.id}/ask`, {
        method: "POST",
        body: JSON.stringify({ question: minhaPergunta, history: chat.slice(-10) }),
      });
      setChat((c) => [...c, { role: "assistant", content: answer }]);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao perguntar");
      setChat((c) => c.slice(0, -1)); // remove a pergunta que falhou
    } finally {
      setPerguntando(false);
    }
  }

  const analise = selecionado?.analysis ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Relatórios com IA"
        descricao="Envie o relatório gerencial em PDF e receba resumo, pontos de atenção e um chat para tirar dúvidas"
        acao={
          <div className="flex items-center gap-2">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              list="relatorio-ativos"
              aria-label="Ativo do relatório (opcional)"
              placeholder="Ativo (opcional)"
              maxLength={7}
              disabled={enviando}
              className={`${estiloCampo} w-40 uppercase placeholder:normal-case`}
            />
            <datalist id="relatorio-ativos">
              {meusAtivos.map((a) => (
                <option key={a.ticker} value={a.ticker} />
              ))}
            </datalist>
            <Botao onClick={() => inputArquivo.current?.click()} disabled={enviando}>
              {enviando ? "Analisando…" : "Enviar PDF"}
            </Botao>
          </div>
        }
      />
      <p className="-mt-3 text-xs text-mute">
        Informando o ativo, ações e FIIs são analisados com os números oficiais entregues à CVM.
        Sem ele, a IA lê o PDF inteiro, e só nesse caso o chat fica disponível.
      </p>
      <input
        ref={inputArquivo}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviarPdf(f);
        }}
      />

      {erro && <MensagemErro>{erro}</MensagemErro>}

      {enviando && (
        <Card>
          <p className="font-semibold">Lendo e analisando o relatório</p>
          <p className="mt-1 text-sm text-mute">
            A IA está extraindo o resumo executivo e os pontos de atenção. Isso leva alguns
            segundos.
          </p>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-paper">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gain" />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 items-start gap-6">
        {/* Lista de relatórios */}
        <Card respiro="compacto" className="col-span-12 lg:col-span-3">
          <h2 className="px-2 pb-2 text-xs font-semibold text-mute">Analisados</h2>
          {!relatorios ? (
            <p className="px-2 text-sm text-mute">Carregando...</p>
          ) : relatorios.length === 0 ? (
            <p className="px-2 text-sm text-mute">Nenhum relatório ainda.</p>
          ) : (
            <ul className="space-y-1">
              {relatorios.map((r) => {
                const ativo = selecionado?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        setSelecionado(r);
                        setChat([]);
                      }}
                      aria-current={ativo ? "true" : undefined}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        ativo ? "bg-ink text-white" : "hover:bg-paper"
                      }`}
                    >
                      <p className="truncate font-medium">{r.fileName}</p>
                      <p className={`text-xs ${ativo ? "text-slate-300" : "text-mute"}`}>
                        {[
                          r.asset?.ticker,
                          r.period && rotuloPeriodo(r.period),
                          new Date(r.createdAt).toLocaleDateString("pt-BR"),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Análise + chat */}
        <div className="col-span-12 space-y-6 lg:col-span-9">
          {!analise ? (
            <EmptyState
              titulo="Envie um relatório gerencial em PDF"
              descricao="Funciona melhor com relatórios de FIIs e releases de resultados. A análise é educacional, não é recomendação de investimento."
            >
              <Botao onClick={() => inputArquivo.current?.click()} disabled={enviando}>
                {enviando ? "Analisando…" : "Enviar PDF"}
              </Botao>
            </EmptyState>
          ) : (
            <>
              <Card>
                <TituloCard
                  acessorio={
                    <span className="rounded-full bg-paper px-3 py-1 text-xs text-mute">
                      {analise.tipoDocumento}
                    </span>
                  }
                >
                  Resumo executivo
                </TituloCard>
                <p className="mt-1 text-xs text-mute">
                  {selecionado?.source === "CVM"
                    ? `Números oficiais entregues à CVM${selecionado.period ? ` (${rotuloPeriodo(selecionado.period)})` : ""}, comentados pela IA. O PDF enviado serviu para identificar o período.`
                    : "Leitura do PDF enviado, feita pela IA."}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {analise.resumoExecutivo.map((topico, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gain"
                        aria-hidden
                      />
                      {topico}
                    </li>
                  ))}
                </ul>
              </Card>

              {analise.alertas.length > 0 && (
                <Card>
                  <TituloCard>Pontos de atenção</TituloCard>
                  <div className="mt-4 space-y-3">
                    {analise.alertas.map((a, i) => {
                      const sev = severidades[a.severidade] ?? severidades.info;
                      return (
                        <div
                          key={i}
                          className="rounded-lg border-l-3 bg-paper py-3 pr-4 pl-4"
                          style={{ borderColor: sev.barra }}
                        >
                          <p className="text-sm font-semibold">
                            {sev.rotulo}: {a.titulo}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                            {a.detalhe}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {analise.indicadores.length > 0 && (
                <Card>
                  <TituloCard>Indicadores citados</TituloCard>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {analise.indicadores.map((ind, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                      >
                        {ind.nome}:{" "}
                        <span className="tnum font-mono font-semibold">{ind.valor}</span>
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {selecionado?.source === "CVM" ? (
                <Card>
                  <TituloCard>Pergunte ao relatório</TituloCard>
                  <p className="mt-1 text-sm text-mute">
                    O chat não está disponível para este relatório: ele foi montado com os dados da
                    CVM, e o texto do PDF não foi guardado. Para conversar sobre o documento, envie o
                    PDF de novo sem informar o ativo.
                  </p>
                </Card>
              ) : (
                <Card>
                  <TituloCard>Pergunte ao relatório</TituloCard>
                  <p className="mt-1 text-sm text-mute">
                    A IA responde apenas com base no que está escrito no documento.
                  </p>

                  {chat.length > 0 && (
                    <div className="mt-4 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
                      {chat.map((m, i) => (
                        <div
                          key={i}
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            m.role === "user" ? "ml-auto bg-ink text-white" : "bg-paper"
                          }`}
                        >
                          {m.content}
                        </div>
                      ))}
                      {perguntando && (
                        <p className="max-w-[85%] rounded-2xl bg-paper px-4 py-2.5 text-sm text-mute">
                          Consultando o relatório...
                        </p>
                      )}
                    </div>
                  )}

                  <form onSubmit={perguntar} className="mt-4 flex gap-2">
                    <input
                      value={pergunta}
                      onChange={(e) => setPergunta(e.target.value)}
                      aria-label="Sua pergunta sobre o relatório"
                      placeholder="Ex: Como está a vacância? Houve emissão de cotas?"
                      className={`${estiloCampo} min-w-0 flex-1`}
                    />
                    <Botao
                      type="submit"
                      variante="acento"
                      disabled={perguntando || !pergunta.trim()}
                    >
                      Perguntar
                    </Botao>
                  </form>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
