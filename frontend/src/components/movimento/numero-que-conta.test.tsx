// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispararTodos, instalarObservadorFalso, ObservadorFalso } from "./observador-falso";
import { NumeroQueConta } from "./numero-que-conta";

beforeEach(() => {
  vi.useFakeTimers();
  instalarObservadorFalso();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function partes(container: HTMLElement) {
  const leitor = container.querySelector(".sr-only") as HTMLElement;
  const visivel = container.querySelector('[aria-hidden="true"]') as HTMLElement;
  return { leitor, visivel };
}

/** Primeira leitura fora da tela, depois 60% visível: o único caminho em que a contagem roda. */
async function entrarDepoisDeFora() {
  await act(async () => dispararTodos(0));
  await act(async () => dispararTodos(0.6));
}

describe("NumeroQueConta", () => {
  it("já à vista na primeira leitura, fica no valor final e não conta", async () => {
    const pedirQuadro = vi.spyOn(window, "requestAnimationFrame");
    const { container } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    await act(async () => dispararTodos(0.6));
    expect(partes(container).visivel.textContent).toBe("208.296");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(partes(container).visivel.textContent).toBe("208.296");
    expect(pedirQuadro).not.toHaveBeenCalled();
    // Uma leitura atrasada "fora" depois de entrar não faz o número começar a contar.
    await act(async () => dispararTodos(0));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(partes(container).visivel.textContent).toBe("208.296");
    expect(pedirQuadro).not.toHaveBeenCalled();
  });

  it("parcialmente visível na primeira leitura (40%, limiar 50%), fica no final e não conta nem depois", async () => {
    const pedirQuadro = vi.spyOn(window, "requestAnimationFrame");
    const { container } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    await act(async () => dispararTodos(0.4));
    expect(partes(container).visivel.textContent).toBe("208.296");
    await act(async () => dispararTodos(0.6));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(partes(container).visivel.textContent).toBe("208.296");
    expect(pedirQuadro).not.toHaveBeenCalled();
  });

  it("visto fora primeiro e depois a 60%, conta até o valor final em 1100 ms", async () => {
    const { container } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    await act(async () => dispararTodos(0));
    expect(partes(container).visivel.textContent).toBe("0");
    await act(async () => dispararTodos(0.6));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    const meio = partes(container).visivel.textContent;
    expect(meio).not.toBe("0");
    expect(meio).not.toBe("208.296");
    await act(async () => {
      vi.advanceTimersByTime(620);
    });
    expect(partes(container).visivel.textContent).toBe("208.296");
  });

  it("o leitor de tela recebe só o valor final desde o início", async () => {
    const { container } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    const { leitor, visivel } = partes(container);
    expect(leitor.textContent).toBe("208.296");
    expect(visivel.getAttribute("aria-hidden")).toBe("true");

    // No meio da contagem, o leitor de tela continua com o valor final.
    await entrarDepoisDeFora();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(partes(container).leitor.textContent).toBe("208.296");
    expect(partes(container).visivel.textContent).not.toBe("208.296");
  });

  it("ao terminar, o número visível é o valor final", async () => {
    const { container } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    await entrarDepoisDeFora();
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    // Um quadro a mais para o último passo da contagem.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(partes(container).visivel.textContent).toBe("208.296");
  });

  it("formato percentual usa vírgula", () => {
    const { container } = render(<NumeroQueConta valor={4.58} formato="percentual" />);
    expect(partes(container).leitor.textContent).toBe("4,58%");
    expect(partes(container).visivel.textContent).toBe("4,58%");
  });

  it("formato brl e pontos passam por format.ts", () => {
    const { container, unmount } = render(<NumeroQueConta valor={1234.5} formato="brl" />);
    expect(partes(container).leitor.textContent).toBe("R$\u00a01.234,50");
    unmount();
    const outro = render(<NumeroQueConta valor={129876.4} formato="pontos" casas={1} />);
    expect(partes(outro.container).leitor.textContent).toBe("129.876,4");
  });

  it("no servidor, o número visível já é o valor final (sem 0 piscando nem erro de hidratação)", () => {
    const html = renderToString(<NumeroQueConta valor={208296} formato="inteiro" />);
    expect(html.match(/208\.296/g)?.length).toBe(2);
  });

  it("fora da tela mostra 0 e só conta quando 50% visível", async () => {
    const { container } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    await act(async () => dispararTodos(0));
    expect(partes(container).visivel.textContent).toBe("0");
    await act(async () => dispararTodos(0.3));
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(partes(container).visivel.textContent).toBe("0");
    expect(ObservadorFalso.instancias[0]?.opcoes?.threshold).toContain(0.5);
  });

  it("sem IntersectionObserver, mostra o valor final sem contar", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    expect(partes(container).visivel.textContent).toBe("208.296");
  });

  it("cancela o quadro e o observador ao desmontar", async () => {
    const cancelar = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(<NumeroQueConta valor={208296} formato="inteiro" />);
    await entrarDepoisDeFora();
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    unmount();
    expect(cancelar).toHaveBeenCalled();
    expect(ObservadorFalso.instancias.every((o) => o.desconectado)).toBe(true);
  });
});
