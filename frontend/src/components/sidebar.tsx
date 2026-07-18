"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Ícones em SVG stroke (não emojis): consistência visual em qualquer sistema
function IconeGrade() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconePasta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function IconeCalculo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </svg>
  );
}

function IconeSair() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

const itens = [
  { href: "/dashboard", rotulo: "Dashboard", Icone: IconeGrade },
  { href: "/carteira", rotulo: "Carteira", Icone: IconePasta },
  { href: "/simulacao", rotulo: "Simulação", Icone: IconeCalculo },
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
    <aside
      className="flex min-h-screen w-60 flex-col px-3 py-6 text-white"
      style={{ background: "linear-gradient(180deg, #0e1b33 0%, #14264c 100%)" }}
    >
      {/* Logomarca: barras ascendentes + wordmark */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-3">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
          <rect x="2" y="14" width="5" height="10" rx="1.5" fill="#3b6fe0" />
          <rect x="10" y="9" width="5" height="15" rx="1.5" fill="#7a5af8" />
          <rect x="18" y="3" width="5" height="21" rx="1.5" fill="#1e9e63" />
        </svg>
        <span className="text-lg font-bold tracking-tight">
          Portfolio<span style={{ color: "#35d68e" }}>Lab</span>
        </span>
      </Link>

      <nav className="mt-10 space-y-1">
        {itens.map(({ href, rotulo, Icone }) => {
          const ativo = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                ativo
                  ? "bg-white/10 font-semibold text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {ativo && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ background: "#35d68e" }}
                />
              )}
              <span className={ativo ? "text-[#35d68e]" : "text-slate-500 group-hover:text-slate-300"}>
                <Icone />
              </span>
              {rotulo}
            </Link>
          );
        })}

        <p className="px-3 pb-1 pt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Em breve
        </p>
        <p className="px-3 py-1 text-sm text-slate-600">Indicadores</p>
        <p className="px-3 py-1 text-sm text-slate-600">Histórico</p>
      </nav>

      <div className="mt-auto space-y-3">
        <p className="px-3 text-[11px] leading-relaxed text-slate-500">
          Projeto educacional — não é recomendação de investimento.
        </p>
        <button
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <IconeSair />
          Sair
        </button>
      </div>
    </aside>
  );
}
