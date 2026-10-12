import { describe, expect, it } from "vitest";
import { ACOES, ETFS, FIIS, acharEtf } from "./ativos.catalogo.js";
import { DESCRICOES, descricaoDe } from "./ativos.descricoes.js";

describe("catálogo de ETFs", () => {
  it("tem os dez ETFs combinados, sem ticker nem CNPJ repetido", () => {
    expect(ETFS.map((e) => e.ticker)).toEqual([
      "BOVA11", "IVVB11", "SMAL11", "DIVO11", "B5P211", "IMAB11", "FIXA11", "NASD11", "GOLD11", "HASH11",
    ]);
    expect(new Set(ETFS.map((e) => e.cnpj)).size).toBe(ETFS.length);
  });

  it("todo ticker de todo o catálogo é único: ETF não colide com ação nem com FII", () => {
    const todos = [...ACOES, ...FIIS, ...ETFS].map((a) => a.ticker);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("o CNPJ tem 14 dígitos, sem pontuação, como o cadastro de classes da CVM", () => {
    for (const e of ETFS) expect(e.cnpj, e.ticker).toMatch(/^\d{14}$/);
  });

  it("acha o ETF em maiúsculas ou minúsculas, e só entre os ETFs", () => {
    expect(acharEtf("bova11")?.indice).toBe("Ibovespa");
    expect(acharEtf("VALE3")).toBeUndefined();
    expect(acharEtf("MXRF11")).toBeUndefined();
  });
});

describe("descrições dos ativos", () => {
  it("todo ativo do catálogo tem uma explicação, e nenhuma sobra", () => {
    const tickers = [...ACOES, ...FIIS, ...ETFS].map((a) => a.ticker).sort();
    expect(Object.keys(DESCRICOES).sort()).toEqual(tickers);
    for (const t of tickers) expect(descricaoDe(t).length, t).toBeGreaterThan(60);
  });

  it("nenhuma explicação recomenda, ranqueia ou promete retorno (Resolução CVM 20)", () => {
    const texto = Object.values(DESCRICOES).join(" ").toLowerCase();
    for (const proibida of ["recomend", "oportunidade", "compre", "vale a pena", "garant", "melhor ", "barat"]) {
      expect(texto, proibida).not.toContain(proibida);
    }
  });

  it("ticker desconhecido devolve texto vazio, e não quebra", () => {
    expect(descricaoDe("XXXX9")).toBe("");
    expect(descricaoDe("vale3")).toBe(DESCRICOES["VALE3"]);
  });
});
