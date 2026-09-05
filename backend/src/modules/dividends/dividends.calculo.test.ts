import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { TransacaoParaCalculo } from "../portfolio/portfolio.service.js";
import { calcularProventosRecebidos } from "./dividends.service.js";

// Atalho para montar transação sem repetir os campos que o cálculo ignora.
let proximoSeq = 0n;
function compra(em: string, qtd: number): TransacaoParaCalculo {
  proximoSeq += 1n;
  return {
    seq: proximoSeq,
    kind: "COMPRA",
    quantity: new Prisma.Decimal(qtd),
    unitPrice: new Prisma.Decimal(10),
    fee: new Prisma.Decimal(0),
    executedAt: new Date(em),
  };
}
function venda(em: string, qtd: number): TransacaoParaCalculo {
  return { ...compra(em, qtd), kind: "VENDA" };
}

const provento = (em: string, valorPorCota: number) => ({
  dataEx: new Date(em),
  valorPorCota,
});

describe("calcularProventosRecebidos", () => {
  it("paga sobre a quantidade que existia antes da data-ex", () => {
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 100)],
      [provento("2026-02-15", 0.5)],
    );

    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]?.quantidade.toNumber()).toBe(100);
    expect(recebidos[0]?.total.toNumber()).toBe(50);
  });

  it("ignora provento anterior à primeira compra", () => {
    const recebidos = calcularProventosRecebidos(
      [compra("2026-03-01", 100)],
      [provento("2026-02-15", 0.5)],
    );

    expect(recebidos).toHaveLength(0);
  });

  it("não paga quem comprou no próprio dia da data-ex", () => {
    // Regra da B3: quem tem a posição no fechamento do pregão ANTERIOR à
    // data-ex recebe. Comprar na data-ex é comprar a ação já sem o provento.
    const recebidos = calcularProventosRecebidos(
      [compra("2026-02-15", 100)],
      [provento("2026-02-15", 0.5)],
    );

    expect(recebidos).toHaveLength(0);
  });

  it("usa a posição da época, não a de hoje", () => {
    // Tinha 300 na data-ex e comprou mais 200 depois: o provento é sobre 300.
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 300), compra("2026-06-01", 200)],
      [provento("2026-03-20", 1.25)],
    );

    expect(recebidos[0]?.quantidade.toNumber()).toBe(300);
    expect(recebidos[0]?.total.toNumber()).toBe(375);
  });

  it("desconta a venda feita antes da data-ex", () => {
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 300), venda("2026-02-01", 100)],
      [provento("2026-03-20", 1)],
    );

    expect(recebidos[0]?.quantidade.toNumber()).toBe(200);
    expect(recebidos[0]?.total.toNumber()).toBe(200);
  });

  it("ignora o período em que a posição estava zerada", () => {
    // Vendeu tudo, ficou fora do ativo por meses e voltou depois. O provento
    // do meio não é dele; o de depois é.
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 100), venda("2026-02-01", 100), compra("2026-07-01", 50)],
      [provento("2026-04-10", 2), provento("2026-08-10", 2)],
    );

    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]?.dataEx.toISOString()).toContain("2026-08-10");
    expect(recebidos[0]?.quantidade.toNumber()).toBe(50);
  });

  it("mantém o valor por cota em Decimal, sem erro de centavo", () => {
    // 0.07 × 1500 dá 104.99999999999999 em ponto flutuante binário.
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 1500)],
      [provento("2026-02-15", 0.07)],
    );

    expect(recebidos[0]?.total.toString()).toBe("105");
  });

  it("devolve um item por provento, em ordem cronológica", () => {
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 100)],
      [provento("2026-05-15", 1), provento("2026-02-15", 1), provento("2026-03-15", 1)],
    );

    expect(recebidos.map((r) => r.dataEx.getMonth())).toEqual([1, 2, 4]);
  });
});
