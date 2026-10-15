/**
 * A tabela de um exemplo em reais. Lado a lado a partir do tablet; no celular, seis colunas não
 * cabem e viram uma lista empilhada: cada linha é um bloco com "rótulo: valor". As duas versões
 * ficam no HTML e o CSS esconde uma, que sai da árvore de acessibilidade, então o leitor de tela
 * encontra a tabela só uma vez.
 *
 * A primeira coluna é o nome da linha (a operação, o ativo); as demais são números, alinhados à direita.
 */
export function TabelaDeExemplo({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string;
  colunas: string[];
  linhas: string[][];
}) {
  const [, ...resto] = colunas;
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-pauta sm:block">
        <table className="w-full border-collapse text-[15px] leading-[22px] text-ink">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr className="bg-paper text-xs leading-4 font-medium text-mute">
              {colunas.map((c, i) => (
                <th key={c} scope="col" className={`px-4 py-2.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, r) => (
              <tr key={r} className="border-t border-pauta bg-card">
                {linha.map((celula, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="px-4 py-3 text-left font-medium">
                      {celula}
                    </th>
                  ) : (
                    <td key={i} className="tnum px-4 py-3 text-right font-semibold">
                      {celula}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={legenda} className="flex flex-col gap-3 sm:hidden">
        {linhas.map((linha, r) => (
          <li key={r} className="rounded-lg border border-pauta bg-card p-4">
            <p className="text-[15px] leading-[22px] font-semibold text-ink">{linha[0]}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {resto.map((coluna, i) => (
                <div key={coluna} className="flex flex-col">
                  <dt className="text-xs leading-4 font-medium text-mute">{coluna}</dt>
                  <dd className="tnum text-[15px] leading-[22px] font-semibold text-ink">{linha[i + 1]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
