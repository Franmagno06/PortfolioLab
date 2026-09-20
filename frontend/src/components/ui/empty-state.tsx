/** Tela vazia: diz o que falta e como sair dali. Nunca só "sem dados". */
export function EmptyState({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <p className="font-semibold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-mute">{descricao}</p>
      {children && <div className="mt-5 flex justify-center">{children}</div>}
    </div>
  );
}
