// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReguaPvp, posicaoNaReguaPvp } from "./regua-pvp";

afterEach(cleanup);

describe("ReguaPvp", () => {
  it("o trilho usa o token de trilho (contraste de objeto gráfico), e não um cinza a 40% de opacidade", () => {
    const { container } = render(<ReguaPvp pvp={1.96} />);
    const trilho = container.querySelector("[data-trilho]");
    expect(trilho).not.toBeNull();
    expect(trilho!.classList.contains("bg-trilho")).toBe(true);
    expect(trilho!.className).not.toMatch(/\/40|opacity/);
  });

  it("não aparece sem P/VP, com P/VP zero, negativo ou não finito", () => {
    for (const pvp of [null, 0, -1.2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { container, unmount } = render(<ReguaPvp pvp={pvp} />);
      expect(container.firstChild, String(pvp)).toBeNull();
      unmount();
    }
  });

  it("diz abaixo, igual ou acima do patrimônio contábil no nome acessível, sem barato nem caro", () => {
    const casos: [number, string][] = [
      [0.74, "abaixo do patrimônio contábil"],
      [1, "igual ao patrimônio contábil"],
      [1.96, "acima do patrimônio contábil"],
    ];
    for (const [pvp, frase] of casos) {
      const { container, unmount } = render(<ReguaPvp pvp={pvp} />);
      const nome = container.querySelector('[role="img"]')!.getAttribute("aria-label")!;
      expect(nome, String(pvp)).toContain(frase);
      expect(nome).not.toMatch(/barat|car[oa]/i);
      unmount();
    }
  });

  it("o marcador fica na posição proporcional e preso entre 0 e 100%", () => {
    expect(posicaoNaReguaPvp(1.5)).toBe(50);
    expect(posicaoNaReguaPvp(9)).toBe(100);
    expect(posicaoNaReguaPvp(-2)).toBe(0);
    expect(posicaoNaReguaPvp(Number.NaN)).toBe(0);
  });
});
