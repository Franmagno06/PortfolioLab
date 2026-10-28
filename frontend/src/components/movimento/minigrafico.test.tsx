// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { caminhoDaAreaDoMinigrafico, caminhoDoMinigrafico, pontoFinalDoMinigrafico } from "@/lib/movimento";
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
    const path = container.querySelector("path[data-linha]");
    expect(path?.getAttribute("d")).toBe(caminhoDoMinigrafico(VALORES, 120, 36));
    expect(path?.getAttribute("pathLength")).toBe("1");
    unmount();

    const outro = render(<Minigrafico valores={VALORES} largura={200} altura={50} rotulo="Ibovespa" />);
    expect(outro.container.querySelector("path[data-linha]")?.getAttribute("d")).toBe(caminhoDoMinigrafico(VALORES, 200, 50));
  });

  it("o traço se esconde fora da tela e se desenha uma vez ao ficar 50% visível", async () => {
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const path = () => container.querySelector("path[data-linha]") as SVGPathElement;
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
    const path = () => container.querySelector("path[data-linha]") as SVGPathElement;
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
    const path = () => container.querySelector("path[data-linha]") as SVGPathElement;
    await act(async () => dispararTodos(0.4));
    expect(path().classList.contains("tracar-espera")).toBe(false);
    expect(path().classList.contains("tracar")).toBe(false);
    await act(async () => dispararTodos(0.6));
    expect(path().classList.contains("tracar-espera")).toBe(false);
    expect(path().classList.contains("tracar")).toBe(false);
  });

  it("tem a área preenchida sob a linha e o ponto final no último valor", () => {
    const { container } = render(<Minigrafico valores={VALORES} largura={200} altura={50} rotulo="Ibovespa" />);
    const area = container.querySelector("path[data-area]");
    expect(area?.getAttribute("d")).toBe(caminhoDaAreaDoMinigrafico(VALORES, 200, 50));
    expect(area?.getAttribute("stroke")).toBe("none");
    expect(area?.getAttribute("fill")).toBe("currentColor");

    const ponto = container.querySelector("circle[data-ponto]");
    const esperado = pontoFinalDoMinigrafico(VALORES, 200, 50)!;
    expect(Number(ponto?.getAttribute("cx"))).toBe(esperado.x);
    expect(Number(ponto?.getAttribute("cy"))).toBe(esperado.y);

    // a área vem antes da linha no desenho, e o ponto por último: ficam por cima do que o precede
    const ordem = [...container.querySelectorAll("path, circle")].map((n) => n.getAttribute("data-area") !== null ? "area" : n.getAttribute("data-linha") !== null ? "linha" : "ponto");
    expect(ordem).toEqual(["area", "linha", "ponto"]);
  });

  it("a área e o ponto esperam fora da tela e aparecem ao entrar, o ponto só depois do traço", async () => {
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const area = () => container.querySelector("path[data-area]") as SVGPathElement;
    const ponto = () => container.querySelector("circle[data-ponto]") as SVGCircleElement;
    // à vista antes da primeira leitura
    expect(area().classList.contains("area-espera")).toBe(false);
    expect(ponto().classList.contains("ponto-espera")).toBe(false);

    await act(async () => dispararTodos(0));
    expect(area().classList.contains("area-espera")).toBe(true);
    expect(ponto().classList.contains("ponto-espera")).toBe(true);

    await act(async () => dispararTodos(0.6));
    expect(area().classList.contains("area-aparece")).toBe(true);
    expect(ponto().classList.contains("ponto-aparece")).toBe(true);
    expect(area().classList.contains("area-espera")).toBe(false);
    expect(ponto().classList.contains("ponto-espera")).toBe(false);
  });

  it("já à vista na primeira leitura, a área e o ponto ficam à vista, sem animar", async () => {
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const area = container.querySelector("path[data-area]") as SVGPathElement;
    const ponto = container.querySelector("circle[data-ponto]") as SVGCircleElement;
    await act(async () => dispararTodos(0.6));
    await act(async () => dispararTodos(0));
    for (const el of [area, ponto]) {
      expect(el.getAttribute("class") ?? "").not.toMatch(/espera|aparece/);
    }
  });

  it("a área é discreta (opacidade baixa) e nenhum elemento é lido pelo leitor de tela além do svg", () => {
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const area = container.querySelector("path[data-area]")!;
    expect(Number(area.getAttribute("fill-opacity"))).toBeGreaterThan(0);
    expect(Number(area.getAttribute("fill-opacity"))).toBeLessThanOrEqual(0.25);
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
  });

  it("sem IntersectionObserver, a linha aparece inteira", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<Minigrafico valores={VALORES} rotulo="Ibovespa" />);
    const path = container.querySelector("path[data-linha]") as SVGPathElement;
    expect(path.classList.contains("tracar-espera")).toBe(false);
  });
});
