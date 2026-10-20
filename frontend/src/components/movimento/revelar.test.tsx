// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispararTodos, instalarObservadorFalso, ObservadorFalso } from "./observador-falso";
import { Revelar } from "./revelar";

beforeEach(() => instalarObservadorFalso());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function caixa() {
  return screen.getByText("conteúdo").parentElement as HTMLElement;
}

describe("Revelar", () => {
  it("fica sem .visivel até entrar na tela", async () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    expect(caixa().classList.contains("revelar")).toBe(true);
    expect(caixa().classList.contains("visivel")).toBe(false);

    // Abaixo de 30% ainda não conta como "entrou".
    await act(async () => dispararTodos(0.1));
    expect(caixa().classList.contains("visivel")).toBe(false);
  });

  it("ganha .visivel ao entrar e não perde ao sair", async () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    await act(async () => dispararTodos(0.4));
    expect(caixa().classList.contains("visivel")).toBe(true);
    expect(ObservadorFalso.instancias.every((o) => o.desconectado)).toBe(true);

    await act(async () => dispararTodos(0));
    expect(caixa().classList.contains("visivel")).toBe(true);
  });

  it("atrasoMs vira a variável --atraso", () => {
    render(
      <Revelar atrasoMs={90} className="grid gap-4">
        <p>conteúdo</p>
      </Revelar>,
    );
    expect(caixa().style.getPropertyValue("--atraso")).toBe("90ms");
    expect(caixa().classList.contains("grid")).toBe(true);
  });

  it("observa a 30% de visibilidade", () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    const limiares = ObservadorFalso.instancias[0]?.opcoes?.threshold;
    expect(limiares).toContain(0.3);
  });

  it("sem IntersectionObserver, o conteúdo aparece na hora", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    expect(caixa().classList.contains("visivel")).toBe(true);
  });

  it("um bloco mais alto que a tela entra quando cobre 30% da altura dela", async () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    const observador = ObservadorFalso.instancias[0]!;
    const alvo = caixa();
    // 3000 px de bloco numa tela de 800 px: a fração nunca chega a 0,3, mas a tela está cheia dele.
    await act(async () => {
      (observador as unknown as { callback: IntersectionObserverCallback }).callback(
        [
          {
            target: alvo,
            isIntersecting: true,
            intersectionRatio: 0.2,
            intersectionRect: { height: 600 } as DOMRectReadOnly,
            boundingClientRect: { height: 3000 } as DOMRectReadOnly,
            rootBounds: { height: 800 } as DOMRectReadOnly,
            time: 0,
          } as IntersectionObserverEntry,
        ],
        observador as unknown as IntersectionObserver,
      );
    });
    expect(alvo.classList.contains("visivel")).toBe(true);
  });
});
