import { describe, expect, it } from "vitest";
import { somarMetas } from "./goals";

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
