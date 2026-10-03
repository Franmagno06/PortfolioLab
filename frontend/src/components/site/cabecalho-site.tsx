"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconeFechar, IconeMenu } from "@/components/ui/icones";
import { Marca, Wordmark } from "@/components/ui/marca";
import { numero, pct } from "@/lib/format";
import {
  NAVEGACAO,
  ROTAS,
  type Coluna,
  type Destaque,
  type Destino,
  type Intencao,
} from "@/lib/navegacao";
import { NUMEROS_DO_MES } from "@/lib/site-dados";
import setaAcesa from "./seta-menu.svg";
import setaApagada from "./seta-menu-apagada.svg";

/*
 * Cabeçalho do site público: menu por intenção (Aprender, Ativos, Planejar,
 * Notícias). Cada intenção com menu é um disclosure — botão com aria-expanded
 * que mostra um painel —, e não role="menu": o painel tem links e texto, não
 * uma lista de comandos, e o padrão de menu exigiria navegação por setas.
 */

const ABRIR_APOS_MS = 150;
const FECHAR_APOS_MS = 300;

type IdMenu = Intencao["id"];

/** Item "em breve": apagado, sem link e sem foco. */
function EmBreve() {
  return <span className="text-xs font-medium text-mute">em breve</span>;
}

function ItemDoPainel({ destino }: { destino: Destino }) {
  const corpo = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={`text-[15px] font-semibold ${destino.href ? "text-ink group-hover:underline" : "text-mute"}`}>
          {destino.rotulo}
        </span>
        {!destino.href && <EmBreve />}
      </span>
      {destino.descricao && (
        <span className="mt-[3px] block text-[13px] leading-[19px] text-ink-2">{destino.descricao}</span>
      )}
    </>
  );

  return destino.href ? (
    <Link href={destino.href} className="group block rounded underline-offset-4">
      {corpo}
    </Link>
  ) : (
    <div>{corpo}</div>
  );
}

/** As trilhas: uma sequência, por isso o número. Todas ainda "em breve". */
function LinhaNumerada({ destino }: { destino: Destino }) {
  return (
    <li className="flex items-center gap-3.5 border-b border-pauta py-[11px]">
      <span aria-hidden className="w-4 shrink-0 font-leitura text-lg text-mute">
        {destino.numero}
      </span>
      <span className={`font-leitura text-base font-semibold ${destino.href ? "text-ink" : "text-mute"}`}>
        {destino.rotulo}
      </span>
      <span className="ml-auto shrink-0 text-[13px] whitespace-nowrap text-mute">
        {destino.descricao}
        {!destino.href && ", em breve"}
      </span>
    </li>
  );
}

function ColunaDoPainel({ coluna }: { coluna: Coluna }) {
  const largura =
    coluna.largura === "larga" ? "w-[480px] shrink-0" : coluna.largura === "estreita" ? "w-[264px] shrink-0" : "min-w-0 flex-1";
  const numerada = coluna.itens.some((i) => i.numero !== undefined);

  return (
    <div className={largura}>
      {coluna.titulo && <p className="text-[13px] font-medium text-mute">{coluna.titulo}</p>}
      {numerada ? (
        <ol className={coluna.titulo ? "pt-2.5" : ""}>
          {coluna.itens.map((item) => (
            <LinhaNumerada key={item.rotulo} destino={item} />
          ))}
        </ol>
      ) : (
        <ul className={`space-y-[18px] ${coluna.titulo ? "mt-[18px]" : ""}`}>
          {coluna.itens.map((item) => (
            <li key={item.rotulo}>
              <ItemDoPainel destino={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkDeDestaque({ destino }: { destino: Destino }) {
  if (!destino.href) return null;
  return (
    <Link
      href={destino.href}
      className="-mx-0.5 px-0.5 py-3 text-base font-semibold text-ink underline decoration-1 underline-offset-4"
    >
      {destino.rotulo}
    </Link>
  );
}

function DestaqueDoPainel({ destaque }: { destaque: Destaque }) {
  const { ibovespa, ifix, mes, fechamentoCurto } = NUMEROS_DO_MES;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-3 rounded-md bg-caderno px-6 pt-[22px] pb-4">
      <p className="font-leitura text-xl leading-[26px] font-semibold text-ink">{destaque.titulo}</p>
      {destaque.tipo === "desafio" ? (
        <p className="max-w-[300px] text-sm leading-[21px] text-ink-2">{destaque.texto}</p>
      ) : (
        <>
          <dl className="w-full text-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-pauta py-2">
              <dt className="text-ink-2">Ibovespa</dt>
              <dd className="tnum text-right">
                <span className="font-semibold text-ink">{numero(ibovespa.pontos)} pontos</span>{" "}
                <span className={ibovespa.variacaoNoMes >= 0 ? "text-gain-ink" : "text-loss-ink"}>
                  {pct(ibovespa.variacaoNoMes)}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-ink-2">IFIX</dt>
              <dd className="tnum font-semibold text-ink">{numero(ifix.pontos)} pontos</dd>
            </div>
          </dl>
          <p className="text-xs text-mute">
            Variação em {mes}, até o fechamento de {fechamentoCurto}.
          </p>
        </>
      )}
      <LinkDeDestaque destino={destaque.link} />
    </div>
  );
}

export function CabecalhoSite() {
  const rota = usePathname();

  // O estado lembra em qual rota o menu (ou a gaveta) abriu. Numa rota nova
  // ele simplesmente deixa de valer: mudar de página fecha tudo sem efeito.
  const [aberto, setAberto] = useState<{ id: IdMenu; rota: string } | null>(null);
  const [gaveta, setGaveta] = useState<string | null>(null);
  const menuAberto = aberto?.rota === rota ? aberto.id : null;
  const gavetaAberta = gaveta === rota;

  const timers = useRef<{ abrir?: ReturnType<typeof setTimeout>; fechar?: ReturnType<typeof setTimeout> }>({});
  const gatilhos = useRef<Partial<Record<IdMenu, HTMLButtonElement | null>>>({});
  const botaoGaveta = useRef<HTMLButtonElement>(null);
  const fecharGavetaRef = useRef<HTMLButtonElement>(null);

  function limparTimers() {
    clearTimeout(timers.current.abrir);
    clearTimeout(timers.current.fechar);
  }

  function abrir(id: IdMenu) {
    limparTimers();
    setAberto({ id, rota });
  }

  function fechar() {
    limparTimers();
    setAberto(null);
  }

  // Mouse: abre com um pequeno atraso (passar por cima a caminho de outro
  // lugar não abre nada) e fecha com outro, maior, para dar tempo de atravessar
  // do botão até o painel. Toque e caneta ficam só com o clique.
  function agendarAbertura(id: IdMenu) {
    limparTimers();
    timers.current.abrir = setTimeout(() => setAberto({ id, rota }), ABRIR_APOS_MS);
  }

  function agendarFechamento() {
    limparTimers();
    timers.current.fechar = setTimeout(() => setAberto(null), FECHAR_APOS_MS);
  }

  // Esc fecha o menu e devolve o foco ao botão que o abriu.
  useEffect(() => {
    if (!menuAberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      clearTimeout(timers.current.abrir);
      clearTimeout(timers.current.fechar);
      setAberto(null);
      gatilhos.current[menuAberto]?.focus();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [menuAberto]);

  // Gaveta do celular: Esc e o botão voltar fecham, a página atrás não rola, e
  // o foco entra na gaveta ao abrir e volta ao botão ao fechar.
  useEffect(() => {
    if (!gavetaAberta) return;
    const fecharGaveta = () => setGaveta(null);
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharGaveta();
    };
    const voltarPara = botaoGaveta.current;

    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("popstate", fecharGaveta);
    document.body.style.overflow = "hidden";
    fecharGavetaRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("popstate", fecharGaveta);
      document.body.style.overflow = "";
      voltarPara?.focus();
    };
  }, [gavetaAberta]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      clearTimeout(t.abrir);
      clearTimeout(t.fechar);
    };
  }, []);

  return (
    <header
      data-superficie="navy"
      className="sticky top-0 z-30 border-b border-white/14 bg-ink text-white"
    >
      {menuAberto && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Fechar menu"
          onClick={fechar}
          className="fixed inset-x-0 top-[72px] bottom-0 cursor-default bg-ink/60"
        />
      )}

      <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center gap-4 px-6 lg:gap-7">
        <Link href={ROTAS.inicio} className="flex items-center gap-2 rounded">
          <Marca />
          <Wordmark className="text-[19px] text-white" />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAVEGACAO.map((intencao) =>
              intencao.href ? (
                <li key={intencao.id}>
                  <Link
                    href={intencao.href}
                    className="block rounded px-2.5 py-2 text-[15px] font-medium text-white/78 hover:bg-white/8 hover:text-white"
                  >
                    {intencao.rotulo}
                  </Link>
                </li>
              ) : (
                <li
                  key={intencao.id}
                  onPointerEnter={(e) => e.pointerType === "mouse" && agendarAbertura(intencao.id)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && agendarFechamento()}
                  onBlur={(e) => {
                    // Sair do item (botão + painel) com Tab fecha o menu. Sem
                    // relatedTarget o foco não foi para lugar nenhum — um clique
                    // num texto do próprio painel —, e aí o menu fica aberto.
                    const destino = e.relatedTarget;
                    if (menuAberto === intencao.id && destino && !e.currentTarget.contains(destino)) {
                      fechar();
                    }
                  }}
                >
                  <button
                    type="button"
                    ref={(el) => {
                      gatilhos.current[intencao.id] = el;
                    }}
                    aria-expanded={menuAberto === intencao.id}
                    aria-controls={`menu-${intencao.id}`}
                    onClick={() => (menuAberto === intencao.id ? fechar() : abrir(intencao.id))}
                    className={`flex items-center gap-1.5 rounded px-2.5 py-2 text-[15px] font-medium ${
                      menuAberto === intencao.id
                        ? "bg-ink-lift text-white"
                        : "text-white/78 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    {intencao.rotulo}
                    <Image
                      src={menuAberto === intencao.id ? setaAcesa : setaApagada}
                      alt=""
                      width={12}
                      height={12}
                      unoptimized
                      className={menuAberto === intencao.id ? "rotate-180" : ""}
                    />
                  </button>

                  {menuAberto === intencao.id && (
                    <div
                      id={`menu-${intencao.id}`}
                      onClick={(e) => {
                        if ((e.target as Element).closest("a")) fechar();
                      }}
                      className="abrir-menu absolute inset-x-0 top-full border-b border-pauta bg-card text-ink shadow-folha"
                      data-superficie="papel"
                    >
                      <div className="mx-auto flex w-full max-w-[1200px] items-start gap-12 px-6 pt-8 pb-9">
                        {intencao.colunas?.map((coluna) => (
                          <ColunaDoPainel key={coluna.titulo ?? coluna.itens[0]?.rotulo} coluna={coluna} />
                        ))}
                        {intencao.destaque && <DestaqueDoPainel destaque={intencao.destaque} />}
                      </div>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:gap-[18px]">
          <Link
            href={ROTAS.login}
            className="hidden rounded py-2 text-[15px] font-medium text-white/78 hover:text-white lg:block"
          >
            Entrar
          </Link>
          <Link
            href={ROTAS.dashboard}
            className="rounded bg-card px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink hover:bg-caderno sm:px-3.5 sm:text-[15px]"
          >
            Minha carteira
          </Link>
          <button
            ref={botaoGaveta}
            type="button"
            onClick={() => setGaveta(rota)}
            aria-label="Abrir menu"
            aria-expanded={gavetaAberta}
            aria-controls="gaveta-do-site"
            className="-mr-2 grid h-11 w-11 place-items-center rounded text-white/78 hover:bg-white/8 hover:text-white lg:hidden"
          >
            <IconeMenu />
          </button>
        </div>
      </div>

      {gavetaAberta && (
        <Gaveta
          fecharRef={fecharGavetaRef}
          aoFechar={() => setGaveta(null)}
        />
      )}
    </header>
  );
}

/** A navegação inteira em tela cheia, para telas estreitas. */
function Gaveta({
  fecharRef,
  aoFechar,
}: {
  fecharRef: React.RefObject<HTMLButtonElement | null>;
  aoFechar: () => void;
}) {
  const [secao, setSecao] = useState<IdMenu | null>(null);

  return (
    <div
      id="gaveta-do-site"
      role="dialog"
      aria-modal="true"
      aria-label="Menu do site"
      data-superficie="navy"
      onClick={(e) => {
        if ((e.target as Element).closest("a")) aoFechar();
      }}
      onKeyDown={(e) => {
        // A gaveta cobre a tela inteira: o Tab dá a volta dentro dela em vez
        // de escapar para a página escondida atrás.
        if (e.key !== "Tab") return;
        const focaveis = e.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (!primeiro || !ultimo) return;
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ink text-white lg:hidden"
    >
      <div className="flex h-[72px] items-center justify-between border-b border-white/14 px-6">
        <Link href={ROTAS.inicio} className="flex items-center gap-2 rounded">
          <Marca />
          <Wordmark className="text-[19px] text-white" />
        </Link>
        <button
          ref={fecharRef}
          type="button"
          onClick={aoFechar}
          aria-label="Fechar menu"
          className="-mr-2 grid h-11 w-11 place-items-center rounded text-white/78 hover:bg-white/8 hover:text-white"
        >
          <IconeFechar tamanho={20} />
        </button>
      </div>

      <nav aria-label="Principal" className="px-6 py-4">
        <ul className="divide-y divide-white/14">
          {NAVEGACAO.map((intencao) =>
            intencao.href ? (
              <li key={intencao.id}>
                <Link href={intencao.href} className="flex min-h-12 items-center py-3 text-[17px] font-medium">
                  {intencao.rotulo}
                </Link>
              </li>
            ) : (
              <li key={intencao.id}>
                <button
                  type="button"
                  aria-expanded={secao === intencao.id}
                  aria-controls={`gaveta-${intencao.id}`}
                  onClick={() => setSecao((atual) => (atual === intencao.id ? null : intencao.id))}
                  className="flex min-h-12 w-full items-center justify-between py-3 text-left text-[17px] font-medium"
                >
                  {intencao.rotulo}
                  <Image
                    src={secao === intencao.id ? setaAcesa : setaApagada}
                    alt=""
                    width={12}
                    height={12}
                    unoptimized
                    className={secao === intencao.id ? "rotate-180" : ""}
                  />
                </button>
                {secao === intencao.id && (
                  <div id={`gaveta-${intencao.id}`} className="space-y-5 pb-5">
                    {intencao.colunas?.map((coluna) => (
                      <div key={coluna.titulo ?? coluna.itens[0]?.rotulo}>
                        {coluna.titulo && <p className="mb-1 text-[13px] text-white/62">{coluna.titulo}</p>}
                        <ul>
                          {coluna.itens.map((item) => (
                            <li key={item.rotulo}>
                              {item.href ? (
                                <Link href={item.href} className="flex min-h-11 items-center py-2.5 text-[15px] text-white/78 hover:text-white">
                                  {item.rotulo}
                                </Link>
                              ) : (
                                <p className="flex min-h-11 items-center gap-2 py-2.5 text-[15px] text-white/62">
                                  {item.numero !== undefined && <span aria-hidden>{item.numero}.</span>}
                                  {item.rotulo}
                                  <span className="text-xs">em breve</span>
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {intencao.destaque?.link.href && (
                      <Link
                        href={intencao.destaque.link.href}
                        className="inline-flex min-h-11 items-center text-[15px] font-semibold text-white underline decoration-1 underline-offset-4"
                      >
                        {intencao.destaque.link.rotulo}
                      </Link>
                    )}
                  </div>
                )}
              </li>
            ),
          )}
          <li>
            <Link href={ROTAS.login} className="flex min-h-12 items-center py-3 text-[17px] font-medium">
              Entrar
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
