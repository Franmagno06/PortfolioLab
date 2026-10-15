/**
 * "Veja no site": leva do conceito ao lugar do PortfolioLab onde ele aparece. O conteúdo é uma
 * lista markdown de links; o estilo dos links vem daqui.
 */
export function VejaNoSite({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Veja no site"
      className="rounded-xl border border-pauta bg-card p-5 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:text-[15px] [&_a]:leading-[22px] [&_a]:font-semibold [&_a]:text-anotacao [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-4 [&_li]:list-none [&_ul]:m-0 [&_ul]:p-0"
    >
      <p className="mb-1 text-xs leading-4 font-medium tracking-wide text-anotacao uppercase">Veja no site</p>
      {children}
    </section>
  );
}
