import { describe, expect, it } from "vitest";
import { assertDatabaseUrlIsLocal } from "./dbGuard.js";

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
