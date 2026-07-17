import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calcularPosicao } from "./portfolio.service.js";

// Testes UNITÁRIOS do cálculo de preço médio: função pura, sem banco.
// Cada cenário é uma regra da matemática financeira da carteira.

const D = (n: number | string) => new Prisma.Decimal(n);

function compra(qtd: number, preco: number, data: string, taxa = 0) {
  return {
    kind: "COMPRA" as const,
    quantity: D(qtd),
    unitPrice: D(preco),
    fee: D(taxa),
    executedAt: new Date(data),
  };
}

function venda(qtd: number, preco: number, data: string, taxa = 0) {
  return {
    kind: "VENDA" as const,
    quantity: D(qtd),
    unitPrice: D(preco),
    fee: D(taxa),
    executedAt: new Date(data),
  };
}

describe("calcularPosicao — preço médio ponderado", () => {
  it("carteira vazia → quantidade e PM zerados", () => {
    const { quantidade, precoMedio } = calcularPosicao([]);
    expect(quantidade.toNumber()).toBe(0);
    expect(precoMedio.toNumber()).toBe(0);
  });

  it("duas compras: PM é a média ponderada", () => {
    // 10 @ R$10 + 10 @ R$20 → 20 unidades, PM = R$15
    const { quantidade, precoMedio } = calcularPosicao([
      compra(10, 10, "2026-01-01"),
      compra(10, 20, "2026-02-01"),
    ]);
    expect(quantidade.toNumber()).toBe(20);
    expect(precoMedio.toNumber()).toBe(15);
  });

  it("taxa de corretagem entra no custo da compra", () => {
    // 10 @ R$10 + taxa R$10 → custo 110 → PM = R$11
    const { precoMedio } = calcularPosicao([compra(10, 10, "2026-01-01", 10)]);
    expect(precoMedio.toNumber()).toBe(11);
  });

  it("venda reduz a quantidade mas NÃO altera o PM (regra da Receita)", () => {
    // PM fica em 15 após as compras; vender 10 não muda o PM
    const { quantidade, precoMedio } = calcularPosicao([
      compra(10, 10, "2026-01-01"),
      compra(10, 20, "2026-02-01"),
      venda(10, 25, "2026-03-01"),
    ]);
    expect(quantidade.toNumber()).toBe(10);
    expect(precoMedio.toNumber()).toBe(15);
  });

  it("vender tudo zera quantidade e PM", () => {
    const { quantidade, precoMedio } = calcularPosicao([
      compra(10, 10, "2026-01-01"),
      venda(10, 12, "2026-02-01"),
    ]);
    expect(quantidade.toNumber()).toBe(0);
    expect(precoMedio.toNumber()).toBe(0);
  });

  it("recomprar depois de zerar recomeça o PM do zero", () => {
    const { quantidade, precoMedio } = calcularPosicao([
      compra(10, 10, "2026-01-01"),
      venda(10, 12, "2026-02-01"),
      compra(5, 30, "2026-03-01"),
    ]);
    expect(quantidade.toNumber()).toBe(5);
    expect(precoMedio.toNumber()).toBe(30);
  });

  it("ordena por data mesmo recebendo o array fora de ordem", () => {
    // mesma sequência do teste anterior, mas embaralhada:
    // se não ordenasse, a venda zeraria uma posição que ainda não existia
    const { quantidade, precoMedio } = calcularPosicao([
      compra(5, 30, "2026-03-01"),
      venda(10, 12, "2026-02-01"),
      compra(10, 10, "2026-01-01"),
    ]);
    expect(quantidade.toNumber()).toBe(5);
    expect(precoMedio.toNumber()).toBe(30);
  });

  it("PM com dízima não perde precisão (Decimal, não float)", () => {
    // 1 @ R$1 + 2 @ R$2 → custo R$5 ÷ 3 unidades → PM = 1,666... (dízima)
    const { precoMedio } = calcularPosicao([
      compra(1, 1, "2026-01-01"),
      compra(2, 2, "2026-02-01"),
    ]);
    // multiplicar o PM de volta pela quantidade recupera o custo exato
    expect(precoMedio.times(3).toDecimalPlaces(10).toNumber()).toBeCloseTo(5, 9);
  });
});
