import { describe, expect, it } from "vitest";
import { escalaDoEixo } from "./escala-do-grafico";

describe("escalaDoEixo", () => {
  it("cobre do menor ao maior valor, com degraus iguais e redondos", () => {
    const marcas = escalaDoEixo(54.1, 66.3);
    expect(marcas[0]).toBeLessThanOrEqual(54.1);
    expect(marcas[marcas.length - 1]).toBeGreaterThanOrEqual(66.3);

    const degraus = marcas.slice(1).map((v, i) => Math.round((v - (marcas[i] ?? 0)) * 1e6) / 1e6);
    expect(new Set(degraus).size).toBe(1);
    expect([1, 2, 2.5, 5, 10]).toContain((degraus[0] ?? 0) / 10 ** Math.floor(Math.log10(degraus[0] ?? 1)));
  });

  it("serve para preço de FII, na casa dos 9 reais", () => {
    expect(escalaDoEixo(8.95, 9.8)).toEqual([8.5, 9, 9.5, 10]);
  });

  it("série reta ainda ganha altura no eixo", () => {
    const marcas = escalaDoEixo(10, 10);
    expect(marcas.length).toBeGreaterThanOrEqual(2);
    expect(marcas[0]).toBeLessThanOrEqual(10);
    expect(marcas[marcas.length - 1]).toBeGreaterThanOrEqual(10);
  });

  it("nunca devolve mais de sete marcas, qualquer que seja a escala", () => {
    for (const [min, max] of [[1, 2], [9, 10], [38, 62], [150, 200], [0.5, 0.52], [1000, 5000]] as const) {
      expect(escalaDoEixo(min, max).length, `${min}-${max}`).toBeLessThanOrEqual(7);
    }
  });
});
