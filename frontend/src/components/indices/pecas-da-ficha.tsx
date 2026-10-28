import Link from "next/link";
import { NumeroQueConta } from "@/components/movimento/numero-que-conta";
import { dataDeLeitura } from "@/lib/format";
import type { Indice, Link as LinkDoIndice, Trecho } from "@/lib/indices";

/** Peças das fichas de índice que não mudam com o período: renderizadas no servidor. */

export const CARTAO = "rounded-md border border-pauta bg-card";

/** "%" para taxa, uma seta para índice de pontos: o mesmo símbolo no card e na ficha. */
export function IconeDoIndice({ indice, tamanho }: { indice: Indice; tamanho: "card" | "ficha" }) {
  const dimensao = tamanho === "ficha" ? "h-14 w-14 rounded-xl" : "h-11 w-11 rounded-full";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center bg-marca-texto font-leitura text-xl font-semibold text-anotacao ${dimensao}`}>
      {indice.tipo === "taxa" ? (
        "%"
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
        </svg>
      )}
    </span>
  );
}

/** "Atualizado em 15/10/2026 · Fonte: Banco Central (SGS 432)". `atualizadoEm` é o instante em que o backend leu as fontes; sem ele (API fora), só a fonte. */
export function DataEFonte({ indice, atualizadoEm, className = "" }: { indice: Indice; atualizadoEm?: string; className?: string }) {
  return (
    <p className={`text-xs leading-[17px] text-mute ${className}`}>
      {atualizadoEm ? `Atualizado em ${dataDeLeitura(atualizadoEm)} · ` : ""}Fonte: {indice.fonte.nome} ({indice.fonte.serie}){indice.tipo === "pontos" ? ", via Yahoo Finance" : ""}
    </p>
  );
}

/** Nome, etiqueta e, à direita, o que a ficha quiser: o valor de hoje (taxa) ou os botões (pontos). */
export function CabecalhoDaFicha({ indice, direita }: { indice: Indice; direita: React.ReactNode }) {
  return (
    <div className={`${CARTAO} flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
      <div className="flex min-w-0 items-center gap-4">
        <IconeDoIndice indice={indice} tamanho="ficha" />
        <div className="min-w-0">
          <h1 className="font-leitura text-[30px] leading-[38px] font-bold text-ink sm:text-[36px] sm:leading-[44px]">
            {indice.nome}
          </h1>
          <p className="mt-1 inline-block rounded-full bg-marca-texto px-2.5 py-[3px] text-xs leading-[17px] text-ink">
            {indice.tipo === "pontos" && indice.codigo !== indice.nome ? `${indice.codigo}: ` : ""}
            {indice.etiqueta}
          </p>
        </div>
      </div>
      {direita}
    </div>
  );
}

/** O número do topo da ficha de taxa: conta ao chegar à tela (o leitor de tela ouve só o valor final). `valor` nulo = sem dado. */
export function ValorDeHoje({ indice, valor, atualizadoEm }: { indice: Indice; valor: number | null; atualizadoEm?: string }) {
  return (
    <div className="sm:text-right">
      <p className="text-[13px] leading-[19px] text-mute">{indice.rotuloDoValor}</p>
      <p className="tnum text-[30px] leading-[36px] font-semibold text-ink">
        {valor === null ? (
          "—"
        ) : (
          <>
            <NumeroQueConta valor={valor} formato="percentual" />
            {indice.unidade === "% a.a." && " a.a."}
          </>
        )}
      </p>
      <DataEFonte indice={indice} atualizadoEm={atualizadoEm} className="mt-0.5" />
    </div>
  );
}

/** Variação com seta e sinal, além da cor: ninguém depende de distinguir verde de vermelho. */
export function Variacao({ valor, texto, neutra = false }: { valor: number | null; texto: string; neutra?: boolean }) {
  if (valor === null || valor === 0) return <span className="tnum text-ink">{texto}</span>;
  const subiu = valor > 0;
  const cor = neutra ? "text-ink" : subiu ? "text-gain-ink" : "text-loss-ink";
  return (
    <span className={`tnum ${cor}`}>
      <span aria-hidden>{subiu ? "▲" : "▼"}</span> {texto}
      <span className="sr-only">{subiu ? " (alta)" : " (queda)"}</span>
    </span>
  );
}

/** Os três números do topo da ficha de pontos: valor atual e variações em 12 e 60 meses. */
export function CartoesDeNumero({ itens }: { itens: { rotulo: string; texto: string; variacao: number | null }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {itens.map((item) => (
        <div key={item.rotulo} className={`${CARTAO} flex flex-col items-center gap-1.5 p-[18px] text-center`}>
          <dt className="text-xs leading-4 font-medium text-mute">{item.rotulo}</dt>
          <dd className="text-[26px] leading-[34px] font-semibold sm:text-[30px] sm:leading-[36px]">
            <Variacao valor={item.variacao} texto={item.texto} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Um card da coluna lateral, com título. */
export function CartaoLateral({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className={`${CARTAO} p-5`}>
      <h2 className="font-leitura text-base leading-[22px] font-semibold text-ink">{titulo}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** O "cuidado ao ler" do índice: na voz da anotação, nunca em vermelho. */
export function ArmadilhaDoIndice({ texto }: { texto: string }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded bg-marca-texto py-2 pr-3 pl-2.5">
      <span aria-hidden className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-anotacao text-[11px] leading-none font-medium text-white">
        !
      </span>
      <p className="text-[13px] leading-[19px] font-medium text-anotacao">
        <span className="sr-only">Cuidado ao ler: </span>
        {texto}
      </p>
    </div>
  );
}

/** Links para outros índices e para os artigos. Roxo escuro, nunca verde-claro: contraste de 6,8:1. */
export function VejaTambem({ links }: { links: LinkDoIndice[] }) {
  return (
    <CartaoLateral titulo="Veja também">
      <ul className="-my-1">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-9 items-center text-[15px] leading-[22px] font-medium text-anotacao underline decoration-anotacao/40 decoration-1 underline-offset-4 hover:decoration-anotacao"
            >
              {link.rotulo}
              <span aria-hidden>&nbsp;→</span>
            </Link>
          </li>
        ))}
      </ul>
    </CartaoLateral>
  );
}

/** Um parágrafo de artigo com os números em negrito. */
export function TextoComDestaques({ trechos }: { trechos: Trecho[] }) {
  return (
    <p>
      {trechos.map((t, i) =>
        typeof t === "string" ? (
          t
        ) : (
          <strong key={i} className="font-semibold text-ink">
            {t.forte}
          </strong>
        ),
      )}
    </p>
  );
}

/** O bloco em formato de artigo: Literata, linha longa e confortável. */
export function BlocoDeArtigo({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${CARTAO} p-6 sm:p-7 ${className}`}>
      <h2 className="font-leitura text-[24px] leading-[32px] font-semibold text-ink sm:text-[28px] sm:leading-[36px]">{titulo}</h2>
      <div className="mt-3 max-w-[68ch] space-y-3 font-leitura text-[17px] leading-[29px] text-ink-2 sm:text-lg sm:leading-[30px]">
        {children}
      </div>
    </section>
  );
}

/** A nota de rodapé de toda página de índice: de onde o número vem e até que dia vai. */
export function NotaDaFonte({ children }: { children: React.ReactNode }) {
  return <p className="mt-10 max-w-[760px] text-xs leading-[18px] text-mute">{children}</p>;
}
