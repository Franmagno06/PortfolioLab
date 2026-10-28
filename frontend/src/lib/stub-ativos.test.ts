import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ATIVO_DE_EXEMPLO } from "./site-dados";

const stub = readFileSync(join(__dirname, "../../e2e/ativos/stub-api.mjs"), "utf8");

type Linha = [string, string, string, string, number, number, number, number, number, number];

describe("stub do E2E das páginas de ativos", () => {
  it("o TAEE11 do stub tem os números do exemplo da home (20/10/2026), e não os de 2/10", () => {
    const bruta = stub.match(/\["TAEE11",[^\]]*\]/)?.[0];
    expect(bruta, "linha do TAEE11 em e2e/ativos/stub-api.mjs").toBeDefined();
    // [ticker, nome, setor, espécie, preço, variação, P/L, P/VP, DY 12m, ROE]
    const [ticker, , , especie, preco, , pl, pvp, dy, roe] = JSON.parse(bruta!) as Linha;

    expect(ticker).toBe(ATIVO_DE_EXEMPLO.ticker);
    expect(especie).toBe("Unit");
    expect(preco).toBe(ATIVO_DE_EXEMPLO.preco);
    expect(pl).toBe(ATIVO_DE_EXEMPLO.pl);
    expect(pvp).toBe(ATIVO_DE_EXEMPLO.pvp);
    expect(dy).toBe(ATIVO_DE_EXEMPLO.dy12m);
    expect(roe).toBe(ATIVO_DE_EXEMPLO.roe);
  });
});
