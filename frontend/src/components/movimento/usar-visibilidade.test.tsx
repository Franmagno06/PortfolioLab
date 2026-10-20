// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispararTodos, instalarObservadorFalso } from "./observador-falso";
import { useVisibilidade } from "./usar-visibilidade";

beforeEach(() => instalarObservadorFalso());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Sonda({ limiar }: { limiar: number }) {
  const [ref, visibilidade, passouPorFora] = useVisibilidade<HTMLDivElement>(limiar);
  return (
    <div ref={ref} data-testid="sonda">
      {visibilidade}|{String(passouPorFora)}
    </div>
  );
}

const estado = () => screen.getByTestId("sonda").textContent;

describe("useVisibilidade", () => {
  it("começa esperando e sem ter passado por fora", () => {
    render(<Sonda limiar={0.5} />);
    expect(estado()).toBe("esperando|false");
  });

  it("leitura sem nenhum pixel visível marca passouPorFora", async () => {
    render(<Sonda limiar={0.5} />);
    await act(async () => dispararTodos(0));
    expect(estado()).toBe("fora|true");
    await act(async () => dispararTodos(0.6));
    expect(estado()).toBe("entrou|true");
  });

  it("parcialmente visível abaixo do limiar fica 'fora' mas NÃO passou por fora", async () => {
    render(<Sonda limiar={0.5} />);
    await act(async () => dispararTodos(0.4));
    expect(estado()).toBe("fora|false");
    await act(async () => dispararTodos(0.6));
    expect(estado()).toBe("entrou|false");
  });

  it("entrando direto, leitura atrasada sem pixel visível não marca nada", async () => {
    render(<Sonda limiar={0.3} />);
    await act(async () => dispararTodos(0.4));
    expect(estado()).toBe("entrou|false");
    await act(async () => dispararTodos(0));
    expect(estado()).toBe("entrou|false");
  });

  it("sem IntersectionObserver, nunca passou por fora", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Sonda limiar={0.5} />);
    expect(estado()).toBe("sem-observador|false");
  });
});
