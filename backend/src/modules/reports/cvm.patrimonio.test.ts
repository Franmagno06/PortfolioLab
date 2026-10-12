import { describe, expect, it } from "vitest";
import { patrimonioDasClasses } from "./cvm.provider.js";

const CABECALHO = "ID_Registro_Fundo;ID_Registro_Classe;CNPJ_Classe;Denominacao_Social;Patrimonio_Liquido;Data_Patrimonio_Liquido";

describe("patrimonioDasClasses", () => {
  it("lê o patrimônio e a data só das classes pedidas", () => {
    const csv = [
      CABECALHO,
      "1;1;10406511000161;ISHARES IBOVESPA;17669434547.72;2026-10-05",
      "2;2;99999999000199;OUTRO FUNDO;100.00;2026-10-05",
    ].join("\n");

    const r = patrimonioDasClasses(csv, ["10406511000161"]);

    expect(r.size).toBe(1);
    expect(r.get("10406511000161")).toEqual({ patrimonioLiquido: 17669434547.72, dataReferencia: "2026-10-05" });
  });

  it("ignora linha sem patrimônio, com patrimônio zero ou sem data válida", () => {
    const csv = [
      CABECALHO,
      "1;1;111;A;;2026-10-05",
      "2;2;222;B;0;2026-10-05",
      "3;3;333;C;50.5;",
      "4;4;444;D;50.5;05/10/2026",
      "5;5;555;E;70.5;2026-10-05",
    ].join("\n");

    const r = patrimonioDasClasses(csv, ["111", "222", "333", "444", "555"]);

    expect([...r.keys()]).toEqual(["555"]);
  });

  it("arquivo sem as colunas esperadas devolve vazio, em vez de ler coluna errada", () => {
    expect(patrimonioDasClasses("A;B;C\n1;2;3", ["3"]).size).toBe(0);
    expect(patrimonioDasClasses("", ["3"]).size).toBe(0);
  });
});
