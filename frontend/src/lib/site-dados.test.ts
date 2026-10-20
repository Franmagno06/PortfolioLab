import { describe, expect, it } from "vitest";
import { ipcaEm12Meses, variacaoPct, type DadosDosIndices } from "./indices";
import { DADOS_DE_EXEMPLO } from "./indices-exemplo";
import {
  ATIVO_DE_EXEMPLO,
  atende,
  CRITERIOS_DE_EXEMPLO,
  fraseDoJuroReal,
  juroReal,
  NUMEROS_DO_MES,
  numerosDoMes,
  TRILHAS,
} from "./site-dados";

describe("juroReal", () => {
  it("desconta a inflação pela fórmula de Fisher, não pela subtração", () => {
    const real = juroReal(13.75, 4.22);

    expect(real).toBeGreaterThan(9.1);
    expect(real).toBeLessThan(9.2);
    // a subtração simples daria 9,53: a diferença é o motivo de usar Fisher
    expect(real).toBeLessThan(13.75 - 4.22);
  });

  it("dá zero quando a taxa empata com a inflação", () => {
    expect(juroReal(5, 5)).toBeCloseTo(0, 10);
  });

  it("com o IPCA de setembro de 2026 (4,58%) o juro real fica em 8,77%", () => {
    expect(juroReal(13.75, 4.58).toFixed(2)).toBe("8.77");
  });

  it("o 'perto de 9%' da página sai do arredondamento dos números do mês", () => {
    expect(Math.round(juroReal(NUMEROS_DO_MES.selic, NUMEROS_DO_MES.ipca12m))).toBe(9);
  });
});

describe("atende", () => {
  it("confere os três critérios de exemplo contra a TAEE11", () => {
    const resultados = CRITERIOS_DE_EXEMPLO.map((c) => atende(ATIVO_DE_EXEMPLO, c));

    // ROE 20,9 > 15; DY 7,02 > 6; P/VP 1,83 não é < 1,5
    expect(resultados).toEqual([true, true, false]);
  });

  it("o limite exato não atende: acima é estritamente acima", () => {
    expect(
      atende(ATIVO_DE_EXEMPLO, { rotulo: "x", campo: "roe", comparacao: "acima", limite: 20.9 }),
    ).toBe(false);
  });
});

describe("TRILHAS", () => {
  it("é uma sequência numerada de 1 em diante, sem buraco", () => {
    expect(TRILHAS.map((t) => t.numero)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("numerosDoMes", () => {
  const ibov = DADOS_DE_EXEMPLO.pontos.ibovespa;
  const ultimo = ibov[ibov.length - 1]!;
  const mesDoUltimo = ultimo.data.slice(0, 7);
  const doMesAnterior = ibov.filter((p) => p.data.slice(0, 7) < mesDoUltimo);
  const baseDoMesAnterior = doMesAnterior[doMesAnterior.length - 1]!;

  it("sem dados cai nos números fixos e diz que não são ao vivo", () => {
    const n = numerosDoMes(null);

    expect(n.aoVivo).toBe(false);
    expect(n.selic).toBe(13.75);
    expect(n.ibovespa.pontos).toBe(NUMEROS_DO_MES.ibovespa.pontos);
    expect(n.fechamento).toBe(NUMEROS_DO_MES.fechamento);
  });

  it("com dados, lê o último ponto de cada série", () => {
    const n = numerosDoMes(DADOS_DE_EXEMPLO);
    const selic = DADOS_DE_EXEMPLO.selicMensal;
    const ipca12 = ipcaEm12Meses(DADOS_DE_EXEMPLO.ipcaMensal);
    const ifix = DADOS_DE_EXEMPLO.pontos.ifix;

    expect(n.aoVivo).toBe(true);
    expect(n.selic).toBe(selic[selic.length - 1]!.valor);
    expect(n.ipca12m).toBe(ipca12[ipca12.length - 1]!.valor);
    expect(n.ibovespa.pontos).toBe(ultimo.valor);
    expect(n.ifix.pontos).toBe(ifix[ifix.length - 1]!.valor);
  });

  it("a variação no mês é contra o último ponto do mês anterior, com 2 casas", () => {
    const esperado = Math.round(variacaoPct(baseDoMesAnterior.valor, ultimo.valor)! * 100) / 100;

    expect(numerosDoMes(DADOS_DE_EXEMPLO).ibovespa.variacaoNoMes).toBe(esperado);
  });

  it("escreve a data do último pregão e deriva os meses dela", () => {
    const n = numerosDoMes(DADOS_DE_EXEMPLO);
    const [, mm, dd] = ultimo.data.split("-");

    expect(n.fechamentoCurto).toBe(`${Number(dd)}/${Number(mm)}`);
    expect(n.fechamento.startsWith(`${Number(dd)} de `)).toBe(true);
    expect(n.rotulo).toBe(`${n.mes} de ${ultimo.data.slice(0, 4)}`);
    expect(n.mesAnterior).not.toBe(n.mes);
  });

  it("sem ponto no mês anterior não inventa variação", () => {
    const soODoMes: DadosDosIndices = {
      ...DADOS_DE_EXEMPLO,
      pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa: [ultimo] },
    };
    const n = numerosDoMes(soODoMes);

    expect(n.aoVivo).toBe(true);
    expect(n.ibovespa.pontos).toBe(ultimo.valor);
    expect(n.ibovespa.variacaoNoMes).toBeNull();
  });

  it("base zero no mês anterior também não vira variação", () => {
    const zerado: DadosDosIndices = {
      ...DADOS_DE_EXEMPLO,
      pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa: [{ data: "2026-09-30", valor: 0 }, ultimo] },
    };

    expect(numerosDoMes(zerado).ibovespa.variacaoNoMes).toBeNull();
  });

  it.each([
    ["selicMensal", { selicMensal: [] }],
    ["ipcaMensal", { ipcaMensal: [] }],
    ["IPCA com menos de 12 meses", { ipcaMensal: DADOS_DE_EXEMPLO.ipcaMensal.slice(0, 5) }],
    ["ibovespa", { pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa: [] } }],
    ["ifix", { pontos: { ...DADOS_DE_EXEMPLO.pontos, ifix: [] } }],
  ] as const)("série ausente (%s) devolve tudo fixo, sem misturar dado vivo com data velha", (_nome, parcial) => {
    const n = numerosDoMes({ ...DADOS_DE_EXEMPLO, ...parcial } as DadosDosIndices);

    expect(n.aoVivo).toBe(false);
    expect(n.selic).toBe(13.75);
    expect(n.fechamento).toBe(NUMEROS_DO_MES.fechamento);
  });
});

describe("numerosDoMes: pregão em andamento", () => {
  const comIbov = (hoje: string, ibovespa: { data: string; valor: number }[]): DadosDosIndices => ({
    ...DADOS_DE_EXEMPLO,
    hoje,
    pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa },
  });

  it("último ponto com a data de hoje: intradiário (não é fechamento)", () => {
    const n = numerosDoMes(
      comIbov("2026-10-19", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-16", valor: 195000 },
        { data: "2026-10-19", valor: 196000 },
      ]),
    );

    expect(n.aoVivo).toBe(true);
    expect(n.intradiario).toBe(true);
    expect(n.fechamento).toBe("19 de outubro");
    // a conta da variação continua contra o último ponto de setembro
    expect(n.ibovespa.variacaoNoMes).toBe(3.16);
  });

  it("último ponto de ontem: fechamento", () => {
    const n = numerosDoMes(
      comIbov("2026-10-20", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-19", valor: 196000 },
      ]),
    );

    expect(n.intradiario).toBe(false);
    expect(n.fechamento).toBe("19 de outubro");
  });

  it("sábado com o último pregão na sexta: fechamento", () => {
    const n = numerosDoMes(
      comIbov("2026-10-24", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-23", valor: 197000 },
      ]),
    );

    expect(n.intradiario).toBe(false);
    expect(n.fechamento).toBe("23 de outubro");
  });

  it("o conjunto fixo nunca é intradiário", () => {
    expect(numerosDoMes(null).intradiario).toBe(false);
  });
});

describe("fraseDoJuroReal", () => {
  const juntar = (f: { antes: string; destaque: string; depois: string }) => f.antes + f.destaque + f.depois;

  it("juro real positivo (13,75% e 4,58%): rende perto de 9% e é a régua", () => {
    const f = fraseDoJuroReal(13.75, 4.58);
    expect(f.destaque).toBe("perto de 9% ao ano");
    expect(juntar(f)).toBe(
      "Descontada a inflação, a renda fixa rende perto de 9% ao ano. É a régua que qualquer outro investimento precisa superar.",
    );
  });

  it("juro real zero: não cobre a inflação, sem '-0'", () => {
    const f = fraseDoJuroReal(5, 5);
    expect(f.destaque).toBe("não cobre a inflação");
    expect(juntar(f)).not.toContain("-0");
    expect(f.depois).toBe(": o juro real está em 0,0% ao ano.");
  });

  it("juro real negativo: não cobre a inflação e mostra o número negativo", () => {
    const f = fraseDoJuroReal(4, 6);
    expect(f.destaque).toBe("não cobre a inflação");
    expect(f.depois).toBe(": o juro real está em -1,9% ao ano.");
    expect(juntar(f)).not.toContain("régua");
  });

  it("negativo pequeno que arredonda para zero não vira '-0,0%'", () => {
    const f = fraseDoJuroReal(5, 5.02);
    expect(f.depois).toBe(": o juro real está em 0,0% ao ano.");
  });

  it("positivo abaixo de meio ponto: não diz 'perto de 0%'", () => {
    const f = fraseDoJuroReal(5.3, 5);
    expect(f.destaque).toBe("menos de 1% ao ano");
  });
});
