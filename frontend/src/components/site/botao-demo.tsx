"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { esquecerSimulacao } from "@/lib/simulacao-guardada";

// A conta de demonstração é pública de propósito (README, "Conta de
// demonstração"): o botão só poupa o visitante de digitar.
const CONTA_DEMO = { email: "carteira@portfoliolab.dev", password: "demo123456" };

// O backend gratuito do Render dorme sem uso e leva perto de um minuto para
// acordar. Passado este tempo sem resposta, a tela explica a espera em vez de
// parecer travada.
const AVISO_DEPOIS_MS = 4000;

type Props = {
  rotulo?: string;
  /** "claro" sobre o fundo azul do topo; "escuro" sobre o papel. */
  tom?: "claro" | "escuro";
  compacto?: boolean;
};

export function BotaoDemo({ rotulo = "Explorar a demonstração", tom = "claro", compacto }: Props) {
  const router = useRouter();
  const [entrando, setEntrando] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function entrar() {
    setErro(null);
    setEntrando(true);
    temporizador.current = setTimeout(() => setDemorando(true), AVISO_DEPOIS_MS);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify(CONTA_DEMO) });
      esquecerSimulacao();
      router.push("/dashboard");
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : "Não foi possível entrar agora. Tente de novo em alguns segundos.",
      );
      setEntrando(false);
    } finally {
      if (temporizador.current) clearTimeout(temporizador.current);
      setDemorando(false);
    }
  }

  const estilo =
    tom === "claro"
      ? "bg-white text-ink hover:bg-paper"
      : "bg-ink text-white hover:bg-ink-lift";
  const tamanho = compacto ? "px-3.5 py-2 text-sm" : "px-5 py-3 text-base";

  return (
    <div className={`flex flex-col items-start ${compacto ? "" : "gap-2"}`}>
      <button
        type="button"
        onClick={entrar}
        disabled={entrando}
        className={`rounded-lg font-semibold transition-colors disabled:cursor-wait disabled:opacity-80 ${estilo} ${tamanho}`}
      >
        {entrando ? (demorando && compacto ? "Acordando o servidor…" : "Entrando…") : rotulo}
      </button>
      {/* aria-live: quem usa leitor de tela também fica sabendo da espera. No
          cabeçalho, o texto visível cabe no próprio botão. */}
      <p
        aria-live="polite"
        className={
          compacto ? "sr-only" : `text-sm ${tom === "claro" ? "text-white/75" : "text-mute"}`
        }
      >
        {demorando
          ? "Acordando o servidor gratuito. Na primeira visita do dia isso leva até um minuto."
          : erro}
      </p>
    </div>
  );
}
