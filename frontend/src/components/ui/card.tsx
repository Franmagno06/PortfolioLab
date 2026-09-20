type Props = {
  children: React.ReactNode;
  className?: string;
  /** "nenhum" para tabelas de borda a borda, "compacto" para listas laterais. */
  respiro?: "padrao" | "compacto" | "nenhum";
};

const respiros = { padrao: "p-6", compacto: "p-4", nenhum: "" };

/**
 * Superfície padrão do app: papel branco, hairline, canto suave.
 * O raio menor que o do herói do dashboard é intencional — o herói é a
 * única superfície primária da tela, o resto é secundário.
 */
export function Card({ children, className = "", respiro = "padrao" }: Props) {
  return (
    <section className={`rounded-xl border border-line bg-card ${respiros[respiro]} ${className}`}>
      {children}
    </section>
  );
}

/** Título de card com um valor ou ação alinhado à direita. */
export function TituloCard({
  children,
  acessorio,
}: {
  children: React.ReactNode;
  acessorio?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-semibold">{children}</h2>
      {acessorio}
    </div>
  );
}
