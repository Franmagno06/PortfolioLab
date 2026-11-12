"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ROTAS } from "@/lib/navegacao";
import { consultarSessao, lembrarSessao, ultimaSessaoConhecida, type Sessao } from "@/lib/sessao-do-visitante";
import { esquecerSimulacao } from "@/lib/simulacao-guardada";

// A conta de demonstração é pública de propósito (README, "Conta de
// demonstração"): o botão só poupa o visitante de digitar.
const CONTA_DEMO = { email: "carteira@portfoliolab.dev", password: "demo123456" };

// O backend gratuito do Render dorme sem uso e leva perto de um minuto para
// acordar. Passado este tempo sem resposta, a tela explica a espera em vez de
// parecer travada.
const AVISO_DEPOIS_MS = 4000;

const SEM_VERIFICAR = "Não foi possível verificar se você já entrou numa conta. Tente de novo em alguns segundos.";

type Props = {
  rotulo?: string;
  /** "claro": branco sobre a tinta. "escuro": tinta sobre o papel. */
  tom?: "claro" | "escuro";
};

/**
 * A demonstração é só para quem não entrou numa conta. Quem já está logado na própria carteira vê
 * "Ir para minha carteira", que só navega: o login da demo trocaria o cookie e a pessoa perderia a
 * sessão dela ao voltar à página inicial. Na conta demo, ou sem sessão, o botão faz o login da demo.
 *
 * O rótulo nasce como o de visitante (a maioria, e a primeira dobra não espera a API) e muda quando
 * a consulta à sessão responde. Voltando da carteira pelo menu, a última resposta já é conhecida e
 * o rótulo nasce certo. O clique confere a sessão de novo antes de logar, então nem um rótulo ainda
 * desatualizado leva ao login por cima de uma conta.
 */
export function BotaoDemo({ rotulo = "Ver a demonstração", tom = "claro" }: Props) {
  const router = useRouter();
  const [sessao, setSessao] = useState<Sessao | null>(ultimaSessaoConhecida);
  const [entrando, setEntrando] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ativo = true;
    consultarSessao().then((r) => {
      if (ativo && r !== "desconhecida") setSessao(r);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function entrar() {
    setErro(null);
    setEntrando(true);
    temporizador.current = setTimeout(() => setDemorando(true), AVISO_DEPOIS_MS);
    try {
      const atual = await consultarSessao();
      if (atual === "desconhecida") {
        setErro(SEM_VERIFICAR);
        setEntrando(false);
        return;
      }
      if (atual === "conta") {
        setSessao("conta");
        router.push(ROTAS.dashboard);
        return;
      }
      await api("/auth/login", { method: "POST", body: JSON.stringify(CONTA_DEMO) });
      lembrarSessao("demo");
      esquecerSimulacao();
      router.push(ROTAS.dashboard);
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
  const classes = `rounded px-5 py-3 text-base font-semibold transition-colors ${estilo}`;

  return (
    <div className="flex flex-col items-start">
      {sessao === "conta" ? (
        <Link href={ROTAS.dashboard} className={classes}>
          Ir para minha carteira
        </Link>
      ) : (
        <button
          type="button"
          onClick={entrar}
          disabled={entrando}
          className={`${classes} disabled:cursor-wait disabled:opacity-80`}
        >
          {entrando ? "Entrando…" : rotulo}
        </button>
      )}
      {/* aria-live: quem usa leitor de tela também fica sabendo da espera */}
      <p aria-live="polite" className={`mt-2 text-sm empty:mt-0 ${tom === "claro" ? "text-white/78" : "text-mute"}`}>
        {demorando
          ? "Acordando o servidor gratuito. Na primeira visita do dia isso leva até um minuto."
          : erro}
      </p>
    </div>
  );
}
