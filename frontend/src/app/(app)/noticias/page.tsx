"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { tempoRelativo } from "@/lib/format";

type Noticia = {
  titulo: string;
  link: string;
  fonte: string;
  publicadoEm: string;
  tickers: string[];
};

type Feed = {
  daSuaCarteira: Noticia[];
  mercado: Noticia[];
  atualizadoEm: string;
};

function CardNoticia({ n, destaque }: { n: Noticia; destaque?: boolean }) {
  return (
    <a
      href={n.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-xl border p-4 transition hover:shadow-md ${
        destaque
          ? "border-[#1e9e63]/25 bg-[#1e9e63]/[0.04] hover:border-[#1e9e63]/50"
          : "border-[--color-line] bg-white hover:border-slate-300"
      }`}
    >
      {n.tickers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {n.tickers.map((t) => (
            <span
              key={t}
              className="rounded-md bg-[#1e9e63] px-2 py-0.5 font-mono text-[11px] font-bold text-white"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm font-medium leading-snug group-hover:text-[#1e9e63]">{n.titulo}</p>

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span>{n.fonte}</span>
        <span aria-hidden>·</span>
        <span className="tnum font-mono">{tempoRelativo(n.publicadoEm)}</span>
      </div>
    </a>
  );
}

export default function NoticiasPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Feed>("/news")
      .then(setFeed)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar as notícias"),
      );
  }, []);

  if (erro) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#d94f5c]">{erro}</p>;
  }

  if (!feed) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="reveal flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notícias</h1>
          <p className="text-sm text-slate-500">
            Mercado brasileiro, com destaque para os ativos da sua carteira
          </p>
        </div>
        <span className="tnum rounded-full border border-[--color-line] bg-white px-3 py-1 font-mono text-xs text-slate-500">
          atualizado {tempoRelativo(feed.atualizadoEm)}
        </span>
      </header>

      <section className="reveal reveal-2">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="font-semibold">Da sua carteira</h2>
          <span className="tnum font-mono text-xs text-slate-400">
            {feed.daSuaCarteira.length}
          </span>
        </div>

        {feed.daSuaCarteira.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium">
              Nenhuma notícia recente cita os ativos da sua carteira
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Assim que sair algo sobre eles, aparece aqui em destaque.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {feed.daSuaCarteira.map((n) => (
              <CardNoticia key={n.link} n={n} destaque />
            ))}
          </div>
        )}
      </section>

      <section className="reveal reveal-3">
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="font-semibold">Mercado</h2>
          <span className="tnum font-mono text-xs text-slate-400">{feed.mercado.length}</span>
        </div>

        {feed.mercado.length === 0 ? (
          <div className="rounded-xl border border-[--color-line] bg-white p-8 text-center">
            <p className="text-sm text-slate-500">
              Nenhuma notícia disponível no momento — as fontes podem estar fora do ar.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {feed.mercado.map((n) => (
              <CardNoticia key={n.link} n={n} />
            ))}
          </div>
        )}
      </section>

      <p className="reveal reveal-4 text-center text-xs text-slate-400">
        Notícias de fontes públicas (Money Times e Suno). O PortfolioLab não produz
        conteúdo jornalístico nem recomenda investimentos.
      </p>
    </div>
  );
}
