import type { ReactNode } from "react";
import Link from "next/link";
import { ExplicacaoQueAbre } from "@/components/movimento/explicacao-que-abre";
import { brl, brlComCasas, indicadorOuTraco, pct, percentual } from "@/lib/format";
import {
  ARMADILHAS,
  DICAS,
  leituraDy,
  leituraMargem,
  leituraPl,
  leituraPvpAcao,
  leituraRoe,
} from "@/lib/indicadores-explicados";
import { ROTAS } from "@/lib/navegacao";
import { ATIVO_DE_EXEMPLO as ativo, atende, CRITERIOS_DE_EXEMPLO } from "@/lib/site-dados";
import { ReguaPvp } from "./regua-pvp";

/*
 * "Como ler um ativo": a folha do TAEE11 com uma explicação que se abre por indicador.
 *
 * Por que existe: o número e a frase de leitura ficam sempre à vista; a conta com os números do
 * exemplo, a explicação e a armadilha abrem sob demanda, para quem quer entender de verdade.
 *
 * Sem nota, ranking ou selo, de propósito. Pela Resolução CVM 20, texto sobre um ativo específico que
 * possa influenciar a decisão de investir é relatório de análise, e um aviso de "não é recomendação"
 * não basta. A página explica o que o número mede; quem julga o ativo são os critérios do usuário.
 * Por isso só o P/VP tem régua (referência neutra: 1,0 = o patrimônio contábil) e nenhuma diz
 * "barato" ou "caro".
 */

const linkDoCard = "inline-flex min-h-11 items-center text-sm font-medium text-ink underline decoration-1 underline-offset-4";
const conta = "tnum text-[15px] font-semibold text-ink";

function Conta({ formula, numeros }: { formula: string; numeros: string }) {
  return (
    <div className="rounded-md bg-caderno px-4 py-3">
      <p className="text-sm text-ink-2">{formula}</p>
      <p className={`mt-1 ${conta}`}>{numeros}</p>
    </div>
  );
}

function Corpo({ conta: c, explicacao, armadilha, extra, nota }: { conta: ReactNode; explicacao: string; armadilha?: string; extra?: ReactNode; nota?: string }) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      {c}
      {extra}
      <p className="text-sm leading-[21px] text-ink-2">{explicacao}</p>
      {nota && <p className="text-sm leading-[21px] text-ink-2">{nota}</p>}
      {armadilha && (
        <p className="border-l-[1.5px] border-anotacao-margem pl-3 font-leitura text-sm leading-[21px] italic text-anotacao">
          Armadilha: {armadilha}
        </p>
      )}
    </div>
  );
}

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

      <div className="divide-y divide-pauta px-6">
        <div className="py-2">
          <ExplicacaoQueAbre
            id="conta-pl"
            rotulo="Preço/lucro (P/L)"
            valor={indicadorOuTraco(ativo.pl)}
            resumo={leituraPl(ativo.pl)}
          >
            <Corpo
              conta={<Conta formula="preço ÷ lucro por Unit = P/L" numeros={`${brl(ativo.preco)} ÷ ${brl(ativo.lucroPorAcao)} = ${indicadorOuTraco(ativo.pl)}`} />}
              explicacao={DICAS.pl.texto}
              armadilha={ARMADILHAS.pl}
            />
          </ExplicacaoQueAbre>
        </div>

        <div className="py-2">
          <ExplicacaoQueAbre
            id="conta-pvp"
            rotulo="Preço/valor patrimonial (P/VP)"
            valor={indicadorOuTraco(ativo.pvp)}
            resumo={leituraPvpAcao(ativo.pvp)}
          >
            <Corpo
              conta={<Conta formula="preço ÷ patrimônio por Unit = P/VP" numeros={`${brl(ativo.preco)} ÷ ${brl(ativo.valorPatrimonialPorAcao)} = ${indicadorOuTraco(ativo.pvp)}`} />}
              extra={<ReguaPvp pvp={ativo.pvp} />}
              explicacao={DICAS.pvp.texto}
            />
          </ExplicacaoQueAbre>
        </div>

        <div className="py-2">
          <ExplicacaoQueAbre
            id="conta-dy"
            rotulo="Dividend yield em 12 meses"
            valor={percentual(ativo.dy12m, 2)}
            resumo={leituraDy(ativo.dy12m)}
          >
            <Corpo
              conta={<Conta formula="proventos pagos em 12 meses ÷ preço = DY" numeros={`${brlComCasas(ativo.proventos12m.porUnidade, 4)} ÷ ${brl(ativo.preco)} = ${percentual(ativo.dy12m, 2)}`} />}
              explicacao={DICAS.dy12m.texto}
              armadilha={ARMADILHAS.dyAcao}
            />
          </ExplicacaoQueAbre>
        </div>

        <div className="py-2">
          <ExplicacaoQueAbre
            id="conta-roe"
            rotulo="Retorno sobre o patrimônio (ROE)"
            valor={percentual(ativo.roe, 2)}
            resumo={leituraRoe(ativo.roe)}
          >
            <Corpo
              conta={<Conta formula="lucro líquido ÷ patrimônio líquido = ROE" numeros={`ROE = ${percentual(ativo.roe, 2)}`} />}
              explicacao={DICAS.roe.texto}
              nota="O ROE vem pronto do Yahoo Finance, com a base de cálculo dele; por isso não coincide exatamente com a razão dos valores por Unit mostrados acima."
            />
          </ExplicacaoQueAbre>
        </div>

        {/* a margem do exemplo é fixa e não é nula; se um dia vier null, troque por leituraDivida/DICAS.dividaEbitda */}
        <div className="py-2">
          <ExplicacaoQueAbre
            id="conta-margem"
            rotulo="Margem líquida"
            valor={percentual(ativo.margemLiquida, 2)}
            resumo={leituraMargem(ativo.margemLiquida)}
          >
            <Corpo
              conta={<Conta formula="lucro líquido ÷ receita = margem líquida" numeros={`margem líquida = ${percentual(ativo.margemLiquida, 2)}`} />}
              explicacao={DICAS.margemLiquida.texto}
            />
          </ExplicacaoQueAbre>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 border-t border-pauta px-6 py-2">
        <Link href={`${ROTAS.acoes}/${ativo.ticker}`} className={linkDoCard}>
          Ver a ficha do {ativo.ticker}
        </Link>
        <Link href={ROTAS.indicadoresExplicados} className={linkDoCard}>
          Indicadores explicados
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
      <Link
        href={ROTAS.indicadores}
        className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline decoration-1 underline-offset-4"
      >
        Ver os indicadores da minha carteira
      </Link>
    </div>
  );
}
