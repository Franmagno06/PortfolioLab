// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { instalarObservadorFalso } from "@/components/movimento/observador-falso";
import { acharIndice, formatarValor } from "@/lib/indices";
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

  it("o texto final é o de formatarValor: Selic e CDI com a.a., IPCA sem", () => {
    for (const slug of ["selic", "cdi", "ipca"] as const) {
      const indice = acharIndice(slug)!;
      const { container } = render(<ValorDeHoje indice={indice} valor={4.58} />);
      const esperado = formatarValor(indice, 4.58);
      expect(container.querySelector("p.tnum")?.textContent?.replace(/\s+/g, " ").trim().endsWith(esperado.replace(/^[\d.,]+%/, "").trim())).toBe(true);
      expect(container.querySelector(".sr-only")?.textContent).toBe("4,58%");
      expect(esperado.includes("a.a.")).toBe(container.textContent!.includes("a.a."));
    }
  });
});
