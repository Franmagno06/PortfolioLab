import { describe, expect, it } from "vitest";
import { ATIVO_DE_EXEMPLO, atende, CRITERIOS_DE_EXEMPLO, juroReal, NUMEROS_DO_MES, TRILHAS } from "./site-dados";

describe("juroReal", () => {
  it("desconta a inflação pela fórmula de Fisher, não pela subtração", () => {
    const real = juroReal(13.75, 4.22);

    expect(real).toBeGreaterThan(9.1);
    expect(real).toBeLessThan(9.2);
    // a subtração simples daria 9,53: a diferença é o motivo de usar Fisher
    expect(real).toBeLessThan(13.75 - 4.22);
  });

  it("dá zero quando a taxa empata com a inflação", () => {
    expect(juroReal(5, 5)).toBeCloseTo(0, 10);
  });

  it("o 'perto de 9%' da página sai do arredondamento dos números do mês", () => {
    expect(Math.round(juroReal(NUMEROS_DO_MES.selic, NUMEROS_DO_MES.ipca12m))).toBe(9);
  });
});

describe("atende", () => {
  it("confere os três critérios de exemplo contra a TAEE11", () => {
    const resultados = CRITERIOS_DE_EXEMPLO.map((c) => atende(ATIVO_DE_EXEMPLO, c));

    // ROE 20,9 > 15; DY 7,02 > 6; P/VP 1,83 não é < 1,5
    expect(resultados).toEqual([true, true, false]);
  });

  it("o limite exato não atende: acima é estritamente acima", () => {
    expect(
      atende(ATIVO_DE_EXEMPLO, { rotulo: "x", campo: "roe", comparacao: "acima", limite: 20.9 }),
    ).toBe(false);
  });
});

describe("TRILHAS", () => {
  it("é uma sequência numerada de 1 em diante, sem buraco", () => {
    expect(TRILHAS.map((t) => t.numero)).toEqual([1, 2, 3, 4, 5]);
  });
});
