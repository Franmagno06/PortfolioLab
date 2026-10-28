// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispararTodos, instalarObservadorFalso } from "@/components/movimento/observador-falso";
import { Secao } from "./secao";

beforeEach(() => instalarObservadorFalso());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Secao: revelar ao rolar", () => {
  it("por padrão o card vem dentro de um Revelar", () => {
    const { container } = render(
      <Secao id="x" titulo="Bloco">
        <p>conteúdo</p>
      </Secao>,
    );
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa.classList.contains("revelar")).toBe(true);
    expect(caixa.querySelector("section")).not.toBeNull();
  });

  it("revelar={false} (o bloco da primeira dobra) não cria o Revelar", () => {
    const { container } = render(
      <Secao id="x" titulo="Bloco" revelar={false}>
        <p>conteúdo</p>
      </Secao>,
    );
    expect(container.firstElementChild?.tagName).toBe("SECTION");
    expect(container.querySelector(".revelar")).toBeNull();
  });

  it("o conteúdo está no HTML inicial, visível; só espera se foi visto fora da tela, e entra ao chegar", async () => {
    const { container } = render(
      <Secao id="x" titulo="Bloco">
        <p>conteúdo</p>
      </Secao>,
    );
    const caixa = container.firstElementChild as HTMLElement;
    expect(container.textContent).toContain("conteúdo");
    expect(caixa.classList.contains("revelar-espera")).toBe(false);

    await act(async () => dispararTodos(0));
    expect(caixa.classList.contains("revelar-espera")).toBe(true);
    await act(async () => dispararTodos(0.5));
    expect(caixa.classList.contains("revelar-espera")).toBe(false);
  });
});
