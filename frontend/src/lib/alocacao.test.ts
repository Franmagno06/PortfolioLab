import { describe, expect, it } from "vitest";
import { maioresPosicoes } from "./alocacao";

const carteira = [
  { ticker: "PETR4", type: "ACAO", valorAtual: 400 },
  { ticker: "VALE3", type: "ACAO", valorAtual: 100 },
  { ticker: "MXRF11", type: "FII", valorAtual: 300 },
  { ticker: "HGLG11", type: "FII", valorAtual: 100 },
  { ticker: "BOVA11", type: "ETF", valorAtual: 100 },
];

describe("maioresPosicoes", () => {
  it("sem classe, ordena a carteira inteira pelo valor", () => {
    const r = maioresPosicoes(carteira, null, 3);
    expect(r.itens.map((i) => i.ticker)).toEqual(["PETR4", "MXRF11", "VALE3"]);
    expect(r.itens[0]!.percentual).toBeCloseTo(40, 5);
    expect(r.total).toBe(1000);
  });

  it("agrupa o que passa do limite em outros", () => {
    const r = maioresPosicoes(carteira, null, 3);
    expect(r.outros).toEqual({ quantidade: 2, valor: 200, percentual: 20 });
  });

  it("com classe, o percentual é sobre a própria classe", () => {
    const r = maioresPosicoes(carteira, "FII");
    expect(r.itens.map((i) => [i.ticker, i.percentual])).toEqual([
      ["MXRF11", 75],
      ["HGLG11", 25],
    ]);
    expect(r.outros).toBeNull();
  });

  it("ignora posição zerada", () => {
    const r = maioresPosicoes([...carteira, { ticker: "ITSA4", type: "ACAO", valorAtual: 0 }], "ACAO");
    expect(r.itens).toHaveLength(2);
  });

  it("classe sem posição devolve vazio sem dividir por zero", () => {
    const r = maioresPosicoes(carteira, "RENDA_FIXA");
    expect(r).toEqual({ itens: [], outros: null, total: 0 });
  });
});
