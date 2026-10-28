// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { instalarObservadorFalso } from "@/components/movimento/observador-falso";
import { CabecalhoDoAtivo } from "./blocos-da-ficha";

beforeEach(() => instalarObservadorFalso());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const base = { ticker: "TAEE11", nome: "Taesa", chips: [], variacaoDia: 0.5, fechamentoEm: "2026-10-20" };

describe("CabecalhoDoAtivo: preço", () => {
  it("o leitor de tela ouve só o preço final e o HTML inicial já o mostra", () => {
    const { container } = render(<CabecalhoDoAtivo {...base} preco={38.5} />);
    const preco = container.querySelector("p.tnum .sr-only");
    expect(preco?.textContent).toMatch(/^R\$ 38,50$/);
  });

  it("sem preço, mostra o traço e a mensagem da fonte", () => {
    const { container } = render(<CabecalhoDoAtivo {...base} preco={null} />);
    expect(container.textContent).toContain("—");
    expect(container.textContent).toContain("não informou o preço");
  });
});
