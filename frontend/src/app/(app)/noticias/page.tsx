"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { MensagemErro } from "@/components/ui/mensagem";
import { PageHeader, Pilula } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
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
      className={`group block rounded-xl border p-4 transition-colors ${
        destaque
          ? "border-gain/30 bg-gain/5 hover:border-gain/60"
          : "border-line bg-card hover:border-mute-soft"
      }`}
    >
      {n.tickers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {n.tickers.map((t) => (
            <span
              key={t}
              className="rounded-md bg-gain-ink px-2 py-0.5 font-mono text-[11px] font-bold text-white"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm leading-snug font-medium group-hover:text-gain-ink">{n.titulo}</p>

      <p className="mt-2 text-xs text-mute">
        {n.fonte}
        <span className="tnum ml-2 font-mono">{tempoRelativo(n.publicadoEm)}</span>
      </p>
    </a>
  );
}

function Secao({
  titulo,
  quantidade,
  children,
}: {
  titulo: string;
  quantidade: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        <span className="tnum font-mono text-xs text-mute">{quantidade}</span>
      </div>
      {children}
    </section>
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

  if (erro) return <MensagemErro>{erro}</MensagemErro>;

  if (!feed) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-52 rounded-lg" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        titulo="Notícias"
        descricao="Mercado brasileiro, com destaque para os ativos da sua carteira"
        contexto={<Pilula>atualizado {tempoRelativo(feed.atualizadoEm)}</Pilula>}
      />

      <Secao titulo="Da sua carteira" quantidade={feed.daSuaCarteira.length}>
        {feed.daSuaCarteira.length === 0 ? (
          <EmptyState
            titulo="Nenhuma notícia recente cita os seus ativos"
            descricao="Assim que sair algo sobre eles, aparece aqui em destaque."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {feed.daSuaCarteira.map((n) => (
              <CardNoticia key={n.link} n={n} destaque />
            ))}
          </div>
        )}
      </Secao>

      <Secao titulo="Mercado" quantidade={feed.mercado.length}>
        {feed.mercado.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-8 text-center">
            <p className="text-sm text-mute">
              Nenhuma notícia disponível agora. As fontes podem estar fora do ar — recarregue a
              página em alguns minutos.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {feed.mercado.map((n) => (
              <CardNoticia key={n.link} n={n} />
            ))}
          </div>
        )}
      </Secao>

      <p className="text-center text-xs text-mute">
        Notícias de fontes públicas (Money Times e Suno). O PortfolioLab não produz conteúdo
        jornalístico nem recomenda investimentos.
      </p>
    </div>
  );
}
