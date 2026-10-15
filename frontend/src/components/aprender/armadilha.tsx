/**
 * "Cuidado ao ler": a armadilha de um indicador, discreta, em roxo de anotação e nunca em vermelho
 * (o vermelho do site é perda de dinheiro). O ícone é o "!" do protótipo. Leitor de tela ouve
 * "Armadilha:" antes do texto, que na tela é dispensável.
 */
export function Armadilha({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded bg-marca-texto py-2 pr-3 pl-2.5 text-[13px] leading-[19px] font-medium text-anotacao">
      <span aria-hidden className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-anotacao text-[11px] leading-3 text-white">
        !
      </span>
      <p>
        <span className="sr-only">Armadilha: </span>
        {children}
      </p>
    </div>
  );
}
