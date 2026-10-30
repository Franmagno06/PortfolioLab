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
  /** CVM: números oficiais estruturados da CVM. PDF: documento lido com busca textual. */
  source: "CVM" | "PDF";
  /** "2026-T1" ou "2026-03", quando identificado o período. */
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

const severidades: Record<Alerta["severidade"], { barra: string; rotulo: string }> = {
  critico: { barra: "var(--color-loss)", rotulo: "Crítico" },
  atencao: { barra: "var(--color-etf)", rotulo: "Atenção" },
  info: { barra: "var(--color-fii)", rotulo: "Info" },
};

export default function RelatoriosPage() {
  const [relatorios, setRelatorios] = useState<Relatorio[] | null>(null);
  const [selecionado, setSelecionado] = useState<Relatorio | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [consultandoCvm, setConsultandoCvm] = useState(false);
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
    // sugerir no campo; qualquer ticker da B3 é aceito
    api<{ ticker: string }[]>("/assets")
      .then(setMeusAtivos)
      .catch(() => setMeusAtivos([]));
  }, []);

  async function enviarPdf(arquivo: File) {
    setErro(null);
    setEnviando(true);
    try {
      const form = new FormData();
      if (ticker.trim()) form.append("ticker", ticker.trim().toUpperCase());
      form.append("file", arquivo);
      const novo = await apiUpload<Relatorio>("/reports", form);
      setRelatorios((atual) => [novo, ...(atual ?? [])]);
      setSelecionado(novo);
      setChat([]);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao processar o PDF");
    } finally {
      setEnviando(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  }

  async function consultarCvmDireto() {
    if (!ticker.trim()) return;
    setErro(null);
    setConsultandoCvm(true);
    try {
      const novo = await api<Relatorio>("/reports/cvm", {
        method: "POST",
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase() }),
      });
      setRelatorios((atual) => [novo, ...(atual ?? [])]);
      setSelecionado(novo);
      setChat([]);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao consultar dados da CVM");
    } finally {
      setConsultandoCvm(false);
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
        body: JSON.stringify({
          question: minhaPergunta,
          termo: minhaPergunta,
          history: chat.slice(-10),
        }),
      });
      setChat((c) => [...c, { role: "assistant", content: answer }]);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao buscar no documento");
      setChat((c) => c.slice(0, -1));
    } finally {
      setPerguntando(false);
    }
  }

  const analise = selecionado?.analysis ?? null;
  const emProgresso = enviando || consultandoCvm;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Relatórios CVM e Documentos"
        descricao="Consulte demonstrações financeiras oficiais da CVM ou envie relatórios gerenciais em PDF para extrair resumo, indicadores e buscar no documento"
        acao={
          <div className="flex items-center gap-2">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              list="relatorio-ativos"
              aria-label="Ativo do relatório (opcional)"
              placeholder="Ticker (ex: BBAS3)"
              maxLength={7}
              disabled={emProgresso}
              className={`${estiloCampo} w-40 uppercase placeholder:normal-case`}
            />
            <datalist id="relatorio-ativos">
              {meusAtivos.map((a) => (
                <option key={a.ticker} value={a.ticker} />
              ))}
            </datalist>
            <Botao
              variante="secundario"
              onClick={consultarCvmDireto}
              disabled={emProgresso || !ticker.trim()}
            >
              {consultandoCvm ? "Consultando CVM…" : "Consultar CVM"}
            </Botao>
            <Botao onClick={() => inputArquivo.current?.click()} disabled={emProgresso}>
              {enviando ? "Processando…" : "Enviar PDF"}
            </Botao>
          </div>
        }
      />
      <p className="-mt-3 text-xs text-mute">
        Informe o ticker para consultar balanços oficiais da CVM sem enviar arquivo, ou anexe o PDF do relatório gerencial para processamento estruturado e busca textual.
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

      {emProgresso && (
        <Card>
          <p className="font-semibold">
            {consultandoCvm ? "Consultando dados na CVM" : "Lendo e processando o documento"}
          </p>
          <p className="mt-1 text-sm text-mute">
            {consultandoCvm
              ? "Buscando demonstrações financeiras e consolidando indicadores oficiais."
              : "Extraindo dados financeiros, resumo executivo e pontos de atenção."}
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
                      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
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

        {/* Análise + busca */}
        <div className="col-span-12 space-y-6 lg:col-span-9">
          {!analise ? (
            <EmptyState
              titulo="Consulte a CVM ou envie um relatório em PDF"
              descricao="Funciona com ações e fundos imobiliários da B3. Obtenha resumo executivo, alertas e indicadores estruturados de forma educacional."
            >
              <Botao onClick={() => inputArquivo.current?.click()} disabled={emProgresso}>
                {enviando ? "Processando…" : "Enviar PDF"}
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
                    ? `Demonstrações financeiras oficiais da CVM${selecionado.period ? ` (${rotuloPeriodo(selecionado.period)})` : ""}. Indicadores e balanço patrimonial estruturados.`
                    : "Extração direta e análise dos dados do documento PDF enviado."}
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
                          className="rounded border-l-3 bg-paper py-3 pr-4 pl-4"
                          style={{ borderColor: sev.barra }}
                        >
                          <p className="text-sm font-semibold">
                            {sev.rotulo}: {a.titulo}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-ink-2">
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
                        className="rounded border border-line bg-paper px-3 py-1.5 text-sm"
                      >
                        {ind.nome}:{" "}
                        <span className="tnum font-semibold">{ind.valor}</span>
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {selecionado?.source === "CVM" ? (
                <Card>
                  <TituloCard>Buscar no relatório</TituloCard>
                  <p className="mt-1 text-sm text-mute">
                    A busca textual direta está disponível para documentos enviados em PDF. Para relatórios da CVM, os números e indicadores oficiais do período estão consolidados acima.
                  </p>
                </Card>
              ) : (
                <Card>
                  <TituloCard>Buscar no relatório</TituloCard>
                  <p className="mt-1 text-sm text-mute">
                    Localize termos e informações com base no conteúdo textual extraído do documento.
                  </p>

                  {chat.length > 0 && (
                    <div className="mt-4 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
                      {chat.map((m, i) => (
                        <div
                          key={i}
                          className={`max-w-[85%] rounded-md px-4 py-2.5 text-sm leading-relaxed ${
                            m.role === "user" ? "ml-auto bg-ink text-white" : "bg-paper"
                          }`}
                        >
                          {m.content}
                        </div>
                      ))}
                      {perguntando && (
                        <p className="max-w-[85%] rounded-md bg-paper px-4 py-2.5 text-sm text-mute">
                          Buscando no documento...
                        </p>
                      )}
                    </div>
                  )}

                  <form onSubmit={perguntar} className="mt-4 flex gap-2">
                    <input
                      value={pergunta}
                      onChange={(e) => setPergunta(e.target.value)}
                      aria-label="Sua busca ou pergunta sobre o relatório"
                      placeholder="Ex: vacância, dividendos, receita, inadimplência..."
                      className={`${estiloCampo} min-w-0 flex-1`}
                    />
                    <Botao
                      type="submit"
                      variante="acento"
                      disabled={perguntando || !pergunta.trim()}
                    >
                      Buscar
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
