import type { ReactNode } from "react";
import Link from "next/link";
import { ExplicacaoQueAbre } from "@/components/movimento/explicacao-que-abre";
import { brl, indicadorOuTraco, numero, percentual } from "@/lib/format";
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
 * "Como ler um ativo": a folha da Empresa Exemplo S.A., uma empresa FICTÍCIA, com uma explicação que se abre
 * por indicador. Fictícia de propósito: números de um ativo real com critérios aplicados a ele funcionariam como
 * análise daquele valor mobiliário.
 *
 * Por que existe: o número e a frase de leitura ficam sempre à vista; a conta com os números do
 * exemplo, a explicação e a armadilha abrem sob demanda, para quem quer entender de verdade.
 *
 * Sem nota, ranking ou selo, de propósito. Pela Resolução CVM 20, texto sobre um ativo específico que
 * possa influenciar a decisão de investir é relatório de análise, e um aviso de "não é recomendação"
 * não basta. A página explica o que o número mede, com uma empresa que não existe.
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
  return (
    <article
      aria-labelledby="folha-do-ativo"
      className="overflow-hidden rounded-md border border-pauta bg-card text-ink shadow-folha"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-pauta px-6 pt-6 pb-[22px]">
        <div>
          <h3 id="folha-do-ativo" className="text-[30px] leading-tight font-bold tracking-[-0.005em]">
            {ativo.nome}
          </h3>
          <p className="mt-1 text-[15px] text-ink-2">{ativo.aviso}</p>
        </div>
        <div className="sm:text-right">
          <p className="tnum text-[30px] leading-tight font-semibold tracking-[-0.005em]">{brl(ativo.preco)}</p>
          <p className="mt-1 text-sm text-ink-2">preço da ação no exemplo</p>
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
              conta={<Conta formula="preço ÷ lucro por ação = P/L" numeros={`${brl(ativo.preco)} ÷ ${brl(ativo.lucroPorAcao)} = ${indicadorOuTraco(ativo.pl)}`} />}
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
              conta={<Conta formula="preço ÷ patrimônio por ação = P/VP" numeros={`${brl(ativo.preco)} ÷ ${brl(ativo.valorPatrimonialPorAcao)} = ${indicadorOuTraco(ativo.pvp)}`} />}
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
              conta={<Conta formula="proventos pagos em 12 meses ÷ preço = DY" numeros={`${brl(ativo.proventos12m.porUnidade)} ÷ ${brl(ativo.preco)} = ${percentual(ativo.dy12m, 2)}`} />}
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
              conta={<Conta formula="lucro por ação ÷ patrimônio por ação = ROE" numeros={`${brl(ativo.lucroPorAcao)} ÷ ${brl(ativo.valorPatrimonialPorAcao)} = ${percentual(ativo.roe, 2)}`} />}
              explicacao={DICAS.roe.texto}
              armadilha="Um ano isolado diz pouco, e dívida alta infla o ROE. Compare a série de vários anos e empresas do mesmo setor."
            />
          </ExplicacaoQueAbre>
        </div>

        <div className="py-2">
          <ExplicacaoQueAbre
            id="conta-margem"
            rotulo="Margem líquida"
            valor={percentual(ativo.margemLiquida, 2)}
            resumo={leituraMargem(ativo.margemLiquida)}
          >
            <Corpo
              conta={<Conta formula="lucro líquido ÷ receita líquida = margem líquida" numeros={`R$ ${numero(ativo.lucroLiquido / 1e6, 0)} mi ÷ R$ ${numero(ativo.receitaLiquida / 1e9, 1)} bi = ${percentual(ativo.margemLiquida, 2)}`} />}
              explicacao={DICAS.margemLiquida.texto}
            />
          </ExplicacaoQueAbre>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 border-t border-pauta px-6 py-2">
        <Link href={ROTAS.acoes} className={linkDoCard}>
          Ver as fichas das ações do site
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
      <h3 className="font-leitura text-2xl leading-[30px] font-semibold">Critérios de exemplo</h3>
      <p className="text-sm leading-[21px] text-ink-2">
        Um critério é uma regra que a própria pessoa escolhe. Cada pessoa escolhe os seus, e o site não avalia ativos.
        Aqui, três critérios de exemplo aplicados à {ativo.nome}, a empresa fictícia ao lado:
      </p>
      <ul className="border-t border-pauta pt-1">
        {CRITERIOS_DE_EXEMPLO.map((c) => {
          const ok = atende(ativo, c);
          return (
            <li key={c.rotulo} className="flex items-center justify-between gap-3 border-b border-pauta py-3">
              <span className="text-[15px]">{c.rotulo}</span>
              {/* a mesma cor nos dois casos: sem verde de aprovado nem vermelho de reprovado */}
              <span className="text-sm font-medium whitespace-nowrap text-ink-2">{ok ? "atende" : "não atende"}</span>
            </li>
          );
        })}
      </ul>
      <p className="font-leitura text-sm leading-[21px] italic text-anotacao">
        Os critérios e os limites são só um exemplo, não uma faixa recomendada. Atender a um critério não transforma
        nada em recomendação.
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
