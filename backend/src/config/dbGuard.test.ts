import { describe, expect, it } from "vitest";
import { assertDatabaseUrlIsLocal, bancoEhLocal, descreverBanco } from "./dbGuard.js";

describe("assertDatabaseUrlIsLocal", () => {
  it("lança quando a URL aponta para o Supabase de produção", () => {
    const producao = "postgresql://postgres:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";

    expect(() => assertDatabaseUrlIsLocal(producao)).toThrow();
  });

  it("lança quando a URL está vazia", () => {
    expect(() => assertDatabaseUrlIsLocal("")).toThrow();
  });

  it("passa quando a URL aponta para o Postgres local", () => {
    const local = "postgresql://portfoliolab:portfoliolab@localhost:5432/portfoliolab";

    expect(() => assertDatabaseUrlIsLocal(local)).not.toThrow();
  });

  it("passa quando a URL aponta para 127.0.0.1", () => {
    const local = "postgresql://portfoliolab:portfoliolab@127.0.0.1:5432/portfoliolab";

    expect(() => assertDatabaseUrlIsLocal(local)).not.toThrow();
  });
});

describe("bancoEhLocal", () => {
  it("reconhece o Postgres do docker-compose", () => {
    expect(bancoEhLocal("postgresql://portfoliolab:portfoliolab@localhost:5432/portfoliolab")).toBe(true);
  });

  it("recusa o Supabase, a URL vazia e a URL inválida", () => {
    expect(bancoEhLocal("postgresql://postgres:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres")).toBe(false);
    expect(bancoEhLocal(undefined)).toBe(false);
    expect(bancoEhLocal("não é url")).toBe(false);
  });
});

describe("descreverBanco", () => {
  it("rotula o banco local e o Supabase sem vazar a senha", () => {
    const local = descreverBanco("postgresql://portfoliolab:segredo@localhost:5432/portfoliolab");
    const nuvem = descreverBanco("postgresql://postgres.abc:segredo@aws-1-sa-east-1.pooler.supabase.com:5432/postgres");

    expect(local).toBe("LOCAL (Docker) — localhost:5432/portfoliolab");
    expect(nuvem).toBe("SUPABASE (produção) — aws-1-sa-east-1.pooler.supabase.com:5432/postgres");
    expect(local + nuvem).not.toContain("segredo");
    expect(descreverBanco("postgresql://postgres:x@db.abc.supabase.co:5432/postgres")).toMatch(/^SUPABASE/);
  });
});
