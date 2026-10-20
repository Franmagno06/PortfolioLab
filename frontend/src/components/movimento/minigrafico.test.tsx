// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { caminhoDoMinigrafico } from "@/lib/movimento";
import { dispararTodos, instalarObservadorFalso, ObservadorFalso } from "./observador-falso";
import { Minigrafico } from "./minigrafico";

beforeEach(() => instalarObservadorFalso());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const VALORES = [120, 124, 119, 130, 128, 135];

describe("Minigrafico", () => {
  it("não renderiza com menos de 2 valores", () => {
    const { container } = render(<Minigrafico valores={[120]} rotulo="Ibovespa no mês" />);
    expect(container.innerHTML).toBe("");
    const outro = render(<Minigrafico valores={[]} rotulo="Ibovespa no mês" />);
    expect(outro.container.innerHTML).toBe("");
    const invalidos = render(<Minigrafico valores={[NaN, 3]} rotulo="Ibovespa no mês" />);
    expect(invalidos.container.innerHTML).toBe("");
  });

  it("tem role img e o rótulo", () => {
    render(<Minigrafico valores={VALORES} rotulo="Ibovespa no mês" />);
    const svg = screen.getByRole("img", { name: "Ibovespa no mês" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
  });

  it("o path usa o d de caminhoDoMinigrafico", () => {
    const { container, unmount } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toBe(caminhoDoMinigrafico(VALORES, 120, 36));
    expect(path?.getAttribute("pathLength")).toBe("1");
    unmount();

    const outro = render(<Minigrafico valores={VALORES} largura={200} altura={50} rotulo="Ibovespa" />);
    expect(outro.container.querySelector("path")?.getAttribute("d")).toBe(caminhoDoMinigrafico(VALORES, 200, 50));
  });

  it("o traço se esconde fora da tela e se desenha uma vez ao ficar 50% visível", async () => {
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const path = () => container.querySelector("path") as SVGPathElement;
    // Antes da primeira leitura do observador a linha está à vista.
    expect(path().classList.contains("tracar-espera")).toBe(false);
    expect(path().classList.contains("tracar")).toBe(false);

    await act(async () => dispararTodos(0));
    expect(path().classList.contains("tracar-espera")).toBe(true);

    await act(async () => dispararTodos(0.6));
    expect(path().classList.contains("tracar")).toBe(true);
    expect(ObservadorFalso.instancias[0]?.opcoes?.threshold).toContain(0.5);
    expect(ObservadorFalso.instancias.every((o) => o.desconectado)).toBe(true);

    await act(async () => dispararTodos(0));
    expect(path().classList.contains("tracar")).toBe(true);
  });

  it("já à vista na primeira leitura, a linha fica inteira e não se redesenha", async () => {
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const path = () => container.querySelector("path") as SVGPathElement;
    await act(async () => dispararTodos(0.6));
    expect(path().classList.contains("tracar")).toBe(false);
    expect(path().classList.contains("tracar-espera")).toBe(false);
    // Leitura atrasada "fora" depois de entrar não apaga nem anima.
    await act(async () => dispararTodos(0));
    expect(path().classList.contains("tracar")).toBe(false);
    expect(path().classList.contains("tracar-espera")).toBe(false);
  });

  it("parcialmente visível na primeira leitura (40%), a linha fica inteira e não se desenha depois", async () => {
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const path = () => container.querySelector("path") as SVGPathElement;
    await act(async () => dispararTodos(0.4));
    expect(path().classList.contains("tracar-espera")).toBe(false);
    expect(path().classList.contains("tracar")).toBe(false);
    await act(async () => dispararTodos(0.6));
    expect(path().classList.contains("tracar-espera")).toBe(false);
    expect(path().classList.contains("tracar")).toBe(false);
  });

  it("sem IntersectionObserver, a linha aparece inteira", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const path = container.querySelector("path") as SVGPathElement;
    expect(path.classList.contains("tracar-espera")).toBe(false);
  });
});
