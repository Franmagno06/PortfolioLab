import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ATIVO_DE_EXEMPLO } from "./site-dados";

const stub = readFileSync(join(__dirname, "../../e2e/ativos/stub-api.mjs"), "utf8");

type Linha = [string, string, string, string, number, number, number, number, number, number];

describe("stub do E2E das páginas de ativos", () => {
  it("a linha do TAEE11 no stub é bem formada: uma Unit com preço e indicadores numéricos", () => {
    const bruta = stub.match(/\["TAEE11",[^\]]*\]/)?.[0];
    expect(bruta, "linha do TAEE11 em e2e/ativos/stub-api.mjs").toBeDefined();
    // [ticker, nome, setor, espécie, preço, variação, P/L, P/VP, DY 12m, ROE]
    const [ticker, , , especie, preco, , pl, pvp, dy, roe] = JSON.parse(bruta!) as Linha;

    expect(ticker).toBe("TAEE11");
    expect(especie).toBe("Unit");
    for (const v of [preco, pl, pvp, dy, roe]) expect(Number.isFinite(v)).toBe(true);
  });

  it("o exemplo didático da home não usa um ativo real do stub: a empresa é fictícia", () => {
    expect(stub).not.toContain(ATIVO_DE_EXEMPLO.nome);
    expect("ticker" in ATIVO_DE_EXEMPLO).toBe(false);
  });
});
