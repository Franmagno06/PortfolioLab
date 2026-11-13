import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ResultadoTrimestralGuardado } from "../ativos/ativos.tipos.js";
import { acoesPorPapel, calcularIndicadoresPelaCvm } from "./indicators.cvm.js";

// Números redondos para a conta se conferir de cabeça:
//   lucro 12m = 1,0 + 1,2 + 0,8 + 1,0 = 4,0 bi; patrimônio dos controladores = 20 bi; ativo total = 80 bi;
//   ações = 1,01 bi − 10 mi em tesouraria = 1,0 bi; preço = R$ 30.
//   LPA = 4,0 → P/L = 30 ÷ 4 = 7,5. VPA = 20 → P/VP = 30 ÷ 20 = 1,5.
//   ROE = 4 ÷ 20 = 20%. ROA = 4 ÷ 80 = 5%.
const D = (v: string | number) => new Prisma.Decimal(v);

function trimestre(periodo: string, lucro: number, extra: Partial<ResultadoTrimestralGuardado> = {}): ResultadoTrimestralGuardado {
  return {
    periodo,
    dataReferencia: "2026-06-30",
    lucroLiquido: lucro,
    patrimonioLiquido: 21_000_000_000,
    patrimonioDosControladores: 20_000_000_000,
    ativoTotal: 80_000_000_000,
    acoesTotal: 1_010_000_000,
    acoesEmTesouraria: 10_000_000,
    ...extra,
  };
}

const QUATRO = [
  trimestre("3T25", 1_000_000_000),
  trimestre("4T25", 1_200_000_000),
  trimestre("1T26", 800_000_000),
  trimestre("2T26", 1_000_000_000),
];

describe("calcularIndicadoresPelaCvm", () => {
  it("calcula P/L, P/VP, ROE e ROA com o lucro de 12 meses e o patrimônio dos controladores", () => {
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: QUATRO, acoesPorUnidade: 1 })).toEqual({
      pl: 7.5,
      pvp: 1.5,
      roe: 20,
      roa: 5,
    });
  });

  it("companhia que declara as ações em milhares: a escala sai pela faixa do P/VP, e o resultado é o mesmo", () => {
    const emMilhares = QUATRO.map((t) => ({ ...t, acoesTotal: 1_010_000, acoesEmTesouraria: 10_000 }));
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: emMilhares, acoesPorUnidade: 1 })).toEqual({
      pl: 7.5,
      pvp: 1.5,
      roe: 20,
      roa: 5,
    });
  });

  it("unit de 3 ações: preço de R$ 90 por unit dá os mesmos múltiplos que R$ 30 por ação", () => {
    // ações por unit = 1,0 bi ÷ 3; P/L = 90 × (1 bi ÷ 3) ÷ 4 bi = 7,5; P/VP = 90 × (1 bi ÷ 3) ÷ 20 bi = 1,5
    expect(calcularIndicadoresPelaCvm({ preco: 90, trimestres: QUATRO, acoesPorUnidade: 3 })).toMatchObject({
      pl: 7.5,
      pvp: 1.5,
    });
  });

  it("unit de composição desconhecida: sem P/L e P/VP, mas com ROE e ROA, que não dependem do preço", () => {
    expect(calcularIndicadoresPelaCvm({ preco: 90, trimestres: QUATRO, acoesPorUnidade: null })).toEqual({
      pl: null,
      pvp: null,
      roe: 20,
      roa: 5,
    });
  });

  it("prejuízo em 12 meses: P/L e ROE negativos são números legítimos", () => {
    const comPrejuizo = [
      trimestre("3T25", -1_000_000_000),
      trimestre("4T25", -500_000_000),
      trimestre("1T26", -300_000_000),
      trimestre("2T26", -200_000_000),
    ];
    // lucro 12m = −2,0 bi; P/L = 30 × 1 bi ÷ (−2 bi) = −15; ROE = −2 ÷ 20 = −10%; ROA = −2 ÷ 80 = −2,5%
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: comPrejuizo, acoesPorUnidade: 1 })).toEqual({
      pl: -15,
      pvp: 1.5,
      roe: -10,
      roa: -2.5,
    });
  });

  it("menos de quatro trimestres: sem lucro de 12 meses, só o P/VP sai", () => {
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: QUATRO.slice(1), acoesPorUnidade: 1 })).toEqual({
      pl: null,
      pvp: 1.5,
      roe: null,
      roa: null,
    });
  });

  it("patrimônio negativo: sem P/VP, ROE nem P/L (a escala das ações não se resolve); ROA continua", () => {
    const passivoADescoberto = QUATRO.map((t) => ({ ...t, patrimonioDosControladores: -5_000_000_000 }));
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: passivoADescoberto, acoesPorUnidade: 1 })).toEqual({
      pl: null,
      pvp: null,
      roe: null,
      roa: 5,
    });
  });

  it("lucro de 12 meses zero: P/L null, sem dividir por zero", () => {
    const zerado = [
      trimestre("3T25", 1_000_000_000),
      trimestre("4T25", -1_000_000_000),
      trimestre("1T26", 500_000_000),
      trimestre("2T26", -500_000_000),
    ];
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: zerado, acoesPorUnidade: 1 })).toMatchObject({
      pl: null,
      roe: 0,
    });
  });

  it("lucro perto de zero: o P/L estouraria a coluna Decimal(10,2) e vira null", () => {
    const quaseZero = [trimestre("3T25", 1), trimestre("4T25", 0), trimestre("1T26", 0), trimestre("2T26", 0)];
    // P/L = 30 × 1 bi ÷ R$ 1 = 30 bi
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: quaseZero, acoesPorUnidade: 1 })?.pl).toBeNull();
  });

  it("sem preço: só ROE e ROA", () => {
    expect(calcularIndicadoresPelaCvm({ preco: null, trimestres: QUATRO, acoesPorUnidade: 1 })).toEqual({
      pl: null,
      pvp: null,
      roe: 20,
      roa: 5,
    });
  });

  it("fotografia antiga, sem os campos novos: nada se calcula e devolve null", () => {
    const antiga = QUATRO.map(({ periodo, dataReferencia, lucroLiquido, patrimonioLiquido }) => ({
      periodo,
      dataReferencia,
      lucroLiquido,
      patrimonioLiquido,
    }));
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: antiga, acoesPorUnidade: 1 })).toBeNull();
  });

  it("lista vazia: null", () => {
    expect(calcularIndicadoresPelaCvm({ preco: 30, trimestres: [], acoesPorUnidade: 1 })).toBeNull();
  });
});

describe("acoesPorPapel", () => {
  it("escolhe a única escala que deixa o P/VP plausível", () => {
    // em unidades: 1 bi de ações, P/VP 1,5
    expect(acoesPorPapel(D(1_000_000_000), D(0), 1, D(20_000_000_000), D(30))?.toNumber()).toBe(1_000_000_000);
    // em milhares: 1 mi declarado = 1 bi de ações
    expect(acoesPorPapel(D(1_000_000), D(0), 1, D(20_000_000_000), D(30))?.toNumber()).toBe(1_000_000_000);
  });

  it("nenhuma escala plausível: null em vez de chutar", () => {
    // P/VP seria 45 em unidades e 45.000 em milhares
    expect(acoesPorPapel(D(1_000_000_000), D(0), 1, D(20_000_000_000), D(900))).toBeNull();
  });

  it("tesouraria igual ou maior que o capital, patrimônio zero ou preço zero: null", () => {
    expect(acoesPorPapel(D(1_000), D(1_000), 1, D(20_000_000_000), D(30))).toBeNull();
    expect(acoesPorPapel(D(1_000_000_000), D(0), 1, D(0), D(30))).toBeNull();
    expect(acoesPorPapel(D(1_000_000_000), D(0), 1, D(20_000_000_000), D(0))).toBeNull();
  });
});
