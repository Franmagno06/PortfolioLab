// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { instalarObservadorFalso } from "@/components/movimento/observador-falso";
import { brl } from "@/lib/format";
import DashboardPage from "./page";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
}));

// O valor já vem da API em número (Decimal → number via em2Casas no backend); o front só formata.
const resumo = {
  patrimonioTotal: 123456.78,
  totalAplicado: 100000,
  lucroTotal: 23456.78,
  lucroPct: 23.46,
  totalProventos: 1500.5,
  quantidadeAtivos: 3,
  alocacaoPorClasse: [{ classe: "ACAO", valor: 123456.78, percentual: 100 }],
};

function respostas(rota: string) {
  if (rota === "/portfolio/summary") return Promise.resolve(resumo);
  if (rota === "/dividends") return Promise.resolve({ itens: [], proximoCursor: null });
  if (rota === "/portfolio") return Promise.resolve([{ ticker: "PETR4", type: "ACAO", valorAtual: 123456.78 }]);
  if (rota === "/goals") return Promise.resolve({ metas: [] });
  if (rota === "/portfolio/evolution") return Promise.resolve([]);
  return Promise.reject(new Error(`rota inesperada: ${rota}`));
}

beforeAll(() => {
  // o ResponsiveContainer do Recharts mede pelo ResizeObserver, que o jsdom não tem
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  instalarObservadorFalso();
  api.mockImplementation(respostas);
});

afterEach(() => {
  cleanup();
  api.mockReset();
  vi.unstubAllGlobals();
});

describe("Resumo: patrimônio total", () => {
  it("o leitor de tela ouve só o valor final em reais, vindo da API", async () => {
    render(<DashboardPage />);
    const rotulo = await screen.findByText("Patrimônio total");
    const heroi = rotulo.closest("section")!;
    const numero = heroi.querySelector("p.text-4xl")!;
    expect(numero.querySelector(".sr-only")?.textContent).toBe(brl(123456.78));
    // nenhum texto fora do sr-only fala com o leitor de tela: o que conta é aria-hidden
    expect(numero.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("aparece já com o valor final, antes de qualquer leitura do observador", async () => {
    render(<DashboardPage />);
    const rotulo = await screen.findByText("Patrimônio total");
    const numero = rotulo.closest("section")!.querySelector("p.text-4xl")!;
    expect(numero.querySelector('[aria-hidden="true"]')?.textContent).toBe(brl(123456.78));
  });
});
