import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACOES, ETFS, FIIS } from "./ativos-catalogo";
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

  it("o menu Aprender só tem links de verdade: artigos, glossário, indicadores e como o site calcula", () => {
    const aprender = NAVEGACAO.find((i) => i.id === "aprender");
    const itens = (aprender?.colunas ?? []).flatMap((c) => c.itens);
    expect(Object.fromEntries(itens.map((i) => [i.rotulo, i.href]))).toEqual({
      Artigos: ROTAS.aprender,
      Glossário: ROTAS.glossario,
      "Indicadores explicados": ROTAS.indicadoresExplicados,
      "Como o site calcula": ROTAS.comoCalculamos,
    });
  });

  it("nada no menu Aprender fala em trilha, aula ou curso: são artigos", () => {
    const aprender = NAVEGACAO.find((i) => i.id === "aprender");
    const textos = (aprender?.colunas ?? []).flatMap((c) => [c.titulo ?? "", ...c.itens.flatMap((i) => [i.rotulo, i.descricao ?? ""])]);
    for (const t of textos) expect(t.toLowerCase()).not.toMatch(/trilha|aula|curso/);
  });

  it("os destinos que ainda não têm página seguem sem link", () => {
    const itens = NAVEGACAO.flatMap((i) => i.colunas ?? []).flatMap((c) => c.itens);
    expect(itens.filter((i) => !i.href).map((i) => i.rotulo)).toContain("Agenda de proventos");
  });

  it("Buscar ações e Buscar FIIs são links de verdade; ações por setor, agenda e ETFs seguem em breve", () => {
    const ativos = NAVEGACAO.find((i) => i.id === "ativos");
    const itens = (ativos?.colunas ?? []).flatMap((c) => c.itens);
    const porRotulo = Object.fromEntries(itens.map((i) => [i.rotulo, i.href]));

    expect(porRotulo["Buscar ações"]).toBe(ROTAS.acoes);
    expect(porRotulo["Buscar FIIs"]).toBe(ROTAS.fiis);
    expect(porRotulo["Ações por setor"]).toBeUndefined();
    expect(porRotulo["Agenda de proventos"]).toBeUndefined();
    expect(porRotulo["Buscar ETFs"]).toBe(ROTAS.etfs);
  });

  it("o menu Ativos oferece cinco fichas em cada listagem, e cada atalho existe no catálogo", () => {
    const ativos = NAVEGACAO.find((i) => i.id === "ativos");
    const itens = (ativos?.colunas ?? []).flatMap((c) => c.itens).filter((i) => i.atalhos);
    expect(itens.map((i) => i.href)).toEqual([ROTAS.acoes, ROTAS.fiis, ROTAS.etfs]);

    for (const item of itens) {
      const atalhos = item.atalhos?.itens ?? [];
      expect(atalhos).toHaveLength(5);
      const catalogo = item.href === ROTAS.acoes ? ACOES : item.href === ROTAS.fiis ? FIIS : ETFS;
      for (const atalho of atalhos) {
        expect(catalogo.some((a) => `${item.href}/${a.ticker}` === atalho.href), atalho.href).toBe(true);
      }
    }
  });

  it("o título dos atalhos não fala em 'principais' (a ordem do catálogo não é ranking)", () => {
    const titulos = NAVEGACAO.flatMap((i) => i.colunas ?? [])
      .flatMap((c) => c.itens)
      .flatMap((i) => (i.atalhos ? [i.atalhos.titulo] : []));
    expect(titulos.length).toBe(3);
    for (const t of titulos) expect(t.toLowerCase()).not.toContain("principa");
  });

  it("o rodapé aponta para as listagens de ações, FIIs e índices", () => {
    const hrefs = RODAPE.flatMap((c) => c.links.map((l) => l.href));
    expect(hrefs).toContain(ROTAS.acoes);
    expect(hrefs).toContain(ROTAS.fiis);
    expect(hrefs).toContain(ROTAS.indices);
  });

  it("o menu Ativos tem uma coluna Índices que leva à listagem de índices, sem atalhos", () => {
    const ativos = NAVEGACAO.find((i) => i.id === "ativos");
    const coluna = ativos?.colunas?.find((c) => c.titulo === "Índices");
    expect(coluna?.itens.map((i) => i.href)).toEqual([ROTAS.indices]);
    expect(coluna?.itens.every((i) => !i.atalhos)).toBe(true);
  });

  it("não há mais 'Ações por setor' no menu", () => {
    const rotulos = NAVEGACAO.flatMap((i) => i.colunas ?? []).flatMap((c) => c.itens).map((i) => i.rotulo);
    expect(rotulos).not.toContain("Ações por setor");
  });

  it("as abas da carteira cobrem as seis telas da área logada, sem repetir rota", () => {
    const hrefs = ABAS_DA_CARTEIRA.map((a) => a.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual([ROTAS.dashboard, ROTAS.carteira, ROTAS.simulacao, ROTAS.relatorios, ROTAS.indicadores, ROTAS.noticias]);
  });
});
