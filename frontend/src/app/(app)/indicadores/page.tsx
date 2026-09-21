"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { MensagemErro } from "@/components/ui/mensagem";
import { PageHeader, Pilula } from "@/components/ui/page-header";
import { SkeletonPagina } from "@/components/ui/skeleton";
import { CabecalhoTabela, CardTabela } from "@/components/ui/tabela";
import { api, ApiError } from "@/lib/api";
import { indicadorOuTraco, pctIndicadorOuTraco, tempoRelativo } from "@/lib/format";

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
          descricao="Indicadores fundamentalistas só existem para ações. Registre uma compra na aba Carteira para vê-los aqui."
        />
      ) : (
        <CardTabela larguraMinima="min-w-190">
          <CabecalhoTabela colunas={colunas} />
          <tbody>
            {indicadores.map((i) => (
              <tr key={i.ticker} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="py-3.5 pr-3 pl-5">
                  <p className="font-mono font-semibold">{i.ticker}</p>
                  <p className="text-xs text-mute">{i.name}</p>
                </td>
                <td className="tnum px-3 py-3.5 text-right font-mono">
                  {indicadorOuTraco(i.pl)}
                </td>
                <td className="tnum px-3 py-3.5 text-right font-mono">
                  {indicadorOuTraco(i.pvp)}
                </td>
                <td className="tnum px-3 py-3.5 text-right font-mono">
                  {pctIndicadorOuTraco(i.dividendYield)}
                </td>
                <td className="tnum px-3 py-3.5 text-right font-mono">
                  {pctIndicadorOuTraco(i.roe)}
                </td>
                <td className="tnum py-3.5 pr-5 pl-3 text-right font-mono">
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
    </div>
  );
}
