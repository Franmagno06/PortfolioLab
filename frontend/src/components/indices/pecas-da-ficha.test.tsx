// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { instalarObservadorFalso } from "@/components/movimento/observador-falso";
import { acharIndice } from "@/lib/indices";
import { ValorDeHoje } from "./pecas-da-ficha";

beforeEach(() => instalarObservadorFalso());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ValorDeHoje (número do topo da ficha de taxa)", () => {
  it("o leitor de tela e o HTML inicial trazem o valor final, com a unidade", () => {
    const { container } = render(<ValorDeHoje indice={acharIndice("selic")!} valor={13.75} />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("13,75%");
    expect(container.textContent).toContain("13,75%");
    expect(container.textContent).toContain("a.a.");
  });

  it("sem dado, mostra o traço e não conta", () => {
    const { container } = render(<ValorDeHoje indice={acharIndice("selic")!} valor={null} />);
    expect(container.textContent).toContain("—");
    expect(container.querySelector(".sr-only")).toBeNull();
  });
});
