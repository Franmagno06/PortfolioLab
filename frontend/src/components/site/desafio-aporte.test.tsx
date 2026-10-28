// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CARTEIRA_DE_NOVEMBRO } from "@/lib/carteira-exemplo";
import { DesafioAporte } from "./desafio-aporte";

vi.mock("./botao-demo", () => ({ BotaoDemo: () => null }));

afterEach(cleanup);

const barras = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("[data-barra='depois']")];

describe("barras do desafio", () => {
  it("animam por transform (scaleX), nunca por width", () => {
    const { container } = render(<DesafioAporte carteira={CARTEIRA_DE_NOVEMBRO} />);
    const lista = barras(container);
    expect(lista).toHaveLength(CARTEIRA_DE_NOVEMBRO.length);
    for (const b of lista) {
      expect(b.style.transform).toMatch(/^scaleX\(/);
      expect(b.style.width).toBe("");
      expect(b.className).not.toMatch(/transition-\[width\]|duration-300/);
      expect(b.className).toContain("barra-escala");
    }
  });

  it("a barra do ativo cresce quando a pessoa compra uma cota", () => {
    const { container } = render(<DesafioAporte carteira={CARTEIRA_DE_NOVEMBRO} />);
    const primeiro = CARTEIRA_DE_NOVEMBRO[0]!;
    const antes = barras(container)[0]!.style.transform;
    fireEvent.click(screen.getByRole("button", { name: `Comprar mais uma cota de ${primeiro.ticker}` }));
    expect(barras(container)[0]!.style.transform).not.toBe(antes);
  });
});
