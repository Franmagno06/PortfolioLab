import { describe, expect, it } from "vitest";
import { brl, pct, tempoRelativo } from "./format";

// \s no regex do JS casa também o espaço não-quebrável (U+00A0) que
// toLocaleString("pt-BR", {style:"currency"}) usa entre "R$" e o valor —
// normalizamos para não depender de qual caractere de espaço a ICU escolhe.
const semEspacosEspeciais = (s: string) => s.replace(/\s/g, " ");

describe("brl", () => {
  it("formata em reais com duas casas e separador de milhar", () => {
    expect(semEspacosEspeciais(brl(1234.5))).toBe("R$ 1.234,50");
  });

  it("formata zero", () => {
    expect(semEspacosEspeciais(brl(0))).toBe("R$ 0,00");
  });

  it("formata negativo", () => {
    expect(semEspacosEspeciais(brl(-42))).toBe("-R$ 42,00");
  });
});

describe("pct", () => {
  it("prefixa positivo com +", () => {
    expect(pct(12.34)).toBe("+12,3%");
  });

  it("não duplica sinal em negativo", () => {
    expect(pct(-5.67)).toBe("-5,7%");
  });

  it("zero recebe o prefixo +", () => {
    expect(pct(0)).toBe("+0,0%");
  });
});

describe("tempoRelativo", () => {
  it("menos de um minuto: agora", () => {
    expect(tempoRelativo(new Date().toISOString())).toBe("agora");
  });

  it("minutos", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 5 min");
  });

  it("uma hora exata usa singular", () => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 1 hora");
  });

  it("horas no plural", () => {
    const iso = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 3 horas");
  });

  it("um dia exato usa singular", () => {
    const iso = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 1 dia");
  });

  it("30 dias ou mais vira data absoluta", () => {
    const iso = new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe(new Date(iso).toLocaleDateString("pt-BR"));
  });
});
