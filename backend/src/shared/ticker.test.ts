import { describe, expect, it } from "vitest";
import { tickerSchema } from "./ticker.js";

// Regra pura: não toca o banco, não precisa da skill rodar-testes-seguro.
describe("tickerSchema", () => {
  it("aceita os formatos que existem na B3", () => {
    for (const t of ["PETR4", "VALE3", "HGLG11", "TAEE11", "BOVA11", "SANB11"]) {
      expect(tickerSchema.parse(t)).toBe(t);
    }
  });

  it("aceita o Tesouro lançado à mão, que não tem código de negociação", () => {
    // IPCA2035 está no seed como RENDA_FIXA. Uma regra estrita de "4 letras e
    // até 3 dígitos" passaria em todo o resto e só quebraria esta carteira.
    expect(tickerSchema.parse("IPCA2035")).toBe("IPCA2035");
  });

  it("normaliza espaço em volta e caixa baixa", () => {
    expect(tickerSchema.parse("  petr4 ")).toBe("PETR4");
  });

  // O motivo de a validação existir: o ticker é interpolado na URL do provedor
  // de cotação. Cada um destes muda o significado da URL montada.
  it.each([
    ["barra — escaparia do caminho", "../../v1/foo"],
    ["barra simples", "PETR4/x"],
    ["query", "PETR4?a=1"],
    ["fragmento", "PETR4#a"],
    ["ponto", "PETR4.SA"],
    ["dois-pontos", "http://x"],
    ["espaço no meio", "PE TR4"],
    ["curto demais", "ABC"],
    ["vazio", ""],
  ])("recusa %s", (_caso, entrada) => {
    expect(tickerSchema.safeParse(entrada).success).toBe(false);
  });
});
