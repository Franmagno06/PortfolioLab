import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACOES, ACOES_INICIAIS, acharAcao, acharFii, FIIS, FIIS_INICIAIS, inicialDoAtivo, QUANTIDADE_INICIAL } from "./ativos-catalogo";

const CATALOGO_DO_BACKEND = join(process.cwd(), "..", "backend", "src", "modules", "ativos", "ativos.catalogo.ts");

/** Os { ticker, nome } de um bloco do catálogo do backend ("export const ACOES" ou "export const FIIS"). */
function lerDoBackend(lista: "ACOES" | "FIIS") {
  const fonte = readFileSync(CATALOGO_DO_BACKEND, "utf8");
  const inicio = fonte.indexOf(`export const ${lista}:`);
  const fim = fonte.indexOf("];", inicio);
  const bloco = fonte.slice(inicio, fim);
  return [...bloco.matchAll(/ticker: "([^"]+)", nome: "([^"]+)"/g)].map((m) => ({ ticker: m[1], nome: m[2] }));
}

describe("catálogo do front", () => {
  it("é idêntico ao do backend: mesmos tickers, nomes e ordem", () => {
    expect(ACOES).toEqual(lerDoBackend("ACOES"));
    expect(FIIS).toEqual(lerDoBackend("FIIS"));
  });

  it("tem 15 ações e 15 FIIs, sem ticker repetido", () => {
    expect(ACOES).toHaveLength(15);
    expect(FIIS).toHaveLength(15);
    expect(new Set(ACOES.map((a) => a.ticker)).size).toBe(15);
    expect(new Set(FIIS.map((f) => f.ticker)).size).toBe(15);
  });

  it("a Eletrobras e a JBS saíram (deixaram de negociar com esses tickers) e entraram AXIA3 e CMIG4", () => {
    const tickers = ACOES.map((a) => a.ticker);
    expect(tickers).not.toContain("ELET3");
    expect(tickers).not.toContain("JBSS3");
    expect(tickers).toEqual(expect.arrayContaining(["AXIA3", "CMIG4"]));
  });

  it("o menu e a listagem começam pelos cinco primeiros", () => {
    expect(QUANTIDADE_INICIAL).toBe(5);
    expect(ACOES_INICIAIS.map((a) => a.ticker)).toEqual(ACOES.slice(0, 5).map((a) => a.ticker));
    expect(FIIS_INICIAIS.map((f) => f.ticker)).toEqual(FIIS.slice(0, 5).map((f) => f.ticker));
  });

  it("acha o ativo em maiúsculas ou minúsculas, e só na classe certa", () => {
    expect(acharAcao("vale3")?.nome).toBe("Vale S.A.");
    expect(acharFii("mxrf11")?.nome).toBe("Maxi Renda");
    expect(acharAcao("MXRF11")).toBeUndefined();
    expect(acharFii("VALE3")).toBeUndefined();
    expect(acharAcao("XXXX9")).toBeUndefined();
  });

  it("a inicial do avatar é a primeira letra do ticker, em maiúscula", () => {
    expect(inicialDoAtivo("vale3")).toBe("V");
    expect(inicialDoAtivo("MXRF11")).toBe("M");
  });
});
