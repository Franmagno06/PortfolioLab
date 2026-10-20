import { describe, expect, it } from "vitest";
import { ateHoje, diaEmSaoPaulo, fimDeCadaMes, janelasDoSgs, paraIso, paraMensal } from "./indices.calculos.js";

describe("contas puras dos índices", () => {
  it("paraIso converte a data do BCB", () => expect(paraIso("03/11/2026")).toBe("2026-11-03"));
  it("diaEmSaoPaulo usa o fuso da B3", () =>
    expect(diaEmSaoPaulo(new Date("2026-10-20T01:30:00Z"))).toBe("2026-10-19"));
  it("janelasDoSgs corta a cada 5 anos, começando em 1º de janeiro", () => {
    const j = janelasDoSgs(new Date("2011-01-01T12:00:00Z"), new Date("2026-10-19T12:00:00Z"));
    expect(j.map((x) => [diaEmSaoPaulo(x.inicio), diaEmSaoPaulo(x.fim)])).toEqual([
      ["2011-01-01", "2015-12-31"], ["2016-01-01", "2020-12-31"],
      ["2021-01-01", "2025-12-31"], ["2026-01-01", "2026-10-19"],
    ]);
  });
  it("janelasDoSgs com período curto devolve uma janela só", () => {
    const j = janelasDoSgs(new Date("2026-03-10T12:00:00Z"), new Date("2026-10-19T12:00:00Z"));
    expect(j.map((x) => [diaEmSaoPaulo(x.inicio), diaEmSaoPaulo(x.fim)])).toEqual([["2026-03-10", "2026-10-19"]]);
  });
  it("ateHoje descarta o que o SGS 432 publica adiantado", () =>
    expect(ateHoje([{ data: "2026-10-19", valor: 13.75 }, { data: "2026-11-03", valor: 13.75 }], "2026-10-19"))
      .toEqual([{ data: "2026-10-19", valor: 13.75 }]));
  it("fimDeCadaMes fica com o último dia de cada mês", () =>
    expect(fimDeCadaMes([
      { data: "2026-08-05", valor: 14.25 }, { data: "2026-08-31", valor: 14 },
      { data: "2026-09-02", valor: 14 }, { data: "2026-09-18", valor: 13.75 },
    ])).toEqual([{ data: "2026-08", valor: 14 }, { data: "2026-09", valor: 13.75 }]));
  it("paraMensal corta o dia", () =>
    expect(paraMensal([{ data: "2026-09-01", valor: 0.82 }])).toEqual([{ data: "2026-09", valor: 0.82 }]));
});
