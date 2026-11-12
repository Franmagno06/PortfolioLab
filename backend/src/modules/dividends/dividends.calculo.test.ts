import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { TransacaoParaCalculo } from "../portfolio/portfolio.service.js";
import { calcularProventosRecebidos, diaCivil } from "./dividends.service.js";

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

  it("ignora provento com data-ex futura: ainda não houve direito", () => {
    const hoje = new Date("2026-11-12T15:00:00Z");
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 100)],
      [provento("2026-11-03T13:00:00Z", 1), provento("2026-12-01T13:00:00Z", 1)],
      hoje,
    );

    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]?.dataEx.toISOString()).toBe("2026-11-03T13:00:00.000Z");
  });

  it("conta a data-ex de hoje: o direito ficou com quem tinha no fim de ontem", () => {
    const recebidos = calcularProventosRecebidos(
      [compra("2026-11-11", 100)],
      [provento("2026-11-12T13:00:00Z", 1)],
      new Date("2026-11-12T13:30:00Z"),
    );

    expect(recebidos).toHaveLength(1);
  });

  it("'hoje' é o dia de São Paulo: às 22h de Brasília a data-ex de amanhã ainda é futura", () => {
    // 2026-11-12T01:00Z é 11/11 às 22h em Brasília; a data-ex de 12/11 ainda não chegou
    const recebidos = calcularProventosRecebidos(
      [compra("2026-11-01", 100)],
      [provento("2026-11-12T13:00:00Z", 1)],
      new Date("2026-11-12T01:00:00Z"),
    );

    expect(recebidos).toHaveLength(0);
  });

  it("devolve um item por provento, em ordem cronológica", () => {
    const recebidos = calcularProventosRecebidos(
      [compra("2026-01-10", 100)],
      [provento("2026-05-15", 1), provento("2026-02-15", 1), provento("2026-03-15", 1)],
    );

    expect(recebidos.map((r) => r.dataEx.getMonth())).toEqual([1, 2, 4]);
  });
});

/**
 * Formato real da data-ex do Yahoo (API de gráfico com events=div), lido em 12/11/2026:
 * o instante é a abertura do pregão do dia da data-ex em São Paulo.
 *   PETR4  0,74813  1744894800 → 2025-04-17T13:00:00Z (Petrobras: ex-direitos a partir de 17/04/2025)
 *   MXRF11 0,099922 1735822800 → 2025-01-02T13:00:00Z
 *   HGLG11 1,10     1741190400 → 2025-03-05T16:00:00Z (Quarta de Cinzas, pregão abre às 13h)
 * A transação chega do campo de data como meia-noite UTC do dia digitado.
 * Antes da correção a comparação era por milissegundo: 2025-04-17T00:00Z < 2025-04-17T13:00Z,
 * e quem comprou NA data-ex recebia o provento.
 */
describe("calcularProventosRecebidos: data-ex no formato real do Yahoo", () => {
  const PETR4_EX = "2025-04-17T13:00:00Z"; // 1744894800
  const CINZAS_EX = "2025-03-05T16:00:00Z"; // 1741190400
  const DEPOIS = new Date("2026-11-12T15:00:00Z");

  it("o timestamp observado vira o dia certo da data-ex", () => {
    expect(diaCivil(new Date(1744894800 * 1000))).toBe("2025-04-17");
    expect(diaCivil(new Date(1741190400 * 1000))).toBe("2025-03-05");
    expect(diaCivil(new Date(1735822800 * 1000))).toBe("2025-01-02");
  });

  it("compra no dia anterior à data-ex recebe", () => {
    const r = calcularProventosRecebidos([compra("2025-04-16", 100)], [provento(PETR4_EX, 0.74813)], DEPOIS);
    expect(r).toHaveLength(1);
    expect(r[0]?.total.toString()).toBe("74.813");
  });

  it("compra NA data-ex não recebe (o defeito antigo pagava)", () => {
    const r = calcularProventosRecebidos([compra("2025-04-17", 100)], [provento(PETR4_EX, 0.74813)], DEPOIS);
    expect(r).toHaveLength(0);
  });

  it("venda (de tudo) no dia anterior à data-ex não recebe", () => {
    const r = calcularProventosRecebidos(
      [compra("2025-01-10", 100), venda("2025-04-16", 100)],
      [provento(PETR4_EX, 0.74813)],
      DEPOIS,
    );
    expect(r).toHaveLength(0);
  });

  it("venda NA data-ex recebe: ainda era dono no fim do dia anterior", () => {
    const r = calcularProventosRecebidos(
      [compra("2025-01-10", 100), venda("2025-04-17", 100)],
      [provento(PETR4_EX, 0.74813)],
      DEPOIS,
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.quantidade.toNumber()).toBe(100);
  });

  it("pregão que abre à tarde (16:00 UTC) segue o mesmo dia", () => {
    expect(
      calcularProventosRecebidos([compra("2025-03-05", 10)], [provento(CINZAS_EX, 1.1)], DEPOIS),
    ).toHaveLength(0);
    expect(
      calcularProventosRecebidos([compra("2025-03-04", 10)], [provento(CINZAS_EX, 1.1)], DEPOIS),
    ).toHaveLength(1);
  });

  it("virada de ano: compra em 30/12 recebe a data-ex de 02/01", () => {
    const r = calcularProventosRecebidos(
      [compra("2024-12-30", 100)],
      [provento("2025-01-02T13:00:00Z", 0.099922)],
      DEPOIS,
    );
    expect(r[0]?.total.toString()).toBe("9.9922");
  });

  it("fuso: data-ex à meia-noite UTC ou à meia-noite de Brasília cai no mesmo dia", () => {
    // Não observado hoje, mas um formato plausível de mudança da fonte. Ler o dia de São
    // Paulo de 00:00Z daria a véspera (21h do dia anterior) e mudaria quem tem direito.
    for (const instante of ["2025-04-17T00:00:00Z", "2025-04-17T03:00:00Z", "2025-04-17T20:59:00Z"]) {
      expect(calcularProventosRecebidos([compra("2025-04-17", 1)], [provento(instante, 1)], DEPOIS)).toHaveLength(0);
      expect(calcularProventosRecebidos([compra("2025-04-16", 1)], [provento(instante, 1)], DEPOIS)).toHaveLength(1);
    }
  });

  it("várias operações no mesmo dia da data-ex ficam todas de fora da posição", () => {
    const r = calcularProventosRecebidos(
      [compra("2025-04-16", 100), compra("2025-04-17", 50), venda("2025-04-17", 30)],
      [provento(PETR4_EX, 1)],
      DEPOIS,
    );
    expect(r[0]?.quantidade.toNumber()).toBe(100);
  });
});
