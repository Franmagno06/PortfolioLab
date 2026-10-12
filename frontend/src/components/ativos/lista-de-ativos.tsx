"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ativos/pecas";
import { Dica } from "@/components/ativos/dica";
import { QUANTIDADE_INICIAL } from "@/lib/ativos-catalogo";
import type { AcaoResumo, EtfResumo, FiiResumo, TipoFii } from "@/lib/ativos-tipos";
import { brlOuTraco, numero, percentual } from "@/lib/format";
import type { IdDaDica } from "@/lib/indicadores-explicados";
import { ROTAS } from "@/lib/navegacao";

/*
 * A listagem de ações e de FIIs. No computador é uma tabela; abaixo de 768 px
 * vira uma lista de cards, porque rolar uma tabela de lado no celular esconde
 * justamente os indicadores. Nos dois casos a linha inteira é o link da ficha:
 * um <a> de verdade (abre em nova aba, aparece ao focar, funciona sem script),
 * esticado sobre a linha por um pseudo-elemento.
 */

type Papel = "texto" | "chip" | "preco" | "indicador";

type Coluna<T> = {
  id: string;
  rotulo: string;
  papel: Papel;
  dica?: IdDaDica;
  valor: (item: T) => string;
  /** Larguras só no computador, onde há colunas. */
  largura?: string;
};

const umaCasa = (v: number | null) => (v === null ? "—" : numero(v, 1));
const duasCasas = (v: number | null) => (v === null ? "—" : numero(v, 2));
const pctOuTraco = (v: number | null) => (v === null ? "—" : percentual(v));

const COLUNAS_ACOES: Coluna<AcaoResumo>[] = [
  { id: "setor", rotulo: "Setor", papel: "texto", valor: (a) => a.setor, largura: "w-[20%]" },
  { id: "preco", rotulo: "Preço", papel: "preco", valor: (a) => brlOuTraco(a.preco) },
  { id: "pl", rotulo: "P/L", papel: "indicador", dica: "pl", valor: (a) => umaCasa(a.pl) },
  { id: "pvp", rotulo: "P/VP", papel: "indicador", dica: "pvp", valor: (a) => umaCasa(a.pvp) },
  { id: "dy12m", rotulo: "DY 12m", papel: "indicador", dica: "dy12m", valor: (a) => pctOuTraco(a.dy12m) },
  { id: "roe", rotulo: "ROE", papel: "indicador", dica: "roe", valor: (a) => pctOuTraco(a.roe) },
];

const COLUNAS_FIIS: Coluna<FiiResumo>[] = [
  { id: "tipo", rotulo: "Tipo", papel: "chip", dica: "tipoFii", valor: (f) => f.tipo, largura: "w-[12%]" },
  { id: "segmento", rotulo: "Segmento", papel: "texto", valor: (f) => f.segmento, largura: "w-[22%]" },
  { id: "preco", rotulo: "Preço", papel: "preco", valor: (f) => brlOuTraco(f.preco) },
  { id: "dy12m", rotulo: "DY 12m", papel: "indicador", dica: "dyFii", valor: (f) => pctOuTraco(f.dy12m) },
  { id: "pvp", rotulo: "P/VP", papel: "indicador", dica: "pvpFii", valor: (f) => duasCasas(f.pvp) },
];

const COLUNAS_ETFS: Coluna<EtfResumo>[] = [
  { id: "categoria", rotulo: "Categoria", papel: "chip", dica: "categoriaEtf", valor: (e) => e.categoria },
  { id: "indice", rotulo: "Índice", papel: "texto", dica: "indiceEtf", valor: (e) => e.indice, largura: "w-[22%]" },
  { id: "preco", rotulo: "Preço", papel: "preco", valor: (e) => brlOuTraco(e.preco) },
  { id: "retorno12m", rotulo: "Var. 12m", papel: "indicador", dica: "retorno12m", valor: (e) => pctOuTraco(e.retorno12m) },
  { id: "dy12m", rotulo: "DY 12m", papel: "indicador", dica: "dyEtf", valor: (e) => pctOuTraco(e.dy12m) },
];

type Ativo = { ticker: string; nome: string; tipo?: TipoFii };

type Props<T extends Ativo> = {
  itens: T[];
  colunas: Coluna<T>[];
  /** "/ativos/acoes": a ficha de cada um fica em `${hrefBase}/${ticker}`. */
  hrefBase: string;
  /** Para o texto do botão e da contagem: "ações" ou "fundos". */
  plural: string;
  rotuloDoAtivo: string;
  legendaDaTabela: string;
  /** ETF não tem logo nem tipo de FII: o avatar vira o ícone de ETF. */
  etf?: boolean;
};

function Listagem<T extends Ativo>({ itens, colunas, hrefBase, plural, rotuloDoAtivo, legendaDaTabela, etf }: Props<T>) {
  const [todas, setTodas] = useState(false);
  const visiveis = todas ? itens : itens.slice(0, QUANTIDADE_INICIAL);
  const idDaLista = `lista-${plural}`;
  const preco = colunas.find((c) => c.papel === "preco");
  const textos = colunas.filter((c) => c.papel === "texto" || c.papel === "chip");
  const indicadores = colunas.filter((c) => c.papel === "indicador");

  return (
    <div>
      <div id={idDaLista}>
        {/* Computador: tabela */}
        <div className="hidden rounded-md border border-line bg-card md:block">
          <table className="w-full text-sm">
            <caption className="sr-only">{legendaDaTabela}</caption>
            <thead>
              <tr className="bg-caderno text-xs text-mute">
                <th scope="col" className="rounded-tl-md py-3 pr-3 pl-6 text-left font-medium">
                  {rotuloDoAtivo}
                </th>
                {colunas.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className={`px-3 py-1 font-medium ${c.papel === "preco" || c.papel === "indicador" ? "text-right" : "text-left"} ${c.largura ?? ""}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {c.rotulo}
                      {c.dica && <Dica id={c.dica} />}
                    </span>
                  </th>
                ))}
                <th scope="col" className="w-12 rounded-tr-md py-3 pr-4">
                  <span className="sr-only">Abrir a ficha</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((item) => (
                <tr key={item.ticker} className="group relative border-t border-line hover:bg-paper">
                  <td className="py-3.5 pr-3 pl-6">
                    <div className="flex items-center gap-3.5">
                      <Avatar ticker={item.ticker} tamanho="lista" tipoFii={item.tipo} etf={etf} />
                      <Link
                        href={`${hrefBase}/${item.ticker}`}
                        className="block min-w-0 rounded after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink"
                      >
                        <span className="block font-leitura text-base leading-6 font-semibold text-ink">{item.ticker}</span>
                        <span className="block text-[13px] leading-5 text-ink-2">{item.nome}</span>
                      </Link>
                    </div>
                  </td>
                  {colunas.map((c) => (
                    <td
                      key={c.id}
                      className={`px-3 py-3.5 ${
                        c.papel === "preco"
                          ? "tnum text-right text-[15px] font-semibold text-ink"
                          : c.papel === "indicador"
                            ? "tnum text-right text-[15px] text-ink"
                            : "text-left text-ink-2"
                      }`}
                    >
                      {c.papel === "chip" ? (
                        <span className="inline-block rounded-full border border-line bg-paper px-2.5 py-0.5 text-[13px] text-ink">
                          {c.valor(item)}
                        </span>
                      ) : (
                        c.valor(item)
                      )}
                    </td>
                  ))}
                  <td aria-hidden className="py-3.5 pr-4 text-right text-mute group-hover:text-ink">
                    <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Celular: um card por ativo */}
        <ul className="space-y-3 md:hidden">
          {visiveis.map((item) => (
            <li key={item.ticker} className="relative rounded-md border border-line bg-card p-4 active:bg-paper">
              <div className="flex items-start gap-3">
                <Avatar ticker={item.ticker} tamanho="lista" tipoFii={item.tipo} etf={etf} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`${hrefBase}/${item.ticker}`}
                    className="block rounded after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink"
                  >
                    <span className="block font-leitura text-base leading-6 font-semibold text-ink">{item.ticker}</span>
                    <span className="block text-[13px] leading-5 text-ink-2">{item.nome}</span>
                  </Link>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
                    {textos.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1">
                        {c.papel === "chip" ? (
                          <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-ink">{c.valor(item)}</span>
                        ) : (
                          c.valor(item)
                        )}
                        {c.dica && (
                          <span className="relative z-10">
                            <Dica id={c.dica} />
                          </span>
                        )}
                      </span>
                    ))}
                  </p>
                </div>
                {preco && <p className="tnum shrink-0 text-base font-semibold text-ink">{preco.valor(item)}</p>}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line pt-3 text-sm">
                {indicadores.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <dt className="inline-flex items-center gap-1.5 text-ink-2">
                      {c.rotulo}
                      {c.dica && (
                        <span className="relative z-10">
                          <Dica id={c.dica} />
                        </span>
                      )}
                    </dt>
                    <dd className="tnum font-medium text-ink">{c.valor(item)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          aria-expanded={todas}
          aria-controls={idDaLista}
          onClick={() => setTodas((v) => !v)}
          className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded border border-ink bg-card px-4 text-[15px] font-semibold text-ink hover:bg-caderno"
        >
          {todas ? `Mostrar só as ${QUANTIDADE_INICIAL}` : `Ver todas as ${itens.length}`}
          <svg className={todas ? "rotate-180" : ""} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <p role="status" className="text-sm text-mute">
          Mostrando {visiveis.length} de {itens.length} {plural} do catálogo.
        </p>
      </div>
    </div>
  );
}

export function ListaDeAcoes({ itens }: { itens: AcaoResumo[] }) {
  return (
    <Listagem
      itens={itens}
      colunas={COLUNAS_ACOES}
      hrefBase={ROTAS.acoes}
      plural="ações"
      rotuloDoAtivo="Ativo"
      legendaDaTabela="Ações do catálogo, com preço e indicadores. Cada linha abre a ficha da ação."
    />
  );
}

export function ListaDeEtfs({ itens }: { itens: EtfResumo[] }) {
  return (
    <Listagem
      itens={itens}
      colunas={COLUNAS_ETFS}
      hrefBase={ROTAS.etfs}
      plural="ETFs"
      rotuloDoAtivo="ETF"
      legendaDaTabela="ETFs do catálogo, com preço e indicadores. Cada linha abre a ficha do ETF."
      etf
    />
  );
}

export function ListaDeFiis({ itens }: { itens: FiiResumo[] }) {
  return (
    <Listagem
      itens={itens}
      colunas={COLUNAS_FIIS}
      hrefBase={ROTAS.fiis}
      plural="fundos"
      rotuloDoAtivo="Fundo"
      legendaDaTabela="Fundos imobiliários do catálogo, com preço e indicadores. Cada linha abre a ficha do fundo."
    />
  );
}
