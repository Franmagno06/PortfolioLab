import { describe, expect, it } from "vitest";
import { calcularAporte, type CandidatoAporte } from "./rebalance.service.js";

// Testes UNITÁRIOS do algoritmo guloso — função pura, sem banco.
// Cobrem os cenários-limite exigidos no roadmap.

function ativo(
  ticker: string,
  precoAtual: number,
  valorAtual: number,
  alvoPct: number,
): CandidatoAporte {
  return { ticker, name: ticker, precoAtual, valorAtual, alvoPct };
}

describe("calcularAporte — algoritmo guloso de rebalanceamento", () => {
  it("aporte insuficiente para 1 unidade → nenhuma compra, dinheiro sobra", () => {
    const r = calcularAporte([ativo("CARO11", 500, 0, 100)], 100, 0);
    expect(r.compras).toHaveLength(0);
    expect(r.restante).toBe(100);
    expect(r.totalGasto).toBe(0);
  });

  it("carteira vazia → distribui o aporte proporcionalmente às metas", () => {
    const r = calcularAporte([ativo("A", 10, 0, 50), ativo("B", 20, 0, 50)], 100, 0);
    // déficits iguais (R$50 cada) → empate → menor preço compra primeiro
    expect(r.compras[0]).toMatchObject({ ticker: "A", quantidade: 5, total: 50 });
    expect(r.compras[1]).toMatchObject({ ticker: "B", quantidade: 2, total: 40 });
    expect(r.restante).toBe(10);
  });

  it("todos os ativos acima da meta → nenhuma compra", () => {
    // patrimônio 1000 + aporte 100 = 1100
    // A: meta 20% (R$220), possui R$600 → excesso
    // B: meta 30% (R$330), possui R$400 → excesso
    const r = calcularAporte([ativo("A", 10, 600, 20), ativo("B", 10, 400, 30)], 100, 1000);
    expect(r.compras).toHaveLength(0);
    expect(r.restante).toBe(100);
  });

  it("prioriza o ativo com MAIOR déficit", () => {
    // patrimônio 900 + 100 = 1000
    // A: meta 50% (R$500), possui R$300 → déficit R$200
    // B: meta 50% (R$500), possui R$600 → excesso (não recebe)
    const r = calcularAporte([ativo("A", 10, 300, 50), ativo("B", 10, 600, 50)], 100, 900);
    expect(r.compras).toHaveLength(1);
    expect(r.compras[0]).toMatchObject({ ticker: "A", quantidade: 10, total: 100 });
  });

  it("não compra além do déficit de cada ativo", () => {
    // aporte 100, carteira vazia: B (meta 70%) déficit 70, A (meta 30%) déficit 30
    const r = calcularAporte([ativo("A", 10, 0, 30), ativo("B", 10, 0, 70)], 100, 0);
    expect(r.compras[0]).toMatchObject({ ticker: "B", quantidade: 7 });
    expect(r.compras[1]).toMatchObject({ ticker: "A", quantidade: 3 });
    expect(r.restante).toBe(0);
  });

  it("nunca compra fração de unidade (floor)", () => {
    const r = calcularAporte([ativo("A", 33, 0, 100)], 100, 0);
    expect(r.compras[0]?.quantidade).toBe(3); // 3 × 33 = 99
    expect(r.restante).toBe(1);
  });

  it("empate total de déficit e preço → desempata por ticker (determinístico)", () => {
    const r = calcularAporte([ativo("ZZZ", 10, 0, 50), ativo("AAA", 10, 0, 50)], 40, 0);
    expect(r.compras[0]?.ticker).toBe("AAA");
  });

  it("alocação 'antes vs. depois' aproxima o ativo da meta", () => {
    // A: 0% da carteira, meta 50% · B: 100% da carteira, meta 50%
    // patrimônio 100 + aporte 100 → todo o aporte vai para A
    const r = calcularAporte([ativo("A", 10, 0, 50), ativo("B", 10, 100, 50)], 100, 100);
    const a = r.alocacao.find((x) => x.ticker === "A");
    expect(a?.atualPct).toBe(0);
    expect(a?.aposAportePct).toBe(50); // saiu de 0% e chegou exatamente na meta
  });
});

describe("achado 16 — ativo sem preço", () => {
  // REGRESSÃO: o guarda contra divisão por zero entrou na Onda 1. Este teste
  // existe para que ele não volte a sair, não como parte do ciclo TDD do achado.
  it("regressão: preço zero não derruba a simulação nem vira compra", () => {
    const r = calcularAporte([ativo("SEMPRECO", 0, 0, 100)], 1000, 0);

    expect(r.compras).toHaveLength(0);
    expect(r.restante).toBe(1000);
  });

  it("o ativo ignorado consta do resultado com o motivo", () => {
    const r = calcularAporte([ativo("SEMPRECO", 0, 0, 100)], 1000, 0);

    expect(r.ignorados).toEqual([
      { ticker: "SEMPRECO", motivo: "sem cotação disponível — preço zerado" },
    ]);
  });

  it("um ativo sem preço não impede os outros de receberem o aporte", () => {
    const r = calcularAporte([ativo("SEMPRECO", 0, 0, 50), ativo("BOM", 10, 0, 50)], 100, 0);

    expect(r.compras).toHaveLength(1);
    expect(r.compras[0]).toMatchObject({ ticker: "BOM", quantidade: 5 });
    expect(r.ignorados.map((i) => i.ticker)).toEqual(["SEMPRECO"]);
  });

  it("sem ativo problemático, a lista de ignorados vem vazia", () => {
    const r = calcularAporte([ativo("A", 10, 0, 100)], 100, 0);

    expect(r.ignorados).toEqual([]);
  });

  // Se 'ignorados' só contasse o preço zerado, um cliente que a lesse vazia
  // concluiria "todos os ativos foram considerados" — falso sempre que o
  // aporte não cobre uma unidade sequer.
  it("ativo caro demais para uma unidade também é reportado", () => {
    const r = calcularAporte([ativo("CARO11", 500, 0, 100)], 100, 0);

    expect(r.compras).toHaveLength(0);
    expect(r.ignorados).toEqual([
      { ticker: "CARO11", motivo: "aporte insuficiente para 1 unidade (R$ 500,00)" },
    ]);
  });

  it("ativo acima da meta não é 'ignorado' — aparece na alocação", () => {
    // B possui R$600 com meta de 20%: não recebe aporte, mas isso é o
    // algoritmo funcionando, não uma anomalia a reportar.
    const r = calcularAporte([ativo("A", 10, 0, 80), ativo("B", 10, 600, 20)], 100, 1000);

    expect(r.ignorados.map((i) => i.ticker)).not.toContain("B");
    expect(r.alocacao.map((a) => a.ticker)).toContain("B");
  });
});
