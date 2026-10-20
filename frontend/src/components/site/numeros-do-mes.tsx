import { numero, percentual } from "@/lib/format";
import { lerDadosDosIndices } from "@/lib/indices-api";
import { fraseDoJuroReal, numerosDoMes, type NumerosDoMes } from "@/lib/site-dados";

/*
 * A seção "Os números de {mês}" da home. Fica fora da página para poder chegar por streaming: a home
 * abre na hora com o conjunto fixo (NumerosDoMesFixos, o fallback do <Suspense>) e troca pelos números
 * ao vivo quando o backend responde. Quem espera é só esta seção, e no máximo 5 s.
 */

/** Na home, os números do mês têm reserva fixa: não vale segurar a seção pelos 20 s das páginas de índices. */
const PRAZO_DA_HOME_MS = 5_000;

const recipiente = "mx-auto w-full max-w-[1200px] px-6";

const DEFINICOES = [
  { termo: "Selic", definicao: "A taxa básica de juros do país, definida pelo Copom a cada 45 dias." },
  { termo: "IPCA", definicao: "A inflação oficial, medida pelo IBGE. Render menos que ela é perder poder de compra." },
  { termo: "Juro real", definicao: "O que sobra do rendimento depois de descontar a inflação." },
];

function SecaoNumerosDoMes({ numeros }: { numeros: NumerosDoMes }) {
  const { selic, ipca12m, ipcaReferencia, ibovespa, ifix, rotulo, fechamento, mesAnterior, aoVivo, intradiario } =
    numeros;
  const variacaoIbovespa = ibovespa.variacaoNoMes;
  const juro = fraseDoJuroReal(selic, ipca12m);
  const variacao =
    variacaoIbovespa === null
      ? ""
      : `${percentual(Math.abs(variacaoIbovespa), 2)} ${variacaoIbovespa >= 0 ? "acima" : "abaixo"} do fim de ${mesAnterior}, `;

  return (
    <section aria-labelledby="titulo-numeros" className="bg-card">
      <div
        className={`${recipiente} grid gap-8 pt-16 pb-20 lg:grid-cols-[232px_1fr] lg:gap-16 lg:pt-[168px] lg:pb-[104px]`}
      >
        <div>
          {/* h2 com cara de legenda: mantém a ordem dos títulos sem virar título grande */}
          <h2 id="titulo-numeros" className="text-[15px] font-semibold text-ink">
            Os números de {rotulo}
          </h2>
          <p className="mt-1.5 text-[13px] leading-[19px] text-mute">
            {aoVivo ? (
              <>
                {intradiario ? "Cotação" : "Fechamento"} de {fechamento}; IPCA em 12 meses até {ipcaReferencia}.
                Fontes: Banco Central, IBGE e B3, via Yahoo Finance. Cotação com atraso de cerca de 15 minutos.
              </>
            ) : (
              <>
                Referência fixa de {fechamento}, não atualizada ao vivo; IPCA em 12 meses até {ipcaReferencia}.
                Fontes: Banco Central, IBGE e B3.
              </>
            )}
          </p>
        </div>

        <div className="max-w-[820px]">
          <p className="font-leitura text-2xl leading-[35px] tracking-[-0.005em] text-ink lg:text-[32px] lg:leading-[47px]">
            A Selic está em <strong className="font-semibold">{percentual(selic, 2)} ao ano</strong> e a inflação
            dos últimos 12 meses, em <strong className="font-semibold">{percentual(ipca12m, 2)}</strong>. {juro.antes}
            <strong className="font-semibold">{juro.destaque}</strong>
            {juro.depois}
          </p>

          <dl className="mt-10 grid gap-8 sm:grid-cols-3">
            {DEFINICOES.map((d) => (
              <div key={d.termo} className="border-t border-pauta pt-4">
                <dt className="text-[15px] font-semibold text-ink">{d.termo}</dt>
                <dd className="mt-1.5 text-sm leading-[21px] text-ink-2">{d.definicao}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 text-[15px] leading-[23px] text-ink-2">
            {intradiario
              ? `Na bolsa, o Ibovespa está em ${numero(ibovespa.pontos)} pontos (cotação de hoje, com atraso de cerca de 15 minutos), `
              : `Na bolsa, o Ibovespa fechou em ${numero(ibovespa.pontos)} pontos, `}
            {variacao}e o IFIX, índice dos fundos imobiliários, em {numero(ifix.pontos)} pontos.
          </p>
        </div>
      </div>
    </section>
  );
}

/** O que a seção mostra enquanto o backend não responde: a referência fixa, rotulada como fixa. */
export function NumerosDoMesFixos() {
  return <SecaoNumerosDoMes numeros={numerosDoMes(null)} />;
}

/** Lê os índices (Banco Central e Yahoo, via backend) e cai na referência fixa se a leitura falhar. */
export async function NumerosDoMesAoVivo() {
  return <SecaoNumerosDoMes numeros={numerosDoMes(await lerDadosDosIndices({ prazoMs: PRAZO_DA_HOME_MS }))} />;
}
