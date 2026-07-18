"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

  return (
    <form onSubmit={entrar} className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Entrar</h1>
        <p className="text-sm text-slate-500">Acesse sua carteira de investimentos</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">E-mail</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Senha</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-[#0e1b33] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2f5c] disabled:opacity-60"
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Ainda não tem conta?{" "}
        <Link href="/registro" className="font-semibold text-[#1e9e63] hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
