import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACOES, FIIS } from "./ativos-catalogo";
import { ACOES_COM_LOGO, caminhoDoLogo } from "./ativos-logos";

// No jsdom, import.meta.url não é file://: o Vitest roda a partir da raiz do frontend.
const PASTA = join(process.cwd(), "public", "logos");

describe("logos dos ativos", () => {
  it("toda ação do catálogo tem logo, e a lista de logos não tem ação fora do catálogo", () => {
    expect([...ACOES_COM_LOGO].sort()).toEqual(ACOES.map((a) => a.ticker).sort());
  });

  it("o arquivo de cada logo existe em public/logos", () => {
    for (const ticker of ACOES_COM_LOGO) expect(existsSync(join(PASTA, `${ticker}.svg`)), ticker).toBe(true);
  });

  it("não sobra arquivo em public/logos que nenhum ativo usa", () => {
    const arquivos = readdirSync(PASTA).map((f) => f.replace(".svg", "")).sort();
    expect(arquivos).toEqual([...ACOES_COM_LOGO].sort());
  });

  it("nenhum SVG carrega script, evento ou recurso externo (a logo vem de terceiros)", () => {
    for (const ticker of ACOES_COM_LOGO) {
      const svg = readFileSync(join(PASTA, `${ticker}.svg`), "utf8");
      expect(svg, ticker).not.toMatch(/<script|<foreignObject|<image|@import|javascript:|\son[a-z]+\s*=|href\s*=\s*["']https?:/i);
    }
  });

  it("devolve o caminho em maiúsculas, e null para FII", () => {
    expect(caminhoDoLogo("petr4")).toBe("/logos/PETR4.svg");
    for (const fii of FIIS) expect(caminhoDoLogo(fii.ticker), fii.ticker).toBeNull();
    expect(caminhoDoLogo("XXXX9")).toBeNull();
  });
});
