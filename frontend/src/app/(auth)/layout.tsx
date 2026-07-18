// Layout das telas públicas (login/registro): card centralizado
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-2xl font-bold text-white">
          📊 PortfolioLab
        </p>
        <div className="rounded-2xl bg-white p-8 shadow-xl">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Projeto educacional — não é recomendação de investimentos
        </p>
      </div>
    </div>
  );
}
