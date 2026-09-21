import { describe, expect, it } from "vitest";
import { calcularDesvios, formatarDesvio, somarMetas } from "./goals";

describe("somarMetas", () => {
  it("soma os valores numéricos do mapa ticker → percentual", () => {
    expect(somarMetas({ PETR4: "60", MXRF11: "10" })).toBe(70);
  });

  it("trata campo vazio como zero, sem quebrar a soma", () => {
    expect(somarMetas({ PETR4: "60", MXRF11: "" })).toBe(60);
  });

  it("ignora entrada não numérica tratando como zero", () => {
    expect(somarMetas({ PETR4: "abc" })).toBe(0);
  });

  it("mapa vazio soma zero", () => {
    expect(somarMetas({})).toBe(0);
  });

  it("aceita casas decimais", () => {
    expect(somarMetas({ PETR4: "33.3", MXRF11: "33.3", HGLG11: "33.4" })).toBeCloseTo(100, 5);
  });
});

describe("calcularDesvios", () => {
  const metas = [
    { ticker: "PETR4", targetWeight: 50 },
    { ticker: "MXRF11", targetWeight: 50 },
  ];

  it("carteira na meta não tem desvio", () => {
    const r = calcularDesvios(metas, [
      { ticker: "PETR4", valorAtual: 1000 },
      { ticker: "MXRF11", valorAtual: 1000 },
    ]);
    expect(r.maiorDesvioPct).toBeCloseTo(0, 5);
    expect(r.maiorDeficit).toBeNull();
  });

  it("aponta o ativo mais abaixo da meta", () => {
    const r = calcularDesvios(metas, [
      { ticker: "PETR4", valorAtual: 1500 },
      { ticker: "MXRF11", valorAtual: 500 },
    ]);
    expect(r.maiorDeficit?.ticker).toBe("MXRF11");
    expect(r.maiorDeficit?.desvioPct).toBeCloseTo(-25, 5);
    expect(r.maiorDesvioPct).toBeCloseTo(25, 5);
  });

  it("ignora no denominador o ativo sem meta, como o backend faz", () => {
    const r = calcularDesvios(metas, [
      { ticker: "PETR4", valorAtual: 1000 },
      { ticker: "MXRF11", valorAtual: 1000 },
      { ticker: "WEGE3", valorAtual: 8000 }, // sem meta: fora da conta
    ]);
    expect(r.patrimonioConsiderado).toBe(2000);
    expect(r.maiorDesvioPct).toBeCloseTo(0, 5);
  });

  it("meta de ativo que ainda não se possui conta como déficit cheio", () => {
    const r = calcularDesvios(metas, [{ ticker: "PETR4", valorAtual: 1000 }]);
    expect(r.maiorDeficit?.ticker).toBe("MXRF11");
    expect(r.maiorDeficit?.atualPct).toBe(0);
    expect(r.maiorDeficit?.desvioPct).toBeCloseTo(-50, 5);
  });

  it("carteira vazia não divide por zero", () => {
    const r = calcularDesvios(metas, []);
    expect(r.patrimonioConsiderado).toBe(0);
    expect(r.desvios.every((d) => d.atualPct === 0)).toBe(true);
  });

  it("sem metas cadastradas não há desvio nem denominador", () => {
    const r = calcularDesvios([], [{ ticker: "PETR4", valorAtual: 1000 }]);
    expect(r.desvios).toEqual([]);
    expect(r.somaMetas).toBe(0);
    expect(r.maiorDeficit).toBeNull();
  });
});

describe("formatarDesvio", () => {
  it("desvio negativo relevante: abaixo da meta", () => {
    expect(formatarDesvio({ ticker: "PETR4", alvoPct: 50, atualPct: 30, desvioPct: -20 })).toBe(
      "20,0 pontos abaixo da meta",
    );
  });

  it("desvio positivo relevante: acima da meta", () => {
    expect(formatarDesvio({ ticker: "PETR4", alvoPct: 50, atualPct: 65, desvioPct: 15 })).toBe(
      "15,0 pontos acima da meta",
    );
  });

  it("abaixo de meio ponto percentual é oscilação, não desvio — mesmo negativo", () => {
    expect(formatarDesvio({ ticker: "PETR4", alvoPct: 50, atualPct: 49.8, desvioPct: -0.2 })).toBe(
      "na meta",
    );
  });

  it("exatamente na meta", () => {
    expect(formatarDesvio({ ticker: "PETR4", alvoPct: 50, atualPct: 50, desvioPct: 0 })).toBe(
      "na meta",
    );
  });
});
