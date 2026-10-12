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
  /** "claro": branco sobre a tinta. "escuro": tinta sobre o papel. */
  tom?: "claro" | "escuro";
};

export function BotaoDemo({ rotulo = "Ver a demonstração", tom = "claro" }: Props) {
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
    tom === "claro" ? "bg-card text-ink hover:bg-caderno" : "bg-ink text-white hover:bg-ink-lift";

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={entrar}
        disabled={entrando}
        className={`rounded px-5 py-3 text-base font-semibold transition-colors disabled:cursor-wait disabled:opacity-80 ${estilo}`}
      >
        {entrando ? "Entrando…" : rotulo}
      </button>
      {/* aria-live: quem usa leitor de tela também fica sabendo da espera */}
      <p aria-live="polite" className={`mt-2 text-sm empty:mt-0 ${tom === "claro" ? "text-white/78" : "text-mute"}`}>
        {demorando
          ? "Acordando o servidor gratuito. Na primeira visita do dia isso leva até um minuto."
          : erro}
      </p>
    </div>
  );
}
