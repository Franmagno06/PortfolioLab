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

  it("valorNaContagem respeita a duração informada e não passa do valor final no meio", () => {
    expect(valorNaContagem(1000, 500, 1000)).toBeCloseTo(875);
    expect(valorNaContagem(1000, 10, 0)).toBe(1000);
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
  });
});
