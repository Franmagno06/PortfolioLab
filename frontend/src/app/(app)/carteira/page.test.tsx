// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CarteiraPage from "./page";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
}));

const posicao = {
  ticker: "PETR4",
  name: "Petrobras PN",
  type: "ACAO",
  quantidade: 100,
  precoMedio: 30,
  precoAtual: 35,
  valorAplicado: 3000,
  valorAtual: 3500,
  lucro: 500,
  lucroPct: 16.67,
};

function respostas(posicoes: unknown[]) {
  return (rota: string) => {
    if (rota === "/portfolio") return Promise.resolve(posicoes);
    if (rota === "/assets") return Promise.resolve([]);
    if (rota === "/dividends") return Promise.resolve({ itens: [], proximoCursor: null });
    if (rota === "/portfolio/summary") return Promise.resolve({ totalProventos: 0 });
    if (rota.startsWith("/transactions")) return Promise.resolve({ itens: [], proximoCursor: null });
    return Promise.reject(new Error(`rota inesperada: ${rota}`));
  };
}

beforeEach(() => {
  api.mockImplementation(respostas([posicao]));
});

afterEach(() => {
  cleanup();
  api.mockReset();
});

const AVISO =
  "Desdobramentos, grupamentos e bonificações ainda não são ajustados automaticamente. " +
  "Se um ativo seu teve algum, confira a quantidade e o preço médio com o informe da corretora.";

describe("Posições: aviso de eventos corporativos", () => {
  it("fica na tela junto das posições, em texto (não só cor)", async () => {
    render(<CarteiraPage />);
    await screen.findByText("PETR4");

    const titulo = screen.getByText("Eventos corporativos não são ajustados");
    const caixa = titulo.parentElement!;
    expect(caixa.textContent?.replace(/\s+/g, " ")).toContain(AVISO);
  });

  it("vem antes da tabela de posições", async () => {
    render(<CarteiraPage />);
    await screen.findByText("PETR4");

    const titulo = screen.getByText("Eventos corporativos não são ajustados");
    const tabela = screen.getByRole("table");
    expect(titulo.compareDocumentPosition(tabela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("não aparece com a carteira vazia, onde não há quantidade a conferir", async () => {
    api.mockImplementation(respostas([]));
    render(<CarteiraPage />);
    await screen.findByText("Sua carteira está vazia");

    expect(screen.queryByText("Eventos corporativos não são ajustados")).toBeNull();
  });
});
