import { describe, expect, it } from "vitest";
import { cnpjDoTicker } from "../assets/cnpj.js";
import { ACOES, FIIS, acharAcao, acharFii, ehBanco } from "./ativos.catalogo.js";

// O catálogo é a fronteira de segurança das rotas públicas e a lista do que o site promete mostrar.
// Estes testes seguram o que um erro de digitação ou um ticker que deixou de existir quebraria em
// silêncio: a ficha ficaria sem resultados da CVM, ou nunca apareceria.

describe("catálogo curado", () => {
  it("tem 15 ações e 15 FIIs, sem ticker repetido", () => {
    expect(ACOES).toHaveLength(15);
    expect(FIIS).toHaveLength(15);
    expect(new Set([...ACOES, ...FIIS].map((a) => a.ticker)).size).toBe(30);
  });

  it("todo ticker do catálogo tem CNPJ: sem ele a CVM não devolve nada e a ficha fica sem resultados", () => {
    const semCnpj = [...ACOES, ...FIIS].filter((a) => !cnpjDoTicker(a.ticker)).map((a) => a.ticker);

    expect(semCnpj).toEqual([]);
  });

  it("o CNPJ da B3 vem do ajuste manual, e a tabela gerada não o sobrescreve", () => {
    expect(cnpjDoTicker("B3SA3")).toBe("09.346.601/0001-25");
    expect(cnpjDoTicker("b3sa3")).toBe("09.346.601/0001-25");
  });

  it("todo ticker segue o formato da B3 (quatro caracteres e um ou dois dígitos; o B3SA3 tem número no nome)", () => {
    for (const a of [...ACOES, ...FIIS]) expect(a.ticker, a.ticker).toMatch(/^[A-Z0-9]{4}\d{1,2}$/);
    for (const f of FIIS) expect(f.ticker, f.ticker).toMatch(/11$/);
  });

  it("acha pelo ticker em maiúsculas ou minúsculas, e só na classe certa", () => {
    expect(acharAcao("vale3")?.nome).toBe("Vale S.A.");
    expect(acharFii("mxrf11")?.tipo).toBe("Papel");
    expect(acharAcao("MXRF11")).toBeUndefined();
    expect(acharFii("VALE3")).toBeUndefined();
  });

  it("banco é só o que o catálogo marca como Bancos", () => {
    const bancos = ACOES.filter(ehBanco).map((a) => a.ticker);

    expect(bancos).toEqual(["ITUB4", "BBDC4", "BBAS3"]);
  });

  it("todo FII tem tipo e segmento; todo tipo conhecido aparece", () => {
    for (const f of FIIS) {
      expect(f.segmento.length, f.ticker).toBeGreaterThan(2);
      expect(["Tijolo", "Papel", "Híbrido", "FoF"]).toContain(f.tipo);
    }
    expect(new Set(FIIS.map((f) => f.tipo))).toEqual(new Set(["Tijolo", "Papel", "FoF"]));
  });

  it("nenhum nome promete nem ranqueia (Resolução CVM 20)", () => {
    const nomes = [...ACOES, ...FIIS].map((a) => a.nome).join(" ").toLowerCase();

    for (const proibida of ["melhor", "recomend", "top", "oportunidade"]) expect(nomes).not.toContain(proibida);
  });
});
