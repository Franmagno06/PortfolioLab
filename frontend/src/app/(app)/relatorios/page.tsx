"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, apiUpload } from "@/lib/api";

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
};

type MensagemChat = { role: "user" | "assistant"; content: string };

const corSeveridade: Record<Alerta["severidade"], { bg: string; texto: string; rotulo: string }> = {
  critico: { bg: "#fdf0f1", texto: "#d94f5c", rotulo: "Crítico" },
  atencao: { bg: "#fdf6e9", texto: "#b97f18", rotulo: "Atenção" },
  info: { bg: "#eef3fd", texto: "#3b6fe0", rotulo: "Info" },
};

export default function RelatoriosPage() {
  const [relatorios, setRelatorios] = useState<Relatorio[] | null>(null);
  const [selecionado, setSelecionado] = useState<Relatorio | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chat, setChat] = useState<MensagemChat[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [perguntando, setPerguntando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Relatorio[]>("/reports")
      .then((lista) => {
        setRelatorios(lista);
        if (lista.length > 0) setSelecionado(lista[0] ?? null);
      })
      .catch(() => setRelatorios([]));
  }, []);

  async function enviarPdf(arquivo: File) {
    setErro(null);
    setEnviando(true);
    try {
      const form = new FormData();
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
      <header className="reveal flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios com IA</h1>
          <p className="text-sm text-slate-500">
            Envie o relatório gerencial (PDF) e receba resumo, alertas e um chat para tirar dúvidas
          </p>
        </div>
        <button
          onClick={() => inputArquivo.current?.click()}
          disabled={enviando}
          className="rounded-lg bg-[#0e1b33] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2f5c] disabled:opacity-60"
        >
          {enviando ? "Analisando..." : "+ Enviar PDF"}
        </button>
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
      </header>

      {erro && (
        <p className="reveal rounded-lg bg-red-50 px-4 py-3 text-sm text-[#d94f5c]">{erro}</p>
      )}

      {enviando && (
        <div className="reveal rounded-2xl border border-[--color-line] bg-white p-6">
          <p className="font-semibold">Lendo e analisando o relatório...</p>
          <p className="mt-1 text-sm text-slate-500">
            A IA está extraindo o resumo executivo e os pontos de atenção — isso leva alguns
            segundos.
          </p>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1e9e63]" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 items-start gap-6">
        {/* Lista de relatórios */}
        <aside className="reveal reveal-2 col-span-12 rounded-2xl border border-[--color-line] bg-white p-4 lg:col-span-3">
          <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Analisados
          </h2>
          {!relatorios ? (
            <p className="px-2 text-sm text-slate-500">Carregando...</p>
          ) : relatorios.length === 0 ? (
            <p className="px-2 text-sm text-slate-500">
              Nenhum relatório ainda — envie o primeiro PDF.
            </p>
          ) : (
            <ul className="space-y-1">
              {relatorios.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      setSelecionado(r);
                      setChat([]);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selecionado?.id === r.id
                        ? "bg-[#0e1b33] text-white"
                        : "hover:bg-[--color-paper]"
                    }`}
                  >
                    <p className="truncate font-medium">{r.fileName}</p>
                    <p
                      className={`text-xs ${
                        selecionado?.id === r.id ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Análise + chat */}
        <div className="col-span-12 space-y-6 lg:col-span-9">
          {!analise ? (
            <div className="reveal reveal-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-14 text-center">
              <p className="font-semibold">Envie um relatório gerencial em PDF</p>
              <p className="mt-1 text-sm text-slate-500">
                Funciona melhor com relatórios de FIIs e releases de resultados. A análise é
                educacional — não é recomendação de investimento.
              </p>
            </div>
          ) : (
            <>
              <section className="reveal rounded-2xl border border-[--color-line] bg-white p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-semibold">Resumo executivo</h2>
                  <span className="rounded-full bg-[--color-paper] px-3 py-1 text-xs text-slate-500">
                    {analise.tipoDocumento}
                  </span>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {analise.resumoExecutivo.map((topico, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="mt-0.5 font-mono text-xs font-bold text-[#1e9e63]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {topico}
                    </li>
                  ))}
                </ul>
              </section>

              {analise.alertas.length > 0 && (
                <section className="reveal reveal-2 rounded-2xl border border-[--color-line] bg-white p-6">
                  <h2 className="font-semibold">Pontos de atenção</h2>
                  <div className="mt-4 space-y-3">
                    {analise.alertas.map((a, i) => {
                      const cor = corSeveridade[a.severidade] ?? corSeveridade.info;
                      return (
                        <div key={i} className="rounded-xl p-4" style={{ background: cor.bg }}>
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                              style={{ background: "#ffffff", color: cor.texto }}
                            >
                              {cor.rotulo}
                            </span>
                            <p className="text-sm font-semibold" style={{ color: cor.texto }}>
                              {a.titulo}
                            </p>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                            {a.detalhe}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {analise.indicadores.length > 0 && (
                <section className="reveal reveal-3 rounded-2xl border border-[--color-line] bg-white p-6">
                  <h2 className="font-semibold">Indicadores citados</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {analise.indicadores.map((ind, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-[--color-line] bg-[--color-paper] px-3 py-1.5 text-sm"
                      >
                        {ind.nome}:{" "}
                        <span className="tnum font-mono font-semibold">{ind.valor}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className="reveal reveal-4 rounded-2xl border border-[--color-line] bg-white p-6">
                <h2 className="font-semibold">Pergunte ao relatório</h2>
                <p className="text-sm text-slate-500">
                  Tire dúvidas sobre o documento — a IA responde apenas com base no que está
                  escrito nele.
                </p>

                {chat.length > 0 && (
                  <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
                    {chat.map((m, i) => (
                      <div
                        key={i}
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "ml-auto bg-[#0e1b33] text-white"
                            : "bg-[--color-paper]"
                        }`}
                      >
                        {m.content}
                      </div>
                    ))}
                    {perguntando && (
                      <div className="max-w-[85%] rounded-2xl bg-[--color-paper] px-4 py-2.5 text-sm text-slate-400">
                        Consultando o relatório...
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={perguntar} className="mt-4 flex gap-2">
                  <input
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    placeholder="Ex: Como está a vacância? Houve emissão de cotas?"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="submit"
                    disabled={perguntando || !pergunta.trim()}
                    className="rounded-lg bg-[#1e9e63] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#187f50] disabled:opacity-50"
                  >
                    Perguntar
                  </button>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
