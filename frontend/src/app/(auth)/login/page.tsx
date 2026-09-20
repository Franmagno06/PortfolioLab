"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { MensagemErro } from "@/components/ui/mensagem";
import { api, ApiError } from "@/lib/api";

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

      <Campo
        rotulo="E-mail"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@exemplo.com"
        autoComplete="email"
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
        {enviando ? "Entrando..." : "Entrar"}
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
