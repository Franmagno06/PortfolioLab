// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DICAS } from "@/lib/indicadores-explicados";
import IndicadoresPage from "./page";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
}));

afterEach(() => {
  cleanup();
  api.mockReset();
});

function indicador(ticker: string, extra: Record<string, unknown> = {}) {
  return {
    ticker,
    name: `${ticker} S.A.`,
    pl: 6.9,
    pvp: 1.2,
    dividendYield: 8.1,
    roe: 18.4,
    roa: null,
    margemLiquida: 21.3,
    setorBancario: false,
    atualizadoEm: "2026-10-27T12:00:00.000Z",
    ...extra,
  };
}

async function abrirPagina(itens: unknown[]) {
  api.mockResolvedValue(itens);
  render(<IndicadoresPage />);
  return screen.findByRole("region", { name: "O que cada indicador mede" });
}

describe("Indicadores da carteira: explicação que se abre", () => {
  it("a tabela continua com os valores de cada ação", async () => {
    await abrirPagina([indicador("TAEE11")]);
    const linha = screen.getByRole("row", { name: /TAEE11/ });
    expect(within(linha).getByText("6,90")).toBeTruthy();
  });

  it("cada indicador da tabela tem nome e frase sempre à vista, e a explicação fechada", async () => {
    const secao = await abrirPagina([indicador("TAEE11")]);
    for (const [nome, dica] of [
      ["P/L", "pl"],
      ["P/VP", "pvp"],
      ["Dividend Yield", "dy12m"],
      ["ROE", "roe"],
      ["Margem líquida", "margemLiquida"],
    ] as const) {
      const botao = within(secao).getByRole("button", { name: `${nome}: onde a leitura engana` });
      expect(botao.textContent).toContain(nome);
      expect(botao.getAttribute("aria-expanded")).toBe("false");
      // a frase (o que o número mede) fica fora do corpo, sempre visível
      const frase = within(secao).getByText(DICAS[dica].texto);
      const corpo = document.getElementById(botao.getAttribute("aria-controls")!)!;
      expect(corpo.contains(frase)).toBe(false);
      expect(corpo.hasAttribute("inert")).toBe(true);
    }
    // sem banco na carteira, ROA não aparece
    expect(within(secao).queryByRole("button", { name: /^ROA/ })).toBeNull();
  });

  it("os ids dos corpos são únicos", async () => {
    const secao = await abrirPagina([indicador("TAEE11"), indicador("ITUB4", { setorBancario: true, roa: 1.9 })]);
    const ids = within(secao)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-controls"));
    expect(ids.length).toBe(6);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(document.querySelectorAll(`[id="${id}"]`).length).toBe(1);
  });

  it("abrir mostra a armadilha e o link Saiba mais, sem repetir a frase", async () => {
    const secao = await abrirPagina([indicador("TAEE11")]);
    const botao = within(secao).getByRole("button", { name: "P/L: onde a leitura engana" });
    fireEvent.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    const corpo = document.getElementById(botao.getAttribute("aria-controls")!)!;
    expect(corpo.hasAttribute("inert")).toBe(false);
    expect(within(corpo).getByRole("note").textContent).toContain("Lucro pontual");
    expect(within(corpo).getByRole("link", { name: "Saiba mais sobre P/L" }).getAttribute("href")).toBe(
      "/aprender/indicadores#pl",
    );
    expect(corpo.textContent).not.toContain(DICAS.pl.texto);
  });

  it("com banco na carteira, ROA também é explicado", async () => {
    const secao = await abrirPagina([indicador("ITUB4", { setorBancario: true, roa: 1.9 })]);
    expect(within(secao).getByRole("button", { name: "ROA: onde a leitura engana" })).toBeTruthy();
    expect(within(secao).getByText(DICAS.roa.texto)).toBeTruthy();
  });

  it("carteira sem ações: nada para explicar", async () => {
    api.mockResolvedValue([]);
    render(<IndicadoresPage />);
    await screen.findByText("Nenhuma ação na carteira");
    expect(screen.queryByRole("region", { name: "O que cada indicador mede" })).toBeNull();
  });

  it("o texto da página não recomenda nada", () => {
    const texto = readFileSync(join(__dirname, "page.tsx"), "utf8").toLowerCase();
    for (const palavra of ["compre", "melhores", "oportunidade", "barato", "barata", "caro", "recomend"]) {
      expect(texto, palavra).not.toMatch(new RegExp(`\\b${palavra}`));
    }
  });
});
