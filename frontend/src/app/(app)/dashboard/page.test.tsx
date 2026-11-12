// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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

describe("Resumo: o percentual não é rentabilidade", () => {
  it("rotula custo e resultado como das posições abertas, com a nota do que fica de fora", async () => {
    render(<DashboardPage />);
    const heroi = (await screen.findByText("Patrimônio total")).closest("section")!;

    expect(within(heroi).getByText("Custo das posições abertas")).toBeTruthy();
    expect(within(heroi).getByText("Resultado das posições abertas")).toBeTruthy();
    expect(within(heroi).queryByText("Aplicado")).toBeNull();
    expect(heroi.textContent).toMatch(/não incluem proventos nem o resultado de vendas já feitas/);
    expect(heroi.textContent).toMatch(/não são a rentabilidade da carteira/);
    // o leitor de tela ouve o que o percentual é
    expect(heroi.textContent).toContain("de resultado nas posições abertas");
  });

  it("o gráfico explica que é o resultado das posições que você tinha em cada mês", async () => {
    render(<DashboardPage />);
    await screen.findByText("Patrimônio total");
    expect(screen.getByText(/resultado dessas posições naquele mês/).textContent).toMatch(
      /não é a rentabilidade da carteira/,
    );
    expect(screen.queryByText(/resultado acumulado/)).toBeNull();
  });
});

describe("Resumo: proventos", () => {
  it("o total não se diz bruto (mistura importado e lançado à mão); a nota explica cada origem e o mês da data-ex", async () => {
    render(<DashboardPage />);
    await screen.findByText("Patrimônio total");
    expect(screen.getByText("Proventos por mês da data-ex")).toBeTruthy();
    expect(screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === `${brl(1500.5)} no total`)).toBeTruthy();
    expect(screen.getByText(/Os importados são o valor bruto informado pela fonte, antes de imposto/)).toBeTruthy();
    expect(screen.getByText(/lançou à mão entram como você informou/)).toBeTruthy();
    expect(screen.queryByText(/\(bruto\)/)).toBeNull();
    expect(screen.queryByText("Proventos recebidos")).toBeNull();
  });
});
