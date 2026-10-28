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
  it("o HTML inicial já é visível: nada espera antes da primeira leitura do observador", () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    expect(caixa().classList.contains("revelar")).toBe(true);
    expect(caixa().classList.contains("revelar-espera")).toBe(false);
  });

  it("o que já estava (parcialmente) à vista na primeira leitura não some nem anima", async () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    await act(async () => dispararTodos(0.1));
    expect(caixa().classList.contains("revelar-espera")).toBe(false);
    await act(async () => dispararTodos(0.4));
    expect(caixa().classList.contains("revelar-espera")).toBe(false);
  });

  it("o que foi visto fora da tela espera escondido e é liberado ao entrar, sem voltar a esconder", async () => {
    render(
      <Revelar>
        <p>conteúdo</p>
      </Revelar>,
    );
    await act(async () => dispararTodos(0));
    expect(caixa().classList.contains("revelar-espera")).toBe(true);

    await act(async () => dispararTodos(0.4));
    expect(caixa().classList.contains("revelar-espera")).toBe(false);
    expect(ObservadorFalso.instancias.every((o) => o.desconectado)).toBe(true);

    await act(async () => dispararTodos(0));
    expect(caixa().classList.contains("revelar-espera")).toBe(false);
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
    expect(caixa().classList.contains("revelar-espera")).toBe(false);
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
    expect(alvo.classList.contains("revelar-espera")).toBe(false);
  });
});
