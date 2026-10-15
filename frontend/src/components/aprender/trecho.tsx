/**
 * Um trecho do artigo com a anotação na margem. No desktop largo (xl, onde o artigo tem as três
 * colunas) a nota fica ao lado do trecho que comenta, no alto dele; abaixo disso vira uma nota em
 * linha, logo depois do trecho. A nota é posicionada em relação ao PRÓPRIO trecho, e não por
 * espaçadores de altura fixa como no protótipo: se o texto mudar de tamanho, a nota acompanha.
 *
 *   <Trecho nota="Na TAEE11 a conta dá 9,02.">
 *   Parágrafo ou <Conta> comentado.
 *   </Trecho>
 */
export function Trecho({ nota, children }: { nota: string; children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col gap-6">
      {children}
      <aside
        aria-label="Anotação na margem"
        className="border-l-2 border-anotacao-margem pl-3 text-[13px] leading-[19px] font-medium text-anotacao xl:absolute xl:top-0 xl:left-[calc(100%+2.5rem)] xl:w-[220px]"
      >
        <span aria-hidden>↳ </span>
        {nota}
      </aside>
    </div>
  );
}
