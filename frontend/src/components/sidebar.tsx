"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  IconeCalculo,
  IconeDocumento,
  IconeFechar,
  IconeGrade,
  IconeIndicadores,
  IconeJornal,
  IconeMenu,
  IconePasta,
  IconeSair,
} from "@/components/ui/icones";
import { Marca, Wordmark } from "@/components/ui/marca";

const itens = [
  { href: "/dashboard", rotulo: "Dashboard", Icone: IconeGrade },
  { href: "/carteira", rotulo: "Carteira", Icone: IconePasta },
  { href: "/simulacao", rotulo: "Simulação", Icone: IconeCalculo },
  { href: "/relatorios", rotulo: "Relatórios IA", Icone: IconeDocumento },
  { href: "/indicadores", rotulo: "Indicadores", Icone: IconeIndicadores },
  { href: "/noticias", rotulo: "Notícias", Icone: IconeJornal },
];

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="mt-10 space-y-1">
        {itens.map(({ href, rotulo, Icone }) => {
          const ativo = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={aoNavegar}
              aria-current={ativo ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                ativo
                  ? "bg-white/10 font-semibold text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {ativo && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-mint" />
              )}
              <span className={ativo ? "text-mint" : "text-slate-400 group-hover:text-slate-200"}>
                <Icone />
              </span>
              {rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-8">
        <p className="px-3 text-[11px] leading-relaxed text-slate-400">
          Projeto educacional — não é recomendação de investimento.
        </p>
        <button
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <IconeSair />
          Sair
        </button>
      </div>
    </>
  );
}

const fundoNavy = { background: "linear-gradient(180deg, var(--color-ink) 0%, #14264c 100%)" };

/** Coluna fixa a partir de lg. Abaixo disso quem navega é a TopbarMobile. */
export function Sidebar() {
  return (
    <aside
      data-superficie="navy"
      style={fundoNavy}
      className="hidden w-60 shrink-0 flex-col px-3 py-6 text-white lg:sticky lg:top-0 lg:flex lg:h-screen"
    >
      <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg px-3">
        <Marca />
        <Wordmark className="text-lg" />
      </Link>
      <Navegacao />
    </aside>
  );
}

/** Barra + gaveta para telas estreitas. */
export function TopbarMobile() {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  // Trocar de rota fecha a gaveta; sem isso ela cobre a página que acabou de abrir.
  useEffect(() => setAberto(false), [pathname]);

  // Enquanto a gaveta estiver aberta, Esc fecha e a página atrás não rola.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <>
      <header
        data-superficie="navy"
        style={fundoNavy}
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 text-white lg:hidden"
      >
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconeMenu />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 rounded-lg">
          <Marca tamanho={22} />
          <Wordmark />
        </Link>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 h-full w-full bg-ink/60"
          />
          <aside
            data-superficie="navy"
            style={fundoNavy}
            className="reveal absolute inset-y-0 left-0 flex w-64 flex-col px-3 py-6 text-white"
          >
            <div className="flex items-center justify-between px-3">
              <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg">
                <Marca />
                <Wordmark className="text-lg" />
              </Link>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <IconeFechar />
              </button>
            </div>
            <Navegacao aoNavegar={() => setAberto(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
