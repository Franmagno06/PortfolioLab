"use client";

import { useCallback, useEffect, useState } from "react";
import { NovaTransacao } from "@/components/nova-transacao";
import { ProventosCard } from "@/components/proventos-card";
import { Botao } from "@/components/ui/botao";
import { EmptyState } from "@/components/ui/empty-state";
import { EtiquetaClasse } from "@/components/ui/etiqueta-classe";
import { MensagemErro } from "@/components/ui/mensagem";
import { PageHeader, Pilula } from "@/components/ui/page-header";
import { SkeletonPagina } from "@/components/ui/skeleton";
import { CabecalhoTabela, CardTabela } from "@/components/ui/tabela";
import { api, ApiError } from "@/lib/api";
import { brl, coresClasse, pct } from "@/lib/format";

type Posicao = {
  ticker: string;
  name: string;
  type: string;
  quantidade: number;
  precoMedio: number;
  precoAtual: number;
  valorAplicado: number;
  valorAtual: number;
  lucro: number;
  lucroPct: number;
};

type Ativo = { ticker: string; name: string };

const colunas = [
  { rotulo: "Ativo" },
  { rotulo: "Classe" },
  { rotulo: "Qtd.", direita: true },
  { rotulo: "Preço médio", direita: true },
  { rotulo: "Preço atual", direita: true },
  { rotulo: "Valor atual", direita: true },
  { rotulo: "Resultado", direita: true },
  { rotulo: "% carteira", direita: true },
];

export default function CarteiraPage() {
  const [ativos, setAtivos] = useState<Posicao[] | null>(null);
  const [disponiveis, setDisponiveis] = useState<Ativo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);

  const carregar = useCallback(() => {
    api<Posicao[]>("/portfolio")
      .then(setAtivos)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Falha ao carregar a carteira"),
      );
  }, []);

  useEffect(() => {
    carregar();
    api<Ativo[]>("/assets")
      .then(setDisponiveis)
      .catch(() => setDisponiveis([]));
  }, [carregar]);

  if (erro) return <MensagemErro>{erro}</MensagemErro>;
  if (!ativos) return <SkeletonPagina blocos={2} />;

  const patrimonio = ativos.reduce((s, a) => s + a.valorAtual, 0);
  const totalAplicado = ativos.reduce((s, a) => s + a.valorAplicado, 0);
  const lucroTotal = patrimonio - totalAplicado;

  // Do maior para o menor: a ordem já conta quem pesa mais, antes de ler número.
  const ordenados = [...ativos].sort((a, b) => b.valorAtual - a.valorAtual);
  const fatiaDe = (valor: number) => (patrimonio === 0 ? 0 : (valor / patrimonio) * 100);
  // A barra mede contra a MAIOR posição, não contra 100%. Com 16 ativos de 3%
  // a 10% cada, medir contra 100% desenhava barras de 2 a 6 pixels — pontos,
  // e não barras. Contra o maior, a diferença entre eles fica visível; o
  // número ao lado continua sendo o percentual real da carteira.
  const maiorFatia = ordenados[0] ? fatiaDe(ordenados[0].valorAtual) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Minha carteira"
        descricao="Posição consolidada, derivada das suas transações"
        contexto={
          ativos.length > 0 ? (
            <Pilula>
              {ativos.length} {ativos.length === 1 ? "ativo" : "ativos"}
            </Pilula>
          ) : undefined
        }
        acao={
          !registrando && (
            <Botao onClick={() => setRegistrando(true)}>Nova transação</Botao>
          )
        }
      />

      <NovaTransacao
        aberto={registrando}
        aoFechar={() => setRegistrando(false)}
        aoCriar={carregar}
      />

      {ativos.length === 0 ? (
        <EmptyState
          titulo="Sua carteira está vazia"
          descricao="Registre sua primeira compra para ver preço médio, resultado e distribuição por classe."
        >
          <Botao onClick={() => setRegistrando(true)}>Registrar primeira compra</Botao>
        </EmptyState>
      ) : (
        <CardTabela larguraMinima="min-w-205">
          <CabecalhoTabela colunas={colunas} />
          <tbody>
            {ordenados.map((a) => {
              const cor = coresClasse[a.type] ?? "var(--color-mute)";
              const ganhou = a.lucro >= 0;
              const fatia = fatiaDe(a.valorAtual);
              const fatiaTexto = `${fatia.toFixed(1).replace(".", ",")}%`;
              const comprimento = maiorFatia === 0 ? 0 : (fatia / maiorFatia) * 100;
              return (
                <tr
                  key={a.ticker}
                  className="border-b border-line last:border-0 hover:bg-paper"
                >
                  <td className="py-3.5 pr-3 pl-5">
                    <p className="font-mono font-semibold">{a.ticker}</p>
                    {/* nomes de ETF vêm do Yahoo com até 90 caracteres: duas
                        linhas bastam para reconhecer, o title guarda o resto */}
                    <p className="line-clamp-2 max-w-52 text-xs text-mute" title={a.name}>
                      {a.name}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    <EtiquetaClasse tipo={a.type} />
                  </td>
                  <td className="tnum px-3 py-3.5 text-right font-mono">{a.quantidade}</td>
                  <td className="tnum px-3 py-3.5 text-right font-mono text-mute">
                    {brl(a.precoMedio)}
                  </td>
                  <td className="tnum px-3 py-3.5 text-right font-mono">{brl(a.precoAtual)}</td>
                  <td className="tnum px-3 py-3.5 text-right font-mono font-semibold">
                    {brl(a.valorAtual)}
                  </td>
                  <td
                    className={`tnum px-3 py-3.5 text-right font-mono font-semibold whitespace-nowrap ${
                      ganhou ? "text-gain-ink" : "text-loss-ink"
                    }`}
                  >
                    {brl(a.lucro)}
                    <span className="ml-1 text-xs opacity-80">({pct(a.lucroPct)})</span>
                  </td>
                  <td className="py-3.5 pr-5 pl-3">
                    <div
                      className="flex items-center justify-end gap-2.5"
                      title={`${a.ticker}: ${brl(a.valorAtual)}, ${fatiaTexto} da carteira`}
                    >
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-line/50">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${comprimento}%`, background: cor }}
                        />
                      </div>
                      <span className="tnum w-12 text-right font-mono text-xs text-ink-soft">
                        {fatiaTexto}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-paper text-[13px] font-semibold">
              <td className="py-3.5 pr-3 pl-5" colSpan={5}>
                Total
              </td>
              <td className="tnum px-3 py-3.5 text-right font-mono">{brl(patrimonio)}</td>
              <td
                className={`tnum px-3 py-3.5 text-right font-mono ${
                  lucroTotal >= 0 ? "text-gain-ink" : "text-loss-ink"
                }`}
              >
                {brl(lucroTotal)}
              </td>
              <td className="tnum py-3.5 pr-5 pl-3 text-right font-mono text-xs text-mute">
                100%
              </td>
            </tr>
          </tfoot>
        </CardTabela>
      )}

      <ProventosCard ativos={disponiveis} />
    </div>
  );
}
