import { describe, expect, it } from "vitest";
import { chaveDoPeriodo, parsearPeriodo, periodoAnterior, rotuloDoPeriodo, ultimoPeriodoEncerrado } from "./periodo.js";

describe("chaveDoPeriodo e rotuloDoPeriodo", () => {
  it("trimestre: chave 2026-T1, rótulo 1T26", () => {
    const p = { tipo: "trimestre", ano: 2026, trimestre: 1 } as const;
    expect(chaveDoPeriodo(p)).toBe("2026-T1");
    expect(rotuloDoPeriodo(p)).toBe("1T26");
  });

  it("mês: chave com zero à esquerda, rótulo por extenso e com acento", () => {
    const p = { tipo: "mes", ano: 2026, mes: 3 } as const;
    expect(chaveDoPeriodo(p)).toBe("2026-03");
    expect(rotuloDoPeriodo(p)).toBe("março de 2026");
  });
});

describe("parsearPeriodo", () => {
  it.each([
    ["2026-T1", { tipo: "trimestre", ano: 2026, trimestre: 1 }],
    ["2026T4", { tipo: "trimestre", ano: 2026, trimestre: 4 }],
    ["1T26", { tipo: "trimestre", ano: 2026, trimestre: 1 }],
    ["3t2025", { tipo: "trimestre", ano: 2025, trimestre: 3 }],
    ["2026-03", { tipo: "mes", ano: 2026, mes: 3 }],
    ["2026/12", { tipo: "mes", ano: 2026, mes: 12 }],
    ["03/2026", { tipo: "mes", ano: 2026, mes: 3 }],
    [" 2026-T2 ", { tipo: "trimestre", ano: 2026, trimestre: 2 }],
  ])("%s", (texto, esperado) => {
    expect(parsearPeriodo(texto)).toEqual(esperado);
  });

  it("'2026-3' é março, não o 3º trimestre: sem o T, número depois do ano é mês", () => {
    expect(parsearPeriodo("2026-3")).toEqual({ tipo: "mes", ano: 2026, mes: 3 });
  });

  it.each(["", "abc", "2026-T5", "5T26", "2026-13", "2026-00", "1T265", "2026"])("recusa %j", (texto) => {
    expect(parsearPeriodo(texto)).toBeNull();
  });

  it("a chave de um período volta a ser o mesmo período", () => {
    for (const p of [
      { tipo: "trimestre", ano: 2025, trimestre: 4 },
      { tipo: "mes", ano: 2026, mes: 11 },
    ] as const) {
      expect(parsearPeriodo(chaveDoPeriodo(p))).toEqual(p);
    }
  });
});

describe("periodoAnterior", () => {
  it("dentro do ano", () => {
    expect(periodoAnterior({ tipo: "trimestre", ano: 2026, trimestre: 3 })).toEqual({ tipo: "trimestre", ano: 2026, trimestre: 2 });
    expect(periodoAnterior({ tipo: "mes", ano: 2026, mes: 3 })).toEqual({ tipo: "mes", ano: 2026, mes: 2 });
  });

  it("vira o ano: 1T26 vem depois de 4T25, janeiro depois de dezembro", () => {
    expect(periodoAnterior({ tipo: "trimestre", ano: 2026, trimestre: 1 })).toEqual({ tipo: "trimestre", ano: 2025, trimestre: 4 });
    expect(periodoAnterior({ tipo: "mes", ano: 2026, mes: 1 })).toEqual({ tipo: "mes", ano: 2025, mes: 12 });
  });
});

describe("ultimoPeriodoEncerrado", () => {
  // meio-dia local: o dia civil não escorrega com o fuso da máquina
  const em = (ano: number, mes: number, dia: number) => new Date(ano, mes - 1, dia, 12);

  it.each([
    [em(2026, 11, 10), { tipo: "trimestre", ano: 2026, trimestre: 3 }],
    [em(2026, 10, 1), { tipo: "trimestre", ano: 2026, trimestre: 3 }],
    [em(2026, 9, 30), { tipo: "trimestre", ano: 2026, trimestre: 2 }],
    [em(2026, 4, 1), { tipo: "trimestre", ano: 2026, trimestre: 1 }],
    [em(2026, 2, 15), { tipo: "trimestre", ano: 2025, trimestre: 4 }],
  ])("trimestre em %s", (hoje, esperado) => {
    expect(ultimoPeriodoEncerrado("trimestre", hoje)).toEqual(esperado);
  });

  it.each([
    [em(2026, 11, 10), { tipo: "mes", ano: 2026, mes: 10 }],
    [em(2026, 1, 5), { tipo: "mes", ano: 2025, mes: 12 }],
  ])("mês em %s", (hoje, esperado) => {
    expect(ultimoPeriodoEncerrado("mes", hoje)).toEqual(esperado);
  });
});
