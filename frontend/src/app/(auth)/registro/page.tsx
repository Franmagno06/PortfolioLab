"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { MensagemErro } from "@/components/ui/mensagem";
import { api, ApiError } from "@/lib/api";

export default function RegistroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      // conta criada → já loga e entra direto
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

  return (
    <form onSubmit={criarConta} className="space-y-4" data-superficie="papel">
      <div>
        <h1 className="text-xl font-bold">Criar conta</h1>
        <p className="text-sm text-mute-soft">Comece a acompanhar seus investimentos</p>
      </div>

      <Campo
        rotulo="Nome"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Seu nome"
        autoComplete="name"
      />

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
        rotulo="Senha (mínimo 6 caracteres)"
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••"
        autoComplete="new-password"
      />

      {erro && <MensagemErro>{erro}</MensagemErro>}

      <Botao type="submit" tamanho="bloco" disabled={enviando}>
        {enviando ? "Criando conta..." : "Criar conta"}
      </Botao>

      <p className="text-center text-sm text-mute-soft">
        Já tem conta?{" "}
        <Link href="/login" className="rounded font-semibold text-gain-ink hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
