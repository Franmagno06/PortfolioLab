"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Armadilha } from "@/components/aprender/armadilha";
import { ExplicacaoQueAbre } from "@/components/movimento/explicacao-que-abre";
import { Card, TituloCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MensagemErro } from "@/components/ui/mensagem";
import { PageHeader, Pilula } from "@/components/ui/page-header";
import { SkeletonPagina } from "@/components/ui/skeleton";
import { CabecalhoTabela, CardTabela } from "@/components/ui/tabela";
import { api, ApiError } from "@/lib/api";
import { ANCORA_DA_DICA, INDICADORES } from "@/content/aprender/indicadores";
import { indicadorOuTraco, pctIndicadorOuTraco, tempoRelativo } from "@/lib/format";
import { DICAS, type IdDaDica } from "@/lib/indicadores-explicados";

type IndicadorDeAtivo = {
  ticker: string;
  name: string;
  pl: number | null;
  pvp: number | null;
  dividendYield: number | null;
  roe: number | null;
  roa: number | null;
  margemLiquida: number | null;
  /** true = a última coluna mostra ROA no lugar de margem líquida (padrão de mercado para bancos). */
  setorBancario: boolean;
  atualizadoEm: string | null;
};

const colunas = [
  { rotulo: "Ativo" },
  { rotulo: "P/L", direita: true },
  { rotulo: "P/VP", direita: true },
  { rotulo: "Dividend Yield", direita: true },
  { rotulo: "ROE", direita: true },
  { rotulo: "Margem líquida", direita: true },
];

/** Os indicadores das colunas da tabela, com o mesmo nome do cabeçalho. ROA só entra se houver banco. */
const EXPLICADOS: { nome: string; dica: IdDaDica }[] = [
  { nome: "P/L", dica: "pl" },
  { nome: "P/VP", dica: "pvp" },
  { nome: "Dividend Yield", dica: "dy12m" },
  { nome: "ROE", dica: "roe" },
  { nome: "Margem líquida", dica: "margemLiquida" },
  { nome: "ROA", dica: "roa" },
];

/**
 * Os números ficam na tabela; aqui, cada indicador tem o nome e a frase do que mede sempre à
 * vista (a mesma explicação do "?" das fichas), e se abre para a armadilha de leitura e o link
 * para o cartão em /aprender/indicadores. O corpo nunca repete a frase.
 */
function OQueCadaIndicadorMede({ comBanco }: { comBanco: boolean }) {
  const itens = EXPLICADOS.filter((e) => e.dica !== "roa" || comBanco);
  return (
    <Card>
      <div role="region" aria-labelledby="titulo-o-que-mede">
        <TituloCard>
          <span id="titulo-o-que-mede">O que cada indicador mede</span>
        </TituloCard>
        <ul className="mt-3 divide-y divide-line">
          {itens.map(({ nome, dica }) => {
            const ancora = ANCORA_DA_DICA[dica];
            const armadilha = INDICADORES.find((i) => i.id === ancora)?.armadilha;
            return (
              <li key={dica} className="py-3">
                <ExplicacaoQueAbre
                  id={`explicacao-carteira-${dica}`}
                  rotulo={nome}
                  nomeAcessivel={`${nome}: onde a leitura engana`}
                  resumo={<p className="max-w-prose leading-[21px]">{DICAS[dica].texto}</p>}
                >
                  <div className="flex max-w-prose flex-col gap-2">
                    {armadilha && <Armadilha>{armadilha}</Armadilha>}
                    {ancora && (
                      <Link
                        href={`/aprender/indicadores#${ancora}`}
                        className="toque flex min-h-11 w-fit items-center rounded text-[13px] leading-[19px] font-semibold underline decoration-1 underline-offset-4"
                      >
                        Saiba mais <span className="sr-only">sobre {nome}</span>
                      </Link>
                    )}
                  </div>
                </ExplicacaoQueAbre>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

export default function IndicadoresPage() {
  const [indicadores, setIndicadores] = useState<IndicadorDeAtivo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<IndicadorDeAtivo[]>("/indicators")
      .then(setIndicadores)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar os indicadores"),
      );
  }, []);

  if (erro) return <MensagemErro>{erro}</MensagemErro>;
  if (!indicadores) return <SkeletonPagina blocos={1} />;

  const maisRecente = indicadores.reduce<string | null>((acc, i) => {
    if (!i.atualizadoEm) return acc;
    if (!acc || i.atualizadoEm > acc) return i.atualizadoEm;
    return acc;
  }, null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Indicadores"
        descricao="P/L, P/VP, dividend yield, ROE e margem líquida das ações da sua carteira"
        contexto={maisRecente ? <Pilula>Atualizado {tempoRelativo(maisRecente)}</Pilula> : undefined}
      />

      {indicadores.length === 0 ? (
        <EmptyState
          titulo="Nenhuma ação na carteira"
          descricao="Indicadores fundamentalistas só existem para ações. Registre uma compra na aba Posições para vê-los aqui."
        />
      ) : (
        <CardTabela larguraMinima="min-w-190">
          <CabecalhoTabela colunas={colunas} />
          <tbody>
            {indicadores.map((i) => (
              <tr key={i.ticker} className="linha-de-tabela border-b border-line last:border-0 hover:bg-paper has-[:focus-visible]:bg-paper">
                <td className="py-3.5 pr-3 pl-5">
                  <p className="tnum font-semibold">{i.ticker}</p>
                  <p className="text-xs text-mute">{i.name}</p>
                </td>
                <td className="tnum px-3 py-3.5 text-right">
                  {indicadorOuTraco(i.pl)}
                </td>
                <td className="tnum px-3 py-3.5 text-right">
                  {indicadorOuTraco(i.pvp)}
                </td>
                <td className="tnum px-3 py-3.5 text-right">
                  {pctIndicadorOuTraco(i.dividendYield)}
                </td>
                <td className="tnum px-3 py-3.5 text-right">
                  {pctIndicadorOuTraco(i.roe)}
                </td>
                <td className="tnum py-3.5 pr-5 pl-3 text-right">
                  {pctIndicadorOuTraco(i.setorBancario ? i.roa : i.margemLiquida)}
                  {i.setorBancario && (
                    <span className="ml-1 font-sans text-[11px] font-normal text-mute">ROA</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </CardTabela>
      )}

      {indicadores.some((i) => i.setorBancario) && (
        <p className="text-xs text-mute">
          Para bancos, a última coluna traz ROA no lugar da margem líquida: é o indicador que o
          mercado usa para comparar instituições financeiras.
        </p>
      )}

      {indicadores.length > 0 && (
        <OQueCadaIndicadorMede comBanco={indicadores.some((i) => i.setorBancario)} />
      )}
    </div>
  );
}
