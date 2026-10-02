import { describe, expect, it } from "vitest";
import { chaveDoPeriodo, detectarPeriodos, rotuloDoPeriodo } from "./periodo.js";

// Data fixa: a detecção descarta período que ainda não começou.
const HOJE = new Date(2026, 8, 24);
const detectar = (texto: string) => detectarPeriodos(texto, HOJE);

describe("detectarPeriodos — trimestre", () => {
  it.each([
    ["Análise do  1T26  Desempenho", 2026, 1],
    // o pdf.js separa a sigla em letras na capa do BB
    ["A ná l i se d o Dese m pe nh o 1 T 26  B a nco do Bra s i l", 2026, 1],
    ["Release de Resultados 4T2025", 2025, 4],
    ["Resultados do 4º trimestre de 2025", 2025, 4],
    ["Resultados do 2o Trimestre 2026", 2026, 2],
    ["DESEMPENHO NO TERCEIRO TRIMESTRE DE 2025", 2025, 3],
    ["Demonstrações financeiras em 31/03/2026", 2026, 1],
    ["Posição em 30 de junho de 2026", 2026, 2],
    ["Resultados 2tri26", 2026, 2],
  ])("%s", (texto, ano, trimestre) => {
    expect(detectar(texto).trimestre).toEqual({ tipo: "trimestre", ano, trimestre });
  });

  it("série histórica na capa: fica com o trimestre mais recente", () => {
    const capa = "No 1T26, o lucro cresceu. 1T25 2T25 3T25 4T25 1T26 Lucro líquido";
    expect(detectar(capa).trimestre).toMatchObject({ ano: 2026, trimestre: 1 });
  });

  it("ignora trimestre que ainda não começou (guidance, projeção)", () => {
    expect(detectar("Resultado do 2T26. Guidance para o 4T26 mantido").trimestre).toMatchObject({
      ano: 2026,
      trimestre: 2,
    });
  });

  it("data que não fecha trimestre não vira trimestre", () => {
    expect(detectar("Divulgado em 12/05/2026").trimestre).toBeNull();
  });
});

describe("detectarPeriodos — mês", () => {
  it.each([
    ["Maxi Renda FII  B3: MXRF11  Relatório Gerencial  Maio de 2026", 2026, 5],
    ["Relatório Gerencial  Março 2026", 2026, 3],
    ["RELATÓRIO MENSAL | MARÇO/2026", 2026, 3],
    ["Relatório gerencial mar/26", 2026, 3],
    ["Competência 04/2026", 2026, 4],
    ["Posição em 31 de janeiro de 2026", 2026, 1],
  ])("%s", (texto, ano, mes) => {
    expect(detectar(texto).mes).toEqual({ tipo: "mes", ano, mes });
  });

  it("data de início do fundo não vira mês de competência", () => {
    const capa = "Maio de 2026  Destaques do Mês  Início do Fundo : 13 / 04 / 2012";
    expect(detectar(capa).mes).toMatchObject({ ano: 2026, mes: 5 });
    expect(detectar("Início do Fundo : 13 / 04 / 2012").mes).toBeNull();
  });

  it("data de divulgação (dia que não fecha o mês) é ignorada", () => {
    expect(detectar("São Paulo, 12 de maio de 2026").mes).toBeNull();
  });
});

describe("detectarPeriodos — sem período", () => {
  it.each([
    ["texto vazio", ""],
    ["capa sem data", "Relatório Gerencial — Fundo de Investimento Imobiliário"],
    ["só o ano", "Relatório Anual 2025"],
    ["só números soltos", "CNPJ 97.521.225/0001-25, 460.269.531 cotas"],
  ])("%s", (_nome, texto) => {
    expect(detectar(texto)).toEqual({ trimestre: null, mes: null });
  });
});

describe("chave e rótulo", () => {
  it("trimestre", () => {
    const p = { tipo: "trimestre", ano: 2026, trimestre: 1 } as const;
    expect(chaveDoPeriodo(p)).toBe("2026-T1");
    expect(rotuloDoPeriodo(p)).toBe("1T26");
  });

  it("mês", () => {
    const p = { tipo: "mes", ano: 2026, mes: 3 } as const;
    expect(chaveDoPeriodo(p)).toBe("2026-03");
    expect(rotuloDoPeriodo(p)).toBe("março de 2026");
  });
});
