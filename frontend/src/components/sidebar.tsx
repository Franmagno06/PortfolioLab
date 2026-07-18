"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const itens = [
  { href: "/dashboard", rotulo: "Dashboard", icone: "▦" },
  { href: "/carteira", rotulo: "Carteira", icone: "💼" },
  { href: "/simulacao", rotulo: "Simulação", icone: "🧮" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex min-h-screen w-60 flex-col bg-navy px-3 py-6">
      <p className="px-3 text-lg font-bold text-white">📊 PortfolioLab</p>

      <nav className="mt-10 space-y-1">
        {itens.map((item) => {
          const ativo = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                ativo
                  ? "bg-navy-light font-semibold text-white"
                  : "text-slate-400 hover:bg-navy-light/50 hover:text-white"
              }`}
            >
              <span>{item.icone}</span>
              {item.rotulo}
            </Link>
          );
        })}

        <p className="px-3 pt-4 text-xs uppercase tracking-wide text-slate-500">
          Em breve
        </p>
        <p className="px-3 py-1 text-sm text-slate-600">📈 Indicadores</p>
        <p className="px-3 py-1 text-sm text-slate-600">🕒 Histórico</p>
      </nav>

      <button
        onClick={sair}
        className="mt-auto rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-navy-light/50 hover:text-white"
      >
        ← Sair
      </button>
    </aside>
  );
}
