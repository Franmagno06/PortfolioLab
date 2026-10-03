import { Fragment } from "react";
import {
  APORTE_DO_DESAFIO,
  CARTEIRA_EXEMPLO,
  COMPRAS_DE_OUTUBRO,
  custoDasCompras,
  desvioDasMetas,
  situacaoNoAporte,
  type SituacaoNoAporte,
} from "@/lib/carteira-exemplo";
import { brl, numero, percentual } from "@/lib/format";

/*
 * As folhas do caderno no topo da página: setembro atrás, outubro na frente,
 * já resolvido pelo algoritmo real (COMPRAS_DE_OUTUBRO). Cada número vem com
 * uma anotação na margem, montada a partir dos dados — nada aqui é digitado.
 */

// Quatro linhas, uma para cada situação que um ativo pode ter no aporte: o
// mais longe da meta, outro abaixo dela, o que ficou para depois e o que
// passou da meta. BBAS3 e BOVA11 repetiriam a última.
const TICKERS_DA_FOLHA = ["TAEE11", "HGLG11", "IVVB11", "MXRF11"];

/** Meta inteira sem casa decimal ("15%"); fracionária com uma ("7,5%"). */
function meta(valor: number) {
  return percentual(valor, Number.isInteger(valor) ? 0 : 1);
}

function anotacao(s: SituacaoNoAporte): string {
  switch (s.tipo) {
    case "mais-longe":
      return `A mais longe da meta: ${percentual(s.atual)} da carteira, para ${meta(s.meta)}.`;
    case "abaixo":
      return `Também abaixo da meta: ${percentual(s.atual)} para ${meta(s.meta)}.`;
    case "ficou-para-depois":
      return `Abaixo da meta, mas a cota custa ${brl(s.preco)}. Fica para o próximo aporte.`;
    case "acima":
      return `Passou da meta: ${percentual(s.atual)} para ${meta(s.meta)}. Não precisa vender, só não recebe aporte.`;
  }
}

const linhas = TICKERS_DA_FOLHA.flatMap((ticker) => {
  const ativo = CARTEIRA_EXEMPLO.find((a) => a.ticker === ticker);
  const situacao = situacaoNoAporte(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO, ticker);
  if (!ativo || !situacao) return [];
  const cotas = COMPRAS_DE_OUTUBRO[ticker] ?? 0;
  return [{ ticker, nome: ativo.nome, cotas, total: cotas * ativo.preco, nota: anotacao(situacao) }];
});

const sobra = APORTE_DO_DESAFIO - custoDasCompras(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO);
const desvioAntes = desvioDasMetas(CARTEIRA_EXEMPLO, {});
const desvioDepois = desvioDasMetas(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO);

const margem = "border-l-[1.5px] border-anotacao-margem";
const textoAnotacao = "font-leitura text-sm leading-5 italic text-anotacao";

export function FolhaDoAporte() {
  return (
    <div className="relative w-full max-w-[568px] md:pt-8 md:pr-8">
      {/* Setembro, atrás: enfeite. A folha de outubro diz tudo o que importa. */}
      <div
        aria-hidden
        className="absolute top-0 right-0 bottom-8 left-8 hidden rounded-md bg-caderno shadow-folha md:block"
      >
        <p className="absolute top-[9px] right-6 text-xs font-medium text-mute">Aporte de setembro</p>
      </div>

      <article aria-labelledby="folha-de-outubro" className="relative overflow-hidden rounded-md bg-card text-ink shadow-folha">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-6 pt-6 pb-[18px]">
          <div className="shrink-0">
            {/* h2, e não h3: logo abaixo do h1 do topo, um h3 pularia um nível */}
            <h2 id="folha-de-outubro" className="font-leitura text-2xl leading-[30px] font-semibold">
              Aporte de outubro
            </h2>
            <p className="mt-1 text-[13px] text-mute">Carteira de exemplo, {CARTEIRA_EXEMPLO.length} ativos</p>
          </div>
          <p className="tnum text-lg font-semibold">{brl(APORTE_DO_DESAFIO)}</p>
        </div>

        <table className="w-full md:table-fixed">
          <caption className="sr-only">Aporte de outubro da carteira de exemplo</caption>
          {/* 148 + 52 + 120 = os 320 px do conteúdo; 216 da anotação */}
          <colgroup>
            <col className="md:w-[148px]" />
            <col className="w-[52px]" />
            <col className="w-[120px]" />
            <col className="md:w-[216px]" />
          </colgroup>
          <thead>
            <tr className="border-y border-pauta text-xs text-mute">
              <th scope="col" className="py-2 pr-3 pl-[18px] text-left font-medium">
                Comprar
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Cotas
              </th>
              <th scope="col" className="py-2 pr-4 pl-3 text-right font-medium">
                Total
              </th>
              <th
                scope="col"
                className={`hidden py-2 pr-1.5 pl-4 text-left font-leitura text-[13px] font-normal italic text-anotacao md:table-cell ${margem}`}
              >
                Por quê
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              // marca-texto só na parte de conteúdo, nunca na anotação
              const realce = l.cotas > 0 ? "bg-marca-texto" : "";
              return (
                <Fragment key={l.ticker}>
                  <tr className="md:border-b md:border-pauta">
                    <td className={`py-2.5 pr-3 pl-[18px] ${realce}`}>
                      <span className="block text-[15px] font-semibold">{l.ticker}</span>
                      <span className="block text-[13px] text-mute">{l.nome}</span>
                    </td>
                    <td className={`tnum py-2.5 pl-3 text-right text-[15px] font-medium ${realce}`}>{l.cotas}</td>
                    <td className={`tnum py-2.5 pr-4 pl-3 text-right text-[15px] font-medium ${realce}`}>
                      {l.cotas > 0 ? (
                        brl(l.total)
                      ) : (
                        <>
                          <span aria-hidden>—</span>
                          <span className="sr-only">nada</span>
                        </>
                      )}
                    </td>
                    <td className={`hidden py-[11px] pr-1.5 pl-4 md:table-cell ${margem} ${textoAnotacao}`}>
                      {l.nota}
                    </td>
                  </tr>
                  {/* No celular a anotação desce para baixo da linha. A célula
                      de cima some com display: none, e com ela a leitura em
                      dobro: cada nota é lida uma vez só. */}
                  <tr className="border-b border-pauta md:hidden">
                    <td colSpan={3} className="pt-1 pr-4 pb-3 pl-[18px]">
                      <p className={`pl-3 ${margem} ${textoAnotacao}`}>{l.nota}</p>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            <tr className="border-b border-pauta">
              <td className="py-2.5 pr-3 pl-[18px]">
                <span className="block text-[15px] font-semibold">Sobra</span>
                <span className="block text-[13px] text-mute">fica para novembro</span>
              </td>
              <td />
              <td className="tnum py-2.5 pr-4 pl-3 text-right text-[15px] font-medium">{brl(sobra)}</td>
              <td className={`hidden md:table-cell ${margem}`} />
            </tr>
          </tbody>
        </table>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-6 pt-[18px] pb-[22px]">
          <div>
            <p className="text-[13px] text-mute">Fora das metas</p>
            <p className="tnum mt-[3px] text-base font-semibold">
              de {numero(desvioAntes, 1)} para {numero(desvioDepois, 1)} pontos
            </p>
          </div>
          <div className="sm:text-right">
            <a
              href="#desafio"
              className="text-sm font-medium text-anotacao underline decoration-1 underline-offset-4"
            >
              Faça você o aporte de novembro
            </a>
            <p className="mt-[3px] text-xs text-mute">O desafio está logo abaixo</p>
          </div>
        </div>
      </article>
    </div>
  );
}
