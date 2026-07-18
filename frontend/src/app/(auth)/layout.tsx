// Layout das telas públicas (login/registro): card centralizado sobre navy
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, #1e3a6e 0%, #0e1b33 55%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 26 26" aria-hidden>
            <rect x="2" y="14" width="5" height="10" rx="1.5" fill="#3b6fe0" />
            <rect x="10" y="9" width="5" height="15" rx="1.5" fill="#7a5af8" />
            <rect x="18" y="3" width="5" height="21" rx="1.5" fill="#1e9e63" />
          </svg>
          <span className="text-2xl font-bold tracking-tight text-white">
            Portfolio<span style={{ color: "#35d68e" }}>Lab</span>
          </span>
        </div>

        <div className="reveal rounded-2xl bg-white p-8 shadow-2xl">{children}</div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Projeto educacional — não é recomendação de investimentos
        </p>
      </div>
    </div>
  );
}
