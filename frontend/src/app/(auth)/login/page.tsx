"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { MensagemAviso, MensagemErro } from "@/components/ui/mensagem";
import { api, ApiError } from "@/lib/api";
import { esquecerSimulacao } from "@/lib/simulacao-guardada";

/**
 * Aviso para quem chegou aqui por sessão morta — lib/api.ts redireciona com
 * ?expirada=1 depois de um 401.
 *
 * Componente separado e sob <Suspense> de propósito: useSearchParams() torna
 * dinâmica a árvore em que está, e o build falha ao prerenderizar /login. Com
 * a fronteira, o Next prerenderiza a página e resolve só este pedaço no
 * cliente — /login continua estática.
 */
function AvisoSessaoExpirada() {
  if (!useSearchParams().has("expirada")) return null;
  return (
    <MensagemAviso titulo="Sua sessão expirou">
      Entre novamente para continuar. Seus dados continuam salvos.
    </MensagemAviso>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // conta nova na aba: nada da sessão anterior fica visível
      esquecerSimulacao();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Falha ao conectar com o servidor");
      setEnviando(false);
    }
  }

  // O card de autenticação é branco: aqui o anel de foco volta a ser navy.
  return (
    <form onSubmit={entrar} className="space-y-4" data-superficie="papel">
      <div>
        <h1 className="text-xl font-bold">Entrar</h1>
        <p className="text-sm text-mute-soft">Acesse sua carteira de investimentos</p>
      </div>

      <Suspense fallback={null}>
        <AvisoSessaoExpirada />
      </Suspense>

      <Campo
        rotulo="E-mail"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@exemplo.com"
        autoComplete="email"
        // Corretor ortográfico num e-mail só produz sublinhado vermelho.
        spellCheck={false}
      />

      <Campo
        rotulo="Senha"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••"
        autoComplete="current-password"
      />

      {erro && <MensagemErro>{erro}</MensagemErro>}

      <Botao type="submit" tamanho="bloco" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>

      <p className="text-center text-sm text-mute-soft">
        Ainda não tem conta?{" "}
        <Link href="/registro" className="rounded font-semibold text-gain-ink hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
