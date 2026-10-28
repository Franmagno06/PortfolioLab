import Link from "next/link";
import { Dica } from "@/components/ativos/dica";
import { ExplicacaoQueAbre } from "@/components/movimento/explicacao-que-abre";
import { ANCORA_DA_DICA } from "@/content/aprender/indicadores";
import { DICAS, type IdDaDica } from "@/lib/indicadores-explicados";

/*
 * Os indicadores da ficha, agrupados pela pergunta que respondem. Cada linha
 * tem o nome (com o "?"), o valor e, ao lado, a leitura em uma frase: "6,9" só
 * ensina alguma coisa junto de "o lucro de cerca de 7 anos pagaria a ação".
 */

export function GrupoDeIndicadores({
  titulo,
  pergunta,
  children,
}: {
  titulo: string;
  pergunta: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-anotacao">
        {titulo} <span className="font-medium">· {pergunta}</span>
      </h3>
      <ul className="mt-1">{children}</ul>
    </div>
  );
}

/** O erro de leitura mais comum do indicador, dentro da explicação que se abre. */
function NotaDeArmadilha({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded bg-marca-texto px-3.5 py-2.5 text-sm leading-[21px] text-anotacao"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <span>
        <span className="font-semibold">Armadilha: </span>
        {children}
      </span>
    </div>
  );
}

/**
 * O valor e a frase de leitura ficam sempre à vista; a explicação do indicador, a armadilha (quando
 * há uma) e o link para o cartão em /aprender/indicadores (#pl, #dy...) ficam numa explicação que
 * se abre. O "?" continua ao lado do nome, fora do botão (um botão dentro de outro não vale).
 */
export function Indicador({
  rotulo,
  dica,
  valor,
  leitura,
  armadilha,
}: {
  rotulo: string;
  dica: IdDaDica;
  valor: string;
  leitura: string;
  armadilha?: string;
}) {
  const ancora = ANCORA_DA_DICA[dica];
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] sm:gap-x-5">
      <span className="inline-flex items-center gap-1.5 text-[15px] text-ink-2">
        {rotulo}
        <Dica id={dica} rotulo={rotulo} />
      </span>
      <strong className="tnum text-right text-[19px] font-semibold whitespace-nowrap text-ink">{valor}</strong>
      <p className="col-span-2 border-l-[1.5px] border-anotacao-margem pl-3.5 text-sm leading-[21px] font-medium text-anotacao sm:col-span-1">
        {leitura}
      </p>
      {/* sem armadilha nem link, o corpo repetiria o texto do "?": então não há explicação para abrir */}
      {(armadilha || ancora) && (
        <div className="col-span-2 sm:col-span-3">
          <ExplicacaoQueAbre id={`explicacao-${dica}`} rotulo="Entender melhor" nomeAcessivel={`Entender melhor sobre ${rotulo}`}>
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-[21px] text-ink-2">{DICAS[dica].texto}</p>
              {armadilha && <NotaDeArmadilha>{armadilha}</NotaDeArmadilha>}
              {ancora && (
                <Link
                  href={`/aprender/indicadores#${ancora}`}
                  className="flex min-h-11 w-fit items-center rounded text-[13px] leading-[19px] font-semibold underline decoration-1 underline-offset-4"
                >
                  Saiba mais<span className="sr-only"> sobre {rotulo}</span>
                </Link>
              )}
            </div>
          </ExplicacaoQueAbre>
        </div>
      )}
    </li>
  );
}
