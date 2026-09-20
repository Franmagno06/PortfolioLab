import { Marca, Wordmark } from "@/components/ui/marca";

// Telas públicas (login/registro): card centralizado sobre navy.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, #1e3a6e 0%, var(--color-ink) 55%)",
      }}
    >
      <div className="w-full max-w-md" data-superficie="navy">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Marca tamanho={30} />
          <Wordmark className="text-2xl text-white" />
        </div>

        <div className="reveal rounded-2xl bg-card p-8 shadow-2xl">{children}</div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Projeto educacional — não é recomendação de investimentos
        </p>
      </div>
    </div>
  );
}
