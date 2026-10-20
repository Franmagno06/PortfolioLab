import { describe, expect, it } from "vitest";
import {
  caminhoDoMinigrafico,
  desacelerar,
  DURACAO_CONTAGEM_MS,
  DURACAO_GRAFICO_MS,
  valorNaContagem,
} from "./movimento";

describe("movimento", () => {
  it("as durações espelham os tokens do globals.css", () => {
    expect(DURACAO_GRAFICO_MS).toBe(1100);
    expect(DURACAO_CONTAGEM_MS).toBe(1100);
  });

  it("desacelerar começa em 0, termina em 1 e passa da metade antes do meio", () => {
    expect(desacelerar(0)).toBe(0);
    expect(desacelerar(1)).toBe(1);
    expect(desacelerar(0.5)).toBeCloseTo(0.875);
    expect(desacelerar(-1)).toBe(0);
    expect(desacelerar(2)).toBe(1);
  });

  it("valorNaContagem termina exatamente no valor final", () => {
    expect(valorNaContagem(208296, 1100)).toBe(208296);
    expect(valorNaContagem(208296, 5000)).toBe(208296);
    expect(valorNaContagem(208296, 0)).toBe(0);
  });

  it("valorNaContagem no meio da duração fica entre 0 e o final, na curva de desacelerar", () => {
    const meio = valorNaContagem(1000, 500, 1000);
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(1000);
    expect(meio).toBe(1000 * desacelerar(0.5));
    expect(valorNaContagem(1000, 10, 0)).toBe(1000);
  });

  it("valorNaContagem com final negativo termina exato e nunca sobe", () => {
    expect(valorNaContagem(-3.5, 1100)).toBe(-3.5);
    const amostras = Array.from({ length: 11 }, (_, i) => valorNaContagem(-3.5, i * 110));
    for (let i = 1; i < amostras.length; i++) {
      expect(amostras[i]!).toBeLessThanOrEqual(amostras[i - 1]!);
    }
  });

  it("valorNaContagem com final fracionário termina exatamente nele", () => {
    expect(valorNaContagem(4.58, 1100)).toBe(4.58);
    expect(valorNaContagem(4.58, 9999)).toBe(4.58);
  });

  it("valorNaContagem com tempo negativo ou zero dá 0 (nunca -0)", () => {
    expect(valorNaContagem(1000, -50)).toBe(0);
    expect(Object.is(valorNaContagem(-3.5, 0), 0)).toBe(true);
    expect(Object.is(valorNaContagem(-3.5, -10), 0)).toBe(true);
  });

  it("desacelerar e valorNaContagem não vazam NaN", () => {
    expect(desacelerar(Number.NaN)).toBe(0);
    expect(valorNaContagem(1000, Number.NaN)).toBe(0);
    expect(valorNaContagem(Number.NaN, 500)).toBe(0);
    expect(valorNaContagem(Infinity, 500)).toBe(0);
    expect(valorNaContagem(1000, 500, Number.NaN)).toBe(1000);
    expect(valorNaContagem(1000, 500, Infinity)).toBe(1000);
    expect(valorNaContagem(1000, Infinity)).toBe(1000);
  });

  describe("caminhoDoMinigrafico", () => {
    it("devolve vazio com menos de 2 valores", () => {
      expect(caminhoDoMinigrafico([], 100, 40)).toBe("");
      expect(caminhoDoMinigrafico([5], 100, 40)).toBe("");
    });

    it("maior valor fica no topo (y=0) e o menor embaixo (y=altura)", () => {
      expect(caminhoDoMinigrafico([1, 2, 3], 100, 40)).toBe("M0,40 L50,20 L100,0");
    });

    it("série constante é desenhada no meio da altura", () => {
      expect(caminhoDoMinigrafico([7, 7], 100, 40)).toBe("M0,20 L100,20");
    });

    it("arredonda a 2 casas e tira zeros à direita, sem ruído de ponto flutuante", () => {
      expect(caminhoDoMinigrafico([0, 1, 2, 3], 100, 30)).toBe(
        "M0,30 L33.33,20 L66.67,10 L100,0",
      );
    });

    it("descarta valores não finitos antes de desenhar", () => {
      expect(caminhoDoMinigrafico([1, Number.NaN, 2, Infinity, 3], 100, 40)).toBe(
        "M0,40 L50,20 L100,0",
      );
      expect(caminhoDoMinigrafico([1, Number.NaN], 100, 40)).toBe("");
    });

    it("aceita valores negativos", () => {
      expect(caminhoDoMinigrafico([-3, -2, -1], 100, 40)).toBe("M0,40 L50,20 L100,0");
    });

    it("largura ou altura 0 não geram NaN", () => {
      expect(caminhoDoMinigrafico([1, 2, 3], 0, 40)).toBe("M0,40 L0,20 L0,0");
      expect(caminhoDoMinigrafico([1, 2, 3], 100, 0)).toBe("M0,0 L50,0 L100,0");
      expect(caminhoDoMinigrafico([7, 7], 0, 0)).not.toContain("NaN");
    });
  });
});
