// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { INDICADORES } from "@/content/aprender/indicadores";
import IndicadoresPage from "./page";

afterEach(cleanup);

describe("Indicadores explicados", () => {
  it("cada indicador mostra o 'como ler' e a armadilha, e guarda a fórmula e o exemplo numa explicação fechada", () => {
    const { container } = render(<IndicadoresPage />);
    for (const i of INDICADORES) {
      const secao = container.querySelector(`#${i.id}`)!;
      const botao = secao.querySelector("button[aria-expanded]")!;
      expect(botao.getAttribute("aria-expanded"), i.id).toBe("false");
      const corpo = document.getElementById(botao.getAttribute("aria-controls")!)!;
      expect(corpo.hasAttribute("inert"), i.id).toBe(true);
      expect(corpo.textContent, i.id).toContain(i.formula);
      expect(corpo.textContent, i.id).toContain(i.exemplo);
      // o resto fica à vista
      expect(secao.textContent).toContain(i.comoLer);
      expect(secao.textContent).toContain(i.armadilha);
      expect(corpo.contains(secao.querySelector('[role="note"]')), i.id).toBe(false);
    }
  });

  it("cada botão tem nome acessível próprio e os ids das explicações são únicos", () => {
    const { container } = render(<IndicadoresPage />);
    const botoes = [...container.querySelectorAll("button[aria-expanded]")];
    const nomes = botoes.map((b) => b.getAttribute("aria-label"));
    expect(new Set(nomes).size).toBe(botoes.length);
    const ids = botoes.map((b) => b.getAttribute("aria-controls"));
    expect(new Set(ids).size).toBe(botoes.length);
  });
});
