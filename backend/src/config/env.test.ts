import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

// Achado 6: em produção, um JWT_SECRET fraco não pode passar despercebido.
// O comentário no topo de env.ts promete "fail fast" — estes testes cobram a promessa.
const base = { DATABASE_URL: "postgresql://localhost:5432/portfoliolab" };

const SEGREDO_FORTE = "u7Kq2zP9rT4xW1bN6vY8sL3dH5gJ0mC2";

describe("validação do ambiente", () => {
  it("aceita o segredo padrão em desenvolvimento", () => {
    const r = envSchema.safeParse({ ...base, NODE_ENV: "development" });

    expect(r.success).toBe(true);
  });

  it("recusa o segredo padrão em produção", () => {
    const r = envSchema.safeParse({ ...base, NODE_ENV: "production" });

    expect(r.success).toBe(false);
  });

  it("recusa segredo curto demais em produção", () => {
    const r = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      JWT_SECRET: "curto-demais",
    });

    expect(r.success).toBe(false);
  });

  it("aceita segredo forte em produção", () => {
    const r = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      JWT_SECRET: SEGREDO_FORTE,
    });

    expect(r.success).toBe(true);
  });

  // O caminho real de um deploy não é digitar "dev-secret" — é copiar o
  // .env.example e esquecer de trocar esta linha. Se o guarda deixa o
  // placeholder passar, ele não protege o caso que de fato acontece.
  it("recusa em produção o placeholder que vem no .env.example", () => {
    const r = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      JWT_SECRET: "troque-este-segredo-antes-do-sprint-2",
    });

    expect(r.success).toBe(false);
  });

  it("a mensagem de erro diz como gerar um segredo", () => {
    const r = envSchema.safeParse({ ...base, NODE_ENV: "production" });

    expect(r.success).toBe(false);
    if (r.success) return;
    const mensagem = r.error.issues.map((i: { message: string }) => i.message).join(" ");
    expect(mensagem).toContain("openssl");
  });
});
