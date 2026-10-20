// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GraficoDeFundo } from "./grafico-de-fundo";

afterEach(() => cleanup());

function linhas(container: HTMLElement) {
  return [...container.querySelectorAll<SVGSVGElement>("svg")];
}

describe("GraficoDeFundo", () => {
  it("o botão alterna entre Pausar e Retomar e muda aria-pressed", async () => {
    render(<GraficoDeFundo />);
    const botao = screen.getByRole("button", { name: "Pausar animação" });
    expect(botao.getAttribute("aria-pressed")).toBe("false");

    await act(async () => botao.click());
    expect(botao.textContent).toBe("Retomar animação");
    expect(botao.getAttribute("aria-pressed")).toBe("true");

    await act(async () => botao.click());
    expect(botao.textContent).toBe("Pausar animação");
    expect(botao.getAttribute("aria-pressed")).toBe("false");
  });

  it("pausado, as linhas recebem animation-play-state paused", async () => {
    const { container } = render(<GraficoDeFundo />);
    expect(linhas(container)).toHaveLength(2);
    for (const svg of linhas(container)) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.style.animationPlayState).toBe("running");
    }
    await act(async () => screen.getByRole("button").click());
    for (const svg of linhas(container)) expect(svg.style.animationPlayState).toBe("paused");
  });

  it("as duas linhas têm opacidades diferentes e ciclos próprios", () => {
    const { container } = render(<GraficoDeFundo />);
    const [a, b] = linhas(container);
    expect(a?.querySelector("path")?.getAttribute("opacity")).toBe("0.28");
    expect(b?.querySelector("path")?.getAttribute("opacity")).toBe("0.18");
    expect(a?.classList.contains("deriva-fundo-a")).toBe(true);
    expect(b?.classList.contains("deriva-fundo-b")).toBe(true);
  });
});
