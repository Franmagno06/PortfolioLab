/** A caixa "Em resumo": as três frases do frontmatter, antes do texto. */
export function EmResumo({ itens }: { itens: readonly string[] }) {
  return (
    <section aria-label="Em resumo" className="flex flex-col gap-2.5 rounded-xl bg-marca-texto p-5">
      <p className="text-xs leading-4 font-medium tracking-wide text-anotacao uppercase">Em resumo</p>
      <ul className="flex flex-col gap-2.5">
        {itens.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px] leading-[22px] text-ink">
            <span aria-hidden className="font-semibold text-anotacao">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
