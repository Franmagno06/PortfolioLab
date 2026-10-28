// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ArtigoEmDestaque } from "@/components/aprender/artigo-em-destaque";
import { CardArtigo } from "@/components/aprender/card-artigo";
import { CardDeIndice } from "@/components/indices/card-de-indice";
import { AbasDaCarteira } from "@/components/site/abas-da-carteira";
import { Botao } from "@/components/ui/botao";
import { INDICES } from "@/lib/indices";
import { destaqueDoIndice } from "@/lib/indices-dados";
import { DADOS_DE_EXEMPLO } from "@/lib/indices-exemplo";
import { ListaDeAcoes } from "@/components/ativos/lista-de-ativos";
import type { AcaoResumo } from "@/lib/ativos-tipos";
import type { Artigo } from "@/lib/aprender/tipos";

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  usePathname: () => "/dashboard",
}));

afterEach(cleanup);

const artigo = {
  slug: "exemplo",
  titulo: "Título do exemplo",
  subtitulo: "Subtítulo do exemplo",
  categoria: "renda-fixa",
  tempoLeitura: 5,
  atualizadoEm: "2026-10-20",
  indice: [],
} as unknown as Artigo;

function fonte(caminho: string) {
  return readFileSync(join(__dirname, "..", "..", caminho), "utf8");
}

describe("a mesma microinteração em todo o site público", () => {
  it("CardArtigo: o cartão é .interativo e a seta é .seta", () => {
    const { container } = render(<CardArtigo artigo={artigo} />);
    expect(container.querySelector("article")?.classList.contains("interativo")).toBe(true);
    expect(container.querySelector(".seta")).not.toBeNull();
  });

  it("ArtigoEmDestaque: o link de entrada é .interativo e a seta é .seta", () => {
    const { container } = render(<ArtigoEmDestaque artigo={artigo} />);
    expect(container.querySelector("a.interativo")).not.toBeNull();
    expect(container.querySelector("a .seta")).not.toBeNull();
  });

  it("CardDeIndice: o cartão é .interativo e 'Ver gráfico' tem .seta", () => {
    const indice = INDICES[0]!;
    const { container } = render(<CardDeIndice indice={indice} destaque={destaqueDoIndice(indice, DADOS_DE_EXEMPLO)} />);
    expect(container.querySelector("article")?.classList.contains("interativo")).toBe(true);
    expect(container.querySelector(".seta")?.textContent).toContain("→");
  });

  it("Botao: resposta ao toque pela classe .toque, e sem transition-colors solto", () => {
    const { container } = render(<Botao>Salvar</Botao>);
    const botao = container.querySelector("button")!;
    expect(botao.classList.contains("toque")).toBe(true);
    expect(botao.className).not.toContain("transition-colors");
  });

  it("lista de ativos: cada card do celular é um <li> .interativo com o link da ficha", () => {
    const acao = {
      ticker: "TAEE11", nome: "Taesa", setor: "Energia", especie: "UNIT", preco: 38.5, variacaoDia: 0.5,
      pl: 10, pvp: 1.2, dy12m: 8, roe: 12,
    } as unknown as AcaoResumo;
    const { container } = render(<ListaDeAcoes itens={[acao]} />);
    expect(container.querySelector('li.interativo a[href$="/TAEE11"]')).not.toBeNull();
  });

  it("consulta rápida, chips, categorias e letras usam .interativo ou .toque", () => {
    expect(fonte("app/(site)/ativos/indices/page.tsx")).toMatch(/className=\{`toque /);
    expect(fonte("app/(site)/aprender/page.tsx")).toMatch(/className="[^"]*\binterativo\b[^"]*"/);
    expect(fonte("app/(site)/aprender/page.tsx")).toContain('className="seta"');
    expect(fonte("components/aprender/lista-de-artigos.tsx")).toMatch(/\btoque\b/);
    expect(fonte("components/aprender/glossario.tsx")).toMatch(/\btoque\b/);
  });

  it("gráficos: a série (Area/Bar) anima com a duração do kit; só o Tooltip fica sem animação", () => {
    for (const arquivo of [
      "components/ativos/grafico-de-preco.tsx",
      "components/indices/grafico-de-area.tsx",
      "components/indices/grafico-de-barras.tsx",
    ]) {
      const texto = fonte(arquivo);
      expect(texto, arquivo).toContain("DURACAO_GRAFICO_MS");
      const series = [...texto.matchAll(/<(?:Area|Bar)\b[\s\S]*?\n\s*\/?>/g)].map((m) => m[0]);
      expect(series.length, arquivo).toBeGreaterThan(0);
      for (const tag of series) {
        expect(tag, arquivo).not.toContain("isAnimationActive={false}");
        expect(tag, arquivo).toContain("animationDuration={DURACAO_GRAFICO_MS}");
        expect(tag, arquivo).toContain("animationEasing={CURVA}");
      }
    }
  });
});

describe("Revelar na lista de artigos", () => {
  it("os cartões entram em cascata por coluna (1, 2 ou 3 colunas), definida no CSS", () => {
    const texto = fonte("components/aprender/lista-de-artigos.tsx");
    expect(texto).toContain("Revelar");
    expect(texto).toContain("cascata");
    const css = fonte("app/globals.css");
    expect(css).toMatch(/@media \(min-width: 48rem\)\s*\{\s*\.cascata\s*\{\s*--atraso:\s*calc\(var\(--c2\) \* 90ms\)/);
    expect(css).toMatch(/@media \(min-width: 64rem\)\s*\{\s*\.cascata\s*\{\s*--atraso:\s*calc\(var\(--c3\) \* 90ms\)/);
  });

  it("gráficos dos índices desenham só na entrada: trocar de período não refaz a animação", () => {
    for (const arquivo of ["components/indices/grafico-de-area.tsx", "components/indices/grafico-de-barras.tsx"]) {
      const texto = fonte(arquivo);
      expect(texto, arquivo).toContain("isAnimationActive={!desenhou}");
      expect(texto, arquivo).toContain("onAnimationEnd={() => setDesenhou(true)}");
    }
  });
});

describe("a mesma microinteração na área logada", () => {
  beforeAll(() => {
    // o jsdom não rola: as abas pedem scrollIntoView para trazer a aba atual à tela
    Element.prototype.scrollIntoView = () => {};
  });

  it("abas da carteira: cada aba é um link .interativo, e a atual continua marcada", () => {
    const { container } = render(<AbasDaCarteira />);
    const links = [...container.querySelectorAll("nav a")];
    expect(links.length).toBe(6);
    for (const link of links) expect(link.classList.contains("interativo"), link.textContent ?? "").toBe(true);
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain("Resumo");
    // sem transition-colors solto: a transição vem dos tokens do kit
    for (const link of links) expect(link.className).not.toContain("transition-colors");
  });

  it("dashboard: as séries (Bar/Pie) animam com a duração e a curva do kit; Tooltip sem animação", () => {
    const texto = fonte("app/(app)/dashboard/page.tsx");
    expect(texto).toContain("DURACAO_GRAFICO_MS");
    const series = [...texto.matchAll(/<(?:Bar|Pie)\b[\s\S]*?\n\s*\/?>/g)].map((m) => m[0]);
    expect(series.length).toBe(4);
    for (const tag of series) {
      expect(tag).not.toContain("isAnimationActive={false}");
      expect(tag).toContain("animationDuration={DURACAO_GRAFICO_MS}");
      expect(tag).toContain("animationEasing={CURVA}");
    }
    const dicas = [...texto.matchAll(/<Tooltip\b[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(dicas.length).toBe(3);
    for (const tag of dicas) expect(tag).toContain("isAnimationActive={false}");
  });

  it("dashboard: a pizza desenha só na entrada; trocar de classe é instantâneo", () => {
    const texto = fonte("app/(app)/dashboard/page.tsx");
    const pizza = texto.match(/<Pie\b[\s\S]*?\n\s*>/)?.[0] ?? "";
    expect(pizza).toContain("isAnimationActive={!desenhou}");
    expect(pizza).toContain("onAnimationEnd={() => setDesenhou(true)}");
  });

  it("dashboard: links e controles respondem ao toque e são alvos de 44 px", () => {
    const texto = fonte("app/(app)/dashboard/page.tsx");
    // os ativos mais longe da meta são links de entrada para a simulação: cartão .interativo
    expect(texto).toMatch(/href=\{`\/simulacao\?ticker=[\s\S]*?className="[^"]*\binterativo\b[^"]*"/);
    // o botão "Simular aporte" e os chips de classe: .toque e min-h-11
    expect(texto).toMatch(/href="\/simulacao"\s+className="[^"]*\btoque\b[^"]*\bmin-h-11\b[^"]*"/);
    // chip: altura visual preservada, alvo de 44 px por um pseudo-elemento (não quebra a linha do título do cartão)
    expect(texto).toMatch(/aria-pressed=\{classe === c\}[\s\S]*?className=\{`[^`]*\btoque\b[^`]*before:-inset-y-2\.5/);
    expect(texto).not.toContain("transition-colors");
  });

  it("linhas de tabela (posições, indicadores e histórico) não sobem: só ganham fundo, nos tokens", () => {
    const linhas: [string, RegExp][] = [
      ["app/(app)/carteira/page.tsx", /<tr\s+key=\{a\.ticker\}[\s\S]*?>/],
      ["app/(app)/indicadores/page.tsx", /<tr\s+key=\{i\.ticker\}[\s\S]*?>/],
      ["components/historico-transacoes.tsx", /<li\s+key=\{t\.id\}[\s\S]*?>/],
    ];
    for (const [arquivo, re] of linhas) {
      const tag = fonte(arquivo).match(re)?.[0] ?? "";
      expect(tag, arquivo).toContain("linha-de-tabela");
      expect(tag, arquivo).toContain("hover:bg-paper");
      expect(tag, arquivo).toContain("has-[:focus-visible]:bg-paper");
      expect(tag, arquivo).not.toContain("interativo");
      expect(tag, arquivo).not.toContain("translate");
    }
    const css = fonte("app/globals.css");
    const regra = css.match(/\n\.linha-de-tabela\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(regra).toContain("transition: background-color var(--duracao-rapida) var(--curva)");
    expect(regra).not.toContain("transform");
  });

  it("notícias: cada cartão é um link .interativo; proventos: o lançamento manual responde ao toque", () => {
    const noticias = fonte("app/(app)/noticias/page.tsx");
    expect(noticias).toMatch(/target="_blank"[\s\S]*?className=\{`[^`]*\binterativo\b/);
    expect(noticias).not.toContain("transition-colors");
    const proventos = fonte("components/proventos-card.tsx");
    expect(proventos).toMatch(/aria-expanded=\{manual\}\s+className="[^"]*\btoque\b[^"]*\bmin-h-11\b[^"]*"/);
  });
});
