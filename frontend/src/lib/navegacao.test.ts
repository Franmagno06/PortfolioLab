import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ABAS_DA_CARTEIRA, NAVEGACAO, RODAPE, ROTAS } from "./navegacao";

// "Nenhum link quebrado": cada href da navegação precisa ser uma rota de
// ROTAS, e cada rota precisa ter uma página de verdade em src/app.
// No jsdom, import.meta.url não é file://: o Vitest roda a partir da raiz do frontend.
const APP = join(process.cwd(), "src", "app");

/** Existe page.tsx para o caminho, direto ou dentro de um route group "(nome)"? */
function paginaExiste(caminho: string): boolean {
  const segmento = caminho.replace(/^\//, "");
  const grupos = readdirSync(APP).filter((d) => d.startsWith("("));
  const candidatos = [join(APP, segmento, "page.tsx"), ...grupos.map((g) => join(APP, g, segmento, "page.tsx"))];
  return candidatos.some((c) => existsSync(c));
}

function todosOsHrefs(): string[] {
  const hrefs: string[] = [];
  for (const intencao of NAVEGACAO) {
    if (intencao.href) hrefs.push(intencao.href);
    for (const coluna of intencao.colunas ?? []) {
      for (const item of coluna.itens) if (item.href) hrefs.push(item.href);
    }
    if (intencao.destaque?.link.href) hrefs.push(intencao.destaque.link.href);
  }
  for (const coluna of RODAPE) for (const link of coluna.links) hrefs.push(link.href);
  for (const aba of ABAS_DA_CARTEIRA) hrefs.push(aba.href);
  return hrefs;
}

describe("navegação do site", () => {
  it("todo href é uma das ROTAS conhecidas", () => {
    const conhecidas = new Set<string>(Object.values(ROTAS));
    expect(todosOsHrefs().filter((h) => !conhecidas.has(h))).toEqual([]);
  });

  it("toda rota tem página em src/app", () => {
    const semPagina = Object.values(ROTAS)
      .map((r) => r.split("#")[0] ?? r)
      .filter((caminho) => !paginaExiste(caminho));
    expect(semPagina).toEqual([]);
  });

  it("as âncoras da página inicial existem", () => {
    const pagina = readFileSync(join(APP, "(site)", "page.tsx"), "utf8");
    const ancoras = Object.values(ROTAS)
      .filter((r) => r.includes("#"))
      .map((r) => r.split("#")[1]);
    for (const ancora of ancoras) expect(pagina).toContain(`id="${ancora}"`);
  });

  it("as quatro intenções aparecem na ordem aprovada", () => {
    expect(NAVEGACAO.map((i) => i.rotulo)).toEqual(["Aprender", "Ativos", "Planejar", "Notícias"]);
  });

  it("item em breve não tem link; o resto tem", () => {
    const glossario = NAVEGACAO[0]?.colunas?.[1]?.itens[0];
    expect(glossario?.rotulo).toBe("Glossário");
    expect(glossario?.href).toBeUndefined();
  });

  it("as abas da carteira cobrem as seis telas da área logada, sem repetir rota", () => {
    const hrefs = ABAS_DA_CARTEIRA.map((a) => a.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual([ROTAS.dashboard, ROTAS.carteira, ROTAS.simulacao, ROTAS.relatorios, ROTAS.indicadores, ROTAS.noticias]);
  });
});
