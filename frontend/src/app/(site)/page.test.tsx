// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artigoEmDestaque } from "@/lib/aprender/artigos";
import { ArtigoEmDestaque } from "@/components/aprender/artigo-em-destaque";
import SitePage from "./page";

// As seções de baixo dependem de rede, roteador e streaming; aqui só importa o topo e o "Comece por aqui".
vi.mock("@/components/site/cabecalho-site", () => ({ CabecalhoSite: () => null }));
vi.mock("@/components/site/rodape-site", () => ({ RodapeSite: () => null }));
vi.mock("@/components/site/botao-demo", () => ({ BotaoDemo: () => <button type="button">Ver a demonstração</button> }));
vi.mock("@/components/site/numeros-do-mes", () => ({ NumerosDoMesAoVivo: () => null, NumerosDoMesFixos: () => null }));
vi.mock("@/components/site/desafio-aporte", () => ({ DesafioAporte: () => null }));
vi.mock("@/components/site/ativo-anotado", () => ({ AtivoAnotado: () => null, PainelDeCriterios: () => null }));

afterEach(cleanup);

describe("topo da página inicial", () => {
  it("abre com o título de aprender e o caminho principal para os artigos", () => {
    const { container } = render(<SitePage />);
    const topo = container.querySelector("#titulo-topo")!.closest("section") as HTMLElement;

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Entenda o que você compra antes de investir.");
    expect(within(topo).getByRole("link", { name: /Começar pelos artigos/ }).getAttribute("href")).toBe("/aprender");
    expect(within(topo).getByRole("button", { name: "Ver a demonstração" })).toBeTruthy();
    expect(within(topo).getByRole("link", { name: "Criar minha conta" }).getAttribute("href")).toBe("/registro");
    expect(within(topo).getByRole("button", { name: "Pausar animação" })).toBeTruthy();
  });

  it("topo e Comece por aqui não usam linguagem de recomendação", () => {
    const { container } = render(<SitePage />);
    const secoes = [container.querySelector("#titulo-topo")!.closest("section")!, container.querySelector("#comece-por-aqui")!];
    for (const sec of secoes) {
      const texto = (sec.textContent ?? "").replace("Nada aqui é recomendação de investimento.", "");
      expect(texto).not.toMatch(/compre|melhores|oportunidade|barato|caro|recomend/i);
    }
  });
});

describe("Comece por aqui", () => {
  it("mostra o destaque, 3 cartões de artigos reais e os links de saída", () => {
    const { container } = render(<SitePage />);
    const secao = container.querySelector("#comece-por-aqui") as HTMLElement;

    expect(secao.getAttribute("aria-labelledby")).toBe("titulo-comece");
    expect(within(secao).getByRole("heading", { name: "Comece por aqui" })).toBeTruthy();

    const destaque = artigoEmDestaque()!;
    const cartoes = within(secao).getAllByRole("article");
    expect(cartoes).toHaveLength(3);
    const hrefs = cartoes.map((c) => within(c).getByRole("link").getAttribute("href"));
    for (const h of hrefs) expect(h).toMatch(/^\/aprender\/[a-z0-9-]+$/);
    expect(new Set(hrefs).size).toBe(3);
    expect(hrefs).not.toContain(`/aprender/${destaque.slug}`);

    const doDestaque = within(secao).getByRole("link", { name: new RegExp(`Ler o artigo: ${destaque.titulo.slice(0, 20)}`) });
    expect(doDestaque.getAttribute("href")).toBe(`/aprender/${destaque.slug}`);
    expect(within(secao).getByRole("link", { name: "Ver todos os artigos" }).getAttribute("href")).toBe("/aprender");
    expect(within(secao).getByRole("link", { name: "Glossário" }).getAttribute("href")).toBe("/aprender/glossario");
  });

  it("a hierarquia de títulos: h1, h2 da seção, h3 do destaque e dos cartões", () => {
    const { container } = render(<SitePage />);
    const secao = container.querySelector("#comece-por-aqui") as HTMLElement;
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(secao).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Comece por aqui"]);
    const h3 = within(secao).getAllByRole("heading", { level: 3 });
    expect(h3).toHaveLength(4);
    expect(h3[0]!.id).toBe("titulo-destaque");
  });
});

describe("Organize a sua carteira", () => {
  const secao = (c: HTMLElement) => c.querySelector("#organize-a-carteira") as HTMLElement;

  it("tem o h2, três cartões com as rotas, o desafio e a chamada da demonstração", () => {
    const { container } = render(<SitePage />);
    const s = secao(container);
    expect(s.getAttribute("aria-labelledby")).toBe("titulo-organize");
    expect(within(s).getByRole("heading", { level: 2 }).textContent).toBe("Organize a sua carteira");

    const hrefs = within(s)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/simulacao", "/dashboard", "/relatorios", "/registro"]));
    expect(s.querySelectorAll("a.interativo")).toHaveLength(3);

    expect(s.querySelector("#desafio")).not.toBeNull();
    expect(within(s).getByRole("button", { name: "Ver a demonstração" })).toBeTruthy();
    expect(within(s).getByRole("link", { name: "Criar minha conta" }).getAttribute("href")).toBe("/registro");
  });

  it("não promete que a demonstração aceita alterações, nem recomenda", () => {
    const { container } = render(<SitePage />);
    const texto = secao(container).textContent ?? "";
    expect(texto).not.toMatch(/compre|melhores|oportunidade|barato|caro|recomend/i);
    expect(texto).not.toMatch(/registre|altere|edite|monte a sua na demonstra/i);
  });

  it("vem depois de Como ler um ativo, e as seções antigas saíram", () => {
    const { container } = render(<SitePage />);
    const ids = [...container.querySelectorAll("main > section")].map((s) => s.querySelector("h1, h2")?.id ?? s.id);
    const ordem = ["titulo-topo", "comece-por-aqui", "como-ler-um-ativo", "organize-a-carteira"];
    const posicoes = ordem.map((id) =>
      [...container.querySelectorAll("main > section")].findIndex((s) => s.id === id || s.querySelector(`#${id}`)),
    );
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
    expect(ids.length).toBe(4);
    for (const nome of ["Agora é com você: o aporte de novembro", "O que você faz no PortfolioLab", "Comece pela carteira de demonstração"]) {
      expect(screen.queryByRole("heading", { name: nome })).toBeNull();
    }
    expect(container.querySelectorAll("#desafio")).toHaveLength(1);
  });
});

describe("ArtigoEmDestaque", () => {
  it("sem nivelDoTitulo mantém o h2 (como em /aprender)", () => {
    render(<ArtigoEmDestaque artigo={artigoEmDestaque()!} />);
    expect(screen.getByRole("heading", { level: 2 }).id).toBe("titulo-destaque");
  });
});
