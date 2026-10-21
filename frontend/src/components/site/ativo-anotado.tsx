import { Fragment } from "react";
import Link from "next/link";
import { brl, indicadorOuTraco, numero, pct, percentual, vezesPorExtenso } from "@/lib/format";
import { ROTAS } from "@/lib/navegacao";
import { ATIVO_DE_EXEMPLO as ativo, atende, CRITERIOS_DE_EXEMPLO } from "@/lib/site-dados";

/*
 * "Cada número vem com a explicação ao lado": a folha de um ativo real com a
 * anotação de cada indicador na margem, e o painel dos critérios do usuário.
 *
 * Sem nota, ranking ou selo, de propósito. Pela Resolução CVM 20, texto sobre
 * um ativo específico que possa influenciar a decisão de investir é relatório
 * de análise, e um aviso de "não é recomendação" não basta. A página explica o
 * que o número mede; quem julga o ativo são os critérios do próprio usuário.
 */

const INDICADORES = [
  {
    nome: "Preço/lucro (P/L)",
    valor: indicadorOuTraco(ativo.pl),
    nota: `Pelo preço de hoje, o lucro dos últimos 12 meses levaria cerca de ${numero(Math.round(ativo.pl))} anos para pagar a empresa.`,
  },
  {
    nome: "Preço/valor patrimonial (P/VP)",
    valor: indicadorOuTraco(ativo.pvp),
    nota: `O mercado paga ${brl(ativo.pvp)} por cada R$ 1 de patrimônio da ${ativo.nome}.`,
  },
  {
    nome: "Dividend yield em 12 meses",
    valor: percentual(ativo.dy12m),
    nota: `Pagou ${brl(ativo.proventos12m.porUnidade)} por unidade nos últimos 12 meses, em ${vezesPorExtenso(ativo.proventos12m.pagamentos)}.`,
  },
  {
    nome: "Retorno sobre o patrimônio (ROE)",
    valor: percentual(ativo.roe),
    nota: `Gerou ${brl(ativo.roe)} de lucro para cada R$ 100 de patrimônio.`,
  },
];

const margem = "border-l-[1.5px] border-anotacao-margem";
const textoAnotacao = "font-leitura text-[15px] leading-[22px] italic text-anotacao";

export function AtivoAnotado() {
  const subiu = ativo.variacaoNoMes >= 0;
  return (
    <article
      aria-labelledby="folha-do-ativo"
      className="overflow-hidden rounded-md border border-pauta bg-card text-ink shadow-folha"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-pauta px-6 pt-6 pb-[22px]">
        <div>
          <h3 id="folha-do-ativo" className="text-[30px] leading-tight font-bold tracking-[-0.005em]">
            {ativo.ticker}
          </h3>
          <p className="mt-1 text-[15px] text-ink-2">
            {ativo.nome}, {ativo.descricao}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="tnum text-[30px] leading-tight font-semibold tracking-[-0.005em]">{brl(ativo.preco)}</p>
          {/* com sinal, além da cor */}
          <p className={`tnum mt-1 text-sm font-medium ${subiu ? "text-gain-ink" : "text-loss-ink"}`}>
            {pct(ativo.variacaoNoMes)} em {ativo.mesDaVariacao}
          </p>
        </div>
      </div>

      <table className="w-full md:table-fixed">
        <caption className="sr-only">Indicadores da {ativo.ticker}, com a explicação de cada um</caption>
        {/* Larguras no colgroup: no layout fixo, o Chrome não as lê da primeira linha do tbody */}
        <colgroup>
          <col className="md:w-[352px]" />
          <col className="md:w-[104px]" />
          <col className="md:w-[304px]" />
        </colgroup>
        <tbody>
          {INDICADORES.map((i) => (
            <Fragment key={i.nome}>
              <tr className="md:border-b md:border-pauta">
                <th scope="row" className="py-3.5 pr-4 pl-6 text-left text-[15px] font-normal text-ink-2">
                  {i.nome}
                </th>
                <td className="tnum py-3.5 pr-5 text-right text-[19px] font-semibold whitespace-nowrap">
                  {i.valor}
                </td>
                <td className={`hidden py-3 pr-2.5 pl-[18px] md:table-cell ${margem} ${textoAnotacao}`}>
                  {i.nota}
                </td>
              </tr>
              <tr className="border-b border-pauta md:hidden">
                <td colSpan={2} className="pt-0 pr-5 pb-3.5 pl-6">
                  <p className={`pl-3 ${margem} ${textoAnotacao}`}>{i.nota}</p>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-4 pb-[18px]">
        <p className="text-xs text-mute">
          Dados de {ativo.fechamento}, calculados a partir do Yahoo Finance.
        </p>
        <Link
          href={ROTAS.indicadores}
          className="text-sm font-medium text-ink underline decoration-1 underline-offset-4"
        >
          Ver os indicadores da minha carteira
        </Link>
      </div>
    </article>
  );
}

export function PainelDeCriterios() {
  return (
    <div className="flex flex-col gap-3.5 rounded-md border border-pauta bg-card p-7 text-ink">
      <h3 className="font-leitura text-2xl leading-[30px] font-semibold">Seus critérios</h3>
      <p className="text-sm leading-[21px] text-ink-2">
        Em breve, você escreve as regras e o PortfolioLab confere se o ativo atende. Um exemplo:
      </p>
      <ul className="border-t border-pauta pt-1">
        {CRITERIOS_DE_EXEMPLO.map((c) => {
          const ok = atende(ativo, c);
          return (
            <li key={c.rotulo} className="flex items-center justify-between gap-3 border-b border-pauta py-3">
              <span className="text-[15px]">{c.rotulo}</span>
              {/* cinza, e não vermelho, quando não atende: não é um julgamento */}
              <span className={`text-sm font-semibold whitespace-nowrap ${ok ? "text-gain-ink" : "text-mute"}`}>
                {ok ? "atende" : "não atende"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="font-leitura text-sm leading-[21px] italic text-anotacao">
        Atender aos seus critérios não transforma o ativo em recomendação: é a sua régua, aplicada aos números
        dele.
      </p>
    </div>
  );
}
