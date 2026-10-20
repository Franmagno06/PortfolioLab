import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DadosDosIndices } from "./indices";

/*
 * O formato de GET /indices/dados mora em três lugares: o DTO do backend (indices.service.ts, conferido
 * por CHAVES em indices.api.test.ts), o tipo DadosDosIndices daqui e a fixture que a API de mentira do E2E
 * devolve (e2e/ativos/indices-dados.json). Renomear um campo num lugar só tem de quebrar este teste.
 */

// Exaustivas: o `satisfies` recusa nome que não existe no tipo, e o `Faltando` recusa campo esquecido.
const CHAVES = ["atualizadoEm", "hoje", "selicMensal", "ipcaMensal", "cdiMensal", "cdiTaxaMensal", "pontos"] as const satisfies readonly (keyof DadosDosIndices)[];
const PONTOS = ["ibovespa", "ifix", "smll", "sp500", "idiv"] as const satisfies readonly (keyof DadosDosIndices["pontos"])[];

type Faltando = Exclude<keyof DadosDosIndices, (typeof CHAVES)[number]>;
type PontoFaltando = Exclude<keyof DadosDosIndices["pontos"], (typeof PONTOS)[number]>;
const tudoCoberto: [Faltando, PontoFaltando] extends [never, never] ? true : false = true;

const ler = (relativo: string) => readFileSync(fileURLToPath(new URL(relativo, import.meta.url)), "utf8");
const ordenadas = (xs: readonly string[]) => [...xs].sort();

describe("contrato de GET /indices/dados", () => {
  it("o tipo DadosDosIndices tem exatamente as chaves listadas aqui", () => {
    expect(tudoCoberto).toBe(true);
  });

  it("a fixture do E2E tem as mesmas chaves do tipo, e pontos os mesmos cinco índices", () => {
    const fixture = JSON.parse(ler("../../e2e/ativos/indices-dados.json")) as Record<string, unknown>;

    expect(ordenadas(Object.keys(fixture))).toEqual(ordenadas(CHAVES));
    expect(ordenadas(Object.keys(fixture.pontos as object))).toEqual(ordenadas(PONTOS));
  });

  it("a lista CHAVES do teste de API do backend é a mesma", () => {
    const teste = ler("../../../backend/src/modules/indices/indices.api.test.ts");
    const lista = /const CHAVES = \[([^\]]*)\]/.exec(teste)?.[1];
    expect(lista, "const CHAVES em indices.api.test.ts").toBeDefined();

    const doBackend = [...(lista ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    expect(ordenadas(doBackend)).toEqual(ordenadas(CHAVES));
  });

  it("o DTO do backend declara os mesmos cinco índices em pontos", () => {
    const service = ler("../../../backend/src/modules/indices/indices.service.ts");
    const uniao = /pontos: Record<([^,]+),/.exec(service)?.[1];
    expect(uniao, "pontos: Record<...> em indices.service.ts").toBeDefined();

    const doBackend = [...(uniao ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    expect(ordenadas(doBackend)).toEqual(ordenadas(PONTOS));
  });
});
