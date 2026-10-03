import { Marca, Wordmark } from "@/components/ui/marca";

// Telas públicas (login/registro): card centralizado sobre navy.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Tinta lisa, como o topo do site: o degradê radial era enfeite. O cartão
    // de papel (data-superficie="papel") devolve o anel de foco para tinta.
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-md" data-superficie="navy">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Marca tamanho={30} />
          <Wordmark className="text-2xl text-white" />
        </div>

        <div data-superficie="papel" className="rounded-md bg-card p-8 text-ink shadow-folha">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-white/62">
          Projeto educacional. Nada aqui é recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
