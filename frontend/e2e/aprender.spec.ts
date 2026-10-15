import { expect, test, type Page } from "@playwright/test";
import { listarArtigos } from "../src/lib/aprender/artigos";
import { caixaAlta } from "../src/lib/aprender/texto";
import { CATEGORIAS, rotuloDaCategoria } from "../src/lib/aprender/tipos";

// Aba Aprender: índice de artigos, artigo, glossário, indicadores e "como o site calcula". Roda com a
// config isolada das páginas de ativos (playwright.ativos.config.ts): o Next lê uma API de mentira,
// sem backend, Docker ou banco. As páginas de Aprender são conteúdo estático, então o que se
// confere aqui é comportamento: navegar, filtrar, rolar até a âncora, o que a tela faz em celular
// e se o cabeçalho é o mesmo em toda página, sem nenhuma aba marcada.
//
// Os testes leem os artigos de src/content (listarArtigos) em vez de repetir títulos: quando um
// artigo novo entra, o filtro e o "Continue lendo" passam a ser exercitados sem mexer aqui.

test.describe.configure({ timeout: 60_000 });

const ARTIGOS = listarArtigos();
const ARTIGO = ARTIGOS.find((a) => a.slug === "pl-e-pvp");
if (!ARTIGO) throw new Error("O artigo pl-e-pvp é a base destes testes e não foi encontrado.");

const CELULAR = { width: 375, height: 800 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

/** Erro de JavaScript ou console.error derruba o teste, mesmo que a tela "pareça" certa. */
function falharEmErroNoConsole(page: Page) {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && erros.push(`console: ${m.text()}`));
  return () => expect(erros, "erros no console").toEqual([]);
}

const migalhas = (page: Page) => page.getByRole("navigation", { name: "Você está em" });
const cabecalho = (page: Page) => page.getByRole("banner");

const PAGINAS = [
  { rota: "/aprender", titulo: "Aprender", voltar: "Voltar para o início" },
  { rota: `/aprender/${ARTIGO.slug}`, titulo: ARTIGO.titulo, voltar: "Voltar para Aprender" },
  { rota: "/aprender/glossario", titulo: "Glossário", voltar: "Voltar para Aprender" },
  { rota: "/aprender/indicadores", titulo: "Indicadores explicados", voltar: "Voltar para Aprender" },
  { rota: "/aprender/como-calculamos", titulo: "Como o site calcula", voltar: "Voltar para Aprender" },
];

test.describe("em todas as páginas de Aprender", () => {
  for (const p of PAGINAS) {
    test(`${p.rota}: título, trilha de navegação, "Voltar" e nenhum erro no console`, async ({ page }) => {
      const semErros = falharEmErroNoConsole(page);
      await page.goto(p.rota);

      await expect(page.getByRole("heading", { level: 1, name: p.titulo })).toBeVisible();
      await expect(migalhas(page).getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
      await expect(migalhas(page).locator("[aria-current=page]")).toBeVisible();
      await expect(page.getByRole("link", { name: p.voltar })).toBeVisible();
      semErros();
    });
  }

  test("o cabeçalho é o mesmo em todas e nenhuma aba do menu aparece como atual", async ({ page }) => {
    const textos: string[] = [];
    for (const p of PAGINAS) {
      await page.goto(p.rota);
      textos.push(await cabecalho(page).innerText());

      const abas = cabecalho(page).getByRole("button", { name: /^(Aprender|Ativos|Planejar)$/ });
      const notícias = cabecalho(page).getByRole("link", { name: "Notícias" });
      const todas = [...(await abas.all()), notícias];
      expect(todas.length).toBe(4);

      const estilos = await Promise.all(
        todas.map((a) => a.evaluate((el) => ({ cor: getComputedStyle(el).color, fundo: getComputedStyle(el).backgroundColor, atual: el.getAttribute("aria-current"), sublinhado: getComputedStyle(el).textDecorationLine }))),
      );
      for (const e of estilos) expect(e.atual, `${p.rota}: aria-current numa aba`).toBeNull();
      // Todas com o mesmo visual: texto claro sobre o navy, sem fundo e sem sublinhado.
      expect(new Set(estilos.map((e) => `${e.cor}|${e.fundo}|${e.sublinhado}`)).size, `${p.rota}: abas com estilos diferentes`).toBe(1);
    }
    expect(new Set(textos).size).toBe(1);
  });

  for (const [nome, viewport] of [["375", CELULAR], ["768", TABLET], ["1440", DESKTOP]] as const) {
    test(`sem rolagem horizontal em ${nome} px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const p of PAGINAS) {
        await page.goto(p.rota);
        const { rolagem, largura } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, largura: window.innerWidth }));
        expect(rolagem, `${p.rota} em ${nome}px`).toBeLessThanOrEqual(largura);
      }
    });
  }

  test("o menu Aprender leva às quatro páginas", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/aprender");
    // Abre pelo clique, conferindo aria-expanded: um hover antes da hidratação não abria nada e o teste
    // falhava de vez em quando. toPass repete até o menu abrir de fato, sem espera fixa.
    const aprender = cabecalho(page).getByRole("button", { name: "Aprender" });
    await expect(async () => {
      if ((await aprender.getAttribute("aria-expanded")) !== "true") await aprender.click();
      await expect(aprender).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass();
    for (const [nome, href] of [["Artigos", "/aprender"], ["Glossário", "/aprender/glossario"], ["Indicadores explicados", "/aprender/indicadores"], ["Como o site calcula", "/aprender/como-calculamos"]]) {
      await expect(cabecalho(page).getByRole("link", { name: new RegExp(nome) }).first()).toHaveAttribute("href", href);
    }
  });
});

test.describe("índice de artigos", () => {
  test("mostra o destaque, os cinco temas e o contador de artigos", async ({ page }) => {
    await page.goto("/aprender");
    const destaque = page.getByRole("region", { name: ARTIGO.titulo });
    await expect(destaque.getByRole("link", { name: /Ler o artigo/ })).toHaveAttribute("href", `/aprender/${ARTIGO.slug}`);

    const filtro = page.getByRole("navigation", { name: "Filtrar por tema" });
    await expect(filtro.getByRole("link", { name: `Todos (${ARTIGOS.length})` })).toHaveAttribute("aria-current", "true");
    for (const c of CATEGORIAS) await expect(filtro.getByRole("link", { name: c.rotulo })).toBeVisible();
  });

  for (const c of CATEGORIAS) {
    test(`filtro "${c.rotulo}": só os artigos do tema, ou um estado vazio com saída`, async ({ page }) => {
      await page.goto("/aprender");
      await page.getByRole("navigation", { name: "Filtrar por tema" }).getByRole("link", { name: c.rotulo }).click();

      await expect(page).toHaveURL(`/aprender?tema=${c.id}`);
      await expect(page.getByRole("navigation", { name: "Filtrar por tema" }).getByRole("link", { name: c.rotulo })).toHaveAttribute("aria-current", "true");
      await expect(page.getByRole("heading", { level: 2, name: c.rotulo })).toBeVisible();

      const doTema = ARTIGOS.filter((a) => a.categoria === c.id);
      if (doTema.length === 0) {
        await expect(page.getByText("Ainda não há artigos neste tema.")).toBeVisible();
        await page.getByRole("link", { name: "Ver todos os artigos" }).click();
        await expect(page).toHaveURL("/aprender");
        await expect(page.getByRole("heading", { level: 2, name: "Artigos recentes" })).toBeVisible();
      } else {
        const cards = page.getByRole("article");
        await expect(cards).toHaveCount(Math.min(doTema.length, 6));
        for (const card of await cards.all()) await expect(card).toContainText(caixaAlta(rotuloDaCategoria(c.id)));
        await expect(page.getByText("Ainda não há artigos")).toHaveCount(0);
      }
    });
  }

  test("'Ver todos' mostra a lista inteira e 'Ver menos' volta às seis primeiras", async ({ page }) => {
    test.skip(ARTIGOS.length <= 6, "com seis artigos ou menos não há o que expandir");
    await page.goto("/aprender");
    const grade = page.getByRole("article");
    await expect(grade).toHaveCount(6);
    await page.getByRole("link", { name: `Ver todos os ${ARTIGOS.length} artigos` }).click();
    await expect(page).toHaveURL("/aprender?todos=1");
    await expect(grade).toHaveCount(ARTIGOS.length);
    await page.getByRole("link", { name: "Ver menos" }).click();
    await expect(grade).toHaveCount(6);
  });

  test("clicar num card abre o artigo certo", async ({ page }) => {
    await page.goto("/aprender?tema=acoes-e-fiis");
    const card = page.getByRole("article").filter({ hasText: ARTIGO.titulo });
    await card.getByRole("link", { name: ARTIGO.titulo }).click();
    await expect(page).toHaveURL(`/aprender/${ARTIGO.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: ARTIGO.titulo })).toBeVisible();
  });

  test("a etiqueta de 'Ações e FIIs' mantém a sigla: FIIs, e não FIIS", async ({ page }) => {
    await page.goto("/aprender?tema=acoes-e-fiis");
    await expect(page.getByRole("article").first()).toContainText("AÇÕES E FIIs");
    // exact: true também diferencia maiúscula de minúscula; sem ele "FIIs" casaria com "FIIS".
    await expect(page.getByText("AÇÕES E FIIS", { exact: true })).toHaveCount(0);
  });

  test("tema inventado na URL cai em todos os artigos, sem erro", async ({ page }) => {
    const semErros = falharEmErroNoConsole(page);
    await page.goto("/aprender?tema=inexistente");
    await expect(page.getByRole("link", { name: `Todos (${ARTIGOS.length})` })).toHaveAttribute("aria-current", "true");
    semErros();
  });

  test("os atalhos de consulta rápida levam às três páginas", async ({ page }) => {
    await page.goto("/aprender");
    const consulta = page.getByRole("region", { name: "Consulta rápida" });
    await expect(consulta.getByRole("link", { name: /Glossário/ })).toHaveAttribute("href", "/aprender/glossario");
    await expect(consulta.getByRole("link", { name: /Indicadores explicados/ })).toHaveAttribute("href", "/aprender/indicadores");
    await expect(consulta.getByRole("link", { name: /Como o site calcula/ })).toHaveAttribute("href", "/aprender/como-calculamos");
  });
});

test.describe("artigo", () => {
  test("no desktop: índice lateral leva à seção, marca a atual e o 'Voltar ao topo' volta", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/aprender/${ARTIGO.slug}`);

    const indice = page.getByRole("navigation", { name: "Neste artigo" }).and(page.locator(":visible"));
    for (const t of ARTIGO.indice) await expect(indice.getByRole("link", { name: t.texto })).toBeVisible();

    const segundo = ARTIGO.indice[1];
    if (!segundo) throw new Error("o artigo de base precisa de ao menos duas seções");
    await indice.getByRole("link", { name: segundo.texto }).click();
    await expect(page).toHaveURL(new RegExp(`#${segundo.id}$`));
    await expect(page.getByRole("heading", { level: 2, name: segundo.texto })).toBeInViewport();
    await expect(indice.getByRole("link", { name: segundo.texto })).toHaveAttribute("aria-current", "true");

    await indice.getByRole("link", { name: /Voltar ao topo/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: ARTIGO.titulo })).toBeInViewport();
  });

  test("no desktop: as anotações ficam na margem, à direita do texto, sem se sobrepor", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/aprender/${ARTIGO.slug}`);

    const notas = page.getByRole("complementary", { name: "Anotação na margem" });
    const total = await notas.count();
    expect(total).toBeGreaterThanOrEqual(1);

    const coluna = await page.getByRole("heading", { level: 1 }).boundingBox();
    const caixas = [];
    for (let i = 0; i < total; i++) {
      const nota = notas.nth(i);
      await expect(nota).toBeVisible();
      const c = await nota.boundingBox();
      if (!c || !coluna) throw new Error("sem caixa");
      expect(c.x, "nota à direita da coluna de leitura").toBeGreaterThan(coluna.x + coluna.width - 1);
      expect(c.x + c.width, "nota dentro da tela").toBeLessThanOrEqual(DESKTOP.width);
      caixas.push(c);
    }
    caixas.sort((a, b) => a.y - b.y);
    for (let i = 1; i < caixas.length; i++) {
      const anterior = caixas[i - 1]!;
      expect(caixas[i]!.y, `a nota ${i + 1} começa depois do fim da nota ${i}`).toBeGreaterThanOrEqual(anterior.y + anterior.height);
    }
  });

  test("em todos os artigos, as notas de margem não se sobrepõem nem saem da tela", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    for (const a of ARTIGOS) {
      await page.goto(`/aprender/${a.slug}`);
      const caixas = [];
      for (const nota of await page.getByRole("complementary", { name: "Anotação na margem" }).all()) {
        const c = await nota.boundingBox();
        if (!c) throw new Error(`${a.slug}: nota sem caixa`);
        expect(c.x + c.width, `${a.slug}: nota fora da tela`).toBeLessThanOrEqual(DESKTOP.width);
        caixas.push(c);
      }
      caixas.sort((x, y) => x.y - y.y);
      for (let i = 1; i < caixas.length; i++) {
        const anterior = caixas[i - 1]!;
        expect(caixas[i]!.y, `${a.slug}: a nota ${i + 1} encosta na nota ${i}`).toBeGreaterThanOrEqual(anterior.y + anterior.height);
      }
    }
  });

  test("nenhum artigo rola para o lado no celular (375), nem com tabela", async ({ page }) => {
    await page.setViewportSize(CELULAR);
    for (const a of ARTIGOS) {
      await page.goto(`/aprender/${a.slug}`);
      const { rolagem, largura } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, largura: window.innerWidth }));
      expect(rolagem, a.slug).toBeLessThanOrEqual(largura);
    }
  });

  test("no celular (375): as anotações viram notas em linha, o índice vira bloco recolhível", async ({ page }) => {
    await page.setViewportSize(CELULAR);
    await page.goto(`/aprender/${ARTIGO.slug}`);

    const notas = page.getByRole("complementary", { name: "Anotação na margem" });
    for (const nota of await notas.all()) {
      await nota.scrollIntoViewIfNeeded();
      const c = await nota.boundingBox();
      expect(c && c.x >= 0 && c.x + c.width <= CELULAR.width, "nota dentro da tela").toBe(true);
      // em linha: ocupa a largura da coluna de leitura, e não os 220 px da margem
      expect(c!.width).toBeGreaterThan(250);
    }

    const bloco = page.locator("details", { hasText: "Neste artigo" });
    await expect(bloco).toBeVisible();
    await expect(bloco).not.toHaveAttribute("open", "");
    await bloco.getByText("Neste artigo").first().click();
    for (const t of ARTIGO.indice) await expect(bloco.getByRole("link", { name: t.texto })).toBeVisible();
    // a versão do desktop não aparece nem é lida no celular
    await expect(page.getByRole("navigation", { name: "Neste artigo" })).toHaveCount(1);
  });

  test("tem a caixa 'Em resumo', os números do exemplo e o 'Veja no site'", async ({ page }) => {
    await page.goto(`/aprender/${ARTIGO.slug}`);
    const resumo = page.getByRole("region", { name: "Em resumo" });
    await expect(resumo.getByRole("listitem")).toHaveCount(3);

    await expect(page.getByRole("group", { name: "Cálculo do P/L" })).toContainText("9,02");
    await expect(page.getByRole("group", { name: "Cálculo do P/VP" })).toContainText("1,83");
    await expect(page.getByRole("note")).toHaveCount(2);

    const veja = page.getByRole("region", { name: "Veja no site" });
    await expect(veja.getByRole("link", { name: /ficha da VALE3/ })).toHaveAttribute("href", "/ativos/acoes/VALE3");
    await expect(veja.getByRole("link", { name: /Indicadores explicados/ })).toHaveAttribute("href", "/aprender/indicadores");
  });

  test("tabela de markdown vira tabela de verdade, com cabeçalho", async ({ page }) => {
    await page.goto("/aprender/imposto-na-renda-fixa");
    const tabela = page.getByRole("table");
    await expect(tabela.getByRole("columnheader", { name: "Prazo da aplicação" })).toBeVisible();
    await expect(tabela.getByRole("row", { name: /Acima de 720 dias 15%/ })).toBeVisible();
    await expect(page.getByText("| Prazo")).toHaveCount(0);
  });

  test("mostra de onde vêm os números e o aviso de que não é recomendação", async ({ page }) => {
    await page.goto(`/aprender/${ARTIGO.slug}`);
    await expect(page.getByText(/Conteúdo educacional, não é recomendação de investimento/)).toBeVisible();
    await expect(page.getByRole("link", { name: /HG Brasil/ })).toHaveAttribute("href", /^https:\/\//);
  });

  test("a categoria do artigo leva ao filtro do tema", async ({ page }) => {
    await page.goto(`/aprender/${ARTIGO.slug}`);
    await migalhas(page).getByRole("link", { name: rotuloDaCategoria(ARTIGO.categoria) }).click();
    await expect(page).toHaveURL(`/aprender?tema=${ARTIGO.categoria}`);
  });

  const comRelacionados = ARTIGOS.find((a) => a.relacionados.length > 0);
  test("'Continue lendo' leva aos artigos relacionados", async ({ page }) => {
    test.skip(!comRelacionados, "nenhum artigo publicado declara relacionados ainda");
    if (!comRelacionados) return;
    await page.goto(`/aprender/${comRelacionados.slug}`);
    const secao = page.getByRole("region", { name: "Continue lendo" });
    await expect(secao.getByRole("article")).toHaveCount(Math.min(3, comRelacionados.relacionados.length));
    await secao.getByRole("article").first().getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/aprender/(${comRelacionados.relacionados.join("|")})$`));
  });

  test("slug que não existe: página de não encontrado, com saída", async ({ page }) => {
    const resposta = await page.goto("/aprender/artigo-que-nao-existe");
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Não encontramos esse artigo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver os artigos" })).toHaveAttribute("href", "/aprender");
    await expect(cabecalho(page)).toBeVisible();
  });
});

test.describe("glossário", () => {
  test("a busca filtra enquanto digita e limpa com um clique", async ({ page }) => {
    await page.goto("/aprender/glossario");
    const campo = page.getByRole("searchbox", { name: "Buscar um termo" });
    const termos = page.getByRole("term");
    const total = await termos.count();
    expect(total).toBeGreaterThan(30);

    await campo.fill("data-ex");
    await expect(page.getByRole("term").filter({ hasText: "Data-ex" })).toBeVisible();
    expect(await termos.count()).toBeLessThan(total);

    // sem acento e sem diferença de maiúscula: "acao" acha "Ação"
    await campo.fill("ACAO");
    await expect(page.getByRole("term").filter({ hasText: /^Ação$/ })).toBeVisible();

    await campo.fill("zzzz");
    await expect(page.getByText(/Nenhum termo encontrado para “zzzz”/)).toBeVisible();
    await page.getByRole("button", { name: "Limpar a busca" }).click();
    await expect(campo).toHaveValue("");
    await expect(termos).toHaveCount(total);
  });

  test("a navegação A–Z leva à letra, e letra sem resultado fica desativada na busca", async ({ page }) => {
    await page.goto("/aprender/glossario");
    const nav = page.getByRole("navigation", { name: "Ir para a letra" });
    await nav.getByRole("link", { name: "Letra P" }).click();
    await expect(page).toHaveURL(/#letra-p$/);
    await expect(page.getByRole("heading", { level: 2, name: "P", exact: true })).toBeInViewport();

    await page.getByRole("searchbox", { name: "Buscar um termo" }).fill("Selic");
    await expect(nav.getByText("Letra A, sem resultados")).toBeVisible();
    await expect(nav.getByRole("link", { name: "Letra S" })).toBeVisible();
  });

  test("/aprender/glossario#data-ex rola até o verbete", async ({ page }) => {
    await page.goto("/aprender/glossario#data-ex");
    const verbete = page.locator("#data-ex");
    await expect(verbete).toBeInViewport();
    await expect(verbete.getByRole("term")).toHaveText("Data-ex");
  });

  test("funciona só com o teclado: Tab chega à busca, depois às letras e aos links", async ({ page }) => {
    await page.goto("/aprender/glossario");
    await page.getByRole("searchbox", { name: "Buscar um termo" }).focus();
    await page.keyboard.type("cdi");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("navigation", { name: "Ir para a letra" }).getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#letra-/);
  });

  test("o link 'Ler o artigo' só aparece para artigo publicado", async ({ page }) => {
    await page.goto("/aprender/glossario");
    const publicados = new Set(ARTIGOS.map((a) => a.slug));
    const links = await page.locator("main").getByRole("link", { name: /^Ler o artigo/ }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) expect(publicados.has(href!.replace("/aprender/", "")), `${href} aponta para artigo que não existe`).toBe(true);
  });
});

test.describe("indicadores explicados", () => {
  for (const ancora of ["pl", "pvp", "dy", "roe", "roa", "margem", "divida", "vacancia", "fii", "como-ler-um-ativo"]) {
    test(`#${ancora} existe e a página rola até ela`, async ({ page }) => {
      await page.goto(`/aprender/indicadores#${ancora}`);
      const alvo = page.locator(`#${ancora}`);
      await expect(alvo).toHaveCount(1);
      await expect(alvo).toBeInViewport();
    });
  }

  test("cada indicador mostra fórmula, como ler, armadilha e o valor no exemplo", async ({ page }) => {
    await page.goto("/aprender/indicadores#pl");
    const pl = page.getByRole("region", { name: "Preço/lucro (P/L)" });
    await expect(pl).toContainText("Preço ÷ Lucro por ação");
    await expect(pl).toContainText("Como ler");
    await expect(pl.getByRole("note")).toBeVisible();
    await expect(pl).toContainText("9,02");
    await expect(page.getByRole("region", { name: "Dividend yield (DY)" })).toContainText("7,02% (R$ 3,01 em 4 pagamentos)");
  });

  test("os exemplos hipotéticos dizem que são hipotéticos", async ({ page }) => {
    await page.goto("/aprender/indicadores#vacancia");
    const vacancia = page.getByRole("region", { name: "Vacância (FII de tijolo)" });
    await expect(vacancia).toContainText("Exemplo hipotético:");
    await expect(vacancia).toContainText("7,5%");
    await expect(page.getByRole("region", { name: "Preço/lucro (P/L)" })).toContainText("No exemplo (TAEE11):");
  });

  test("o link 'Saiba mais' da ficha de um ativo chega no indicador certo", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");
    await page.getByRole("link", { name: "Saiba mais sobre Preço/lucro (P/L)" }).click();
    await expect(page).toHaveURL(/\/aprender\/indicadores#pl$/);
    await expect(page.locator("#pl")).toBeInViewport();
    await expect(page.getByRole("region", { name: "Preço/lucro (P/L)" })).toBeVisible();
  });

  test("a lista 'Neste guia' leva a cada indicador", async ({ page }) => {
    await page.goto("/aprender/indicadores");
    await page.getByRole("navigation", { name: "Neste guia" }).getByRole("link", { name: "ROE" }).click();
    await expect(page).toHaveURL(/#roe$/);
    await expect(page.locator("#roe")).toBeInViewport();
  });
});

test.describe("como o site calcula", () => {
  test("os números dos exemplos são os que o código calcula", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/aprender/como-calculamos");

    const pm = page.getByRole("table", { name: /preço médio/i });
    await expect(pm.getByRole("row", { name: /Compra 10 R\$ 30,00 R\$ 2,00 R\$ 25,20 20/ })).toBeVisible();
    await expect(pm.getByRole("row", { name: /Venda 5 — — R\$ 25,20 15/ })).toBeVisible();
    await expect(page.getByText("(R$ 202,00 + R$ 302,00) ÷ 20 = R$ 25,20")).toBeVisible();

    await expect(page.getByRole("group", { name: /dividend yield da TAEE11/ })).toContainText("7,02%");

    const aporte = page.getByRole("table", { name: /aporte de R\$ 200,00/ });
    await expect(aporte.getByRole("row", { name: /MXRF11 60% R\$ 120,00 R\$ 10,85 11 R\$ 119,35/ })).toBeVisible();
    await expect(aporte.getByRole("row", { name: /BOVA11 40% R\$ 80,00 R\$ 110,00 0 —/ })).toBeVisible();
    // brl() separa "R$" do número com um espaço não separável: \s casa os dois.
    await expect(page.getByText(/Sobram R\$\s80,65/)).toBeVisible();
  });

  test("mostra a fonte e a data dos dados públicos", async ({ page }) => {
    await page.goto("/aprender/como-calculamos#juro-real");
    const juro = page.getByRole("region", { name: "Juro real" });
    await expect(juro).toContainText("8,77% de juro real");
    await expect(juro).toContainText("SGS 432");
    await expect(juro).toContainText("SGS 13522");
    await expect(juro).toContainText(/conferida em \d{2}\/\d{2}\/\d{4}/);
    await expect(juro).toBeInViewport();
  });

  test("no celular as tabelas viram listas empilhadas, sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize(CELULAR);
    await page.goto("/aprender/como-calculamos");
    await expect(page.getByRole("table")).toHaveCount(0);
    const lista = page.getByRole("list", { name: /preço médio/i });
    await expect(lista.getByRole("listitem")).toHaveCount(3);
    await expect(lista.getByRole("listitem").nth(1)).toContainText("R$ 25,20");
    const { rolagem, largura } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, largura: window.innerWidth }));
    expect(rolagem).toBeLessThanOrEqual(largura);
  });

  test("no celular, 'O que o site não faz' vem depois das contas; no desktop fica na lateral", async ({ page }) => {
    const topo = async (nome: string) => (await page.getByRole("heading", { name: nome }).boundingBox())!.y;

    await page.setViewportSize(CELULAR);
    await page.goto("/aprender/como-calculamos");
    expect(await topo("O que o site não faz")).toBeGreaterThan(await topo("Juro real"));

    await page.setViewportSize(DESKTOP);
    await page.goto("/aprender/como-calculamos");
    const lateral = await page.getByRole("heading", { name: "O que o site não faz" }).boundingBox();
    const conteudo = await page.getByRole("heading", { name: "Preço médio" }).boundingBox();
    expect(lateral!.x).toBeGreaterThan(conteudo!.x + conteudo!.width);
  });
});

test.describe("indicadores: ordem no celular e na lateral", () => {
  test("no desktop, a nota das faixas fica logo abaixo de 'Neste guia', e não no meio da página", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/aprender/indicadores");
    const guia = await page.getByRole("navigation", { name: "Neste guia" }).boundingBox();
    const faixas = await page.getByText("Faixas são referências, não regras").boundingBox();
    expect(faixas!.y - (guia!.y + guia!.height)).toBeLessThan(80);
  });

  test("a nota das faixas vem depois dos indicadores", async ({ page }) => {
    await page.setViewportSize(CELULAR);
    await page.goto("/aprender/indicadores");
    const faixas = await page.getByText("Faixas são referências, não regras").boundingBox();
    const ultimo = await page.getByRole("region", { name: "Dívida líquida/EBITDA" }).boundingBox();
    expect(faixas!.y).toBeGreaterThan(ultimo!.y);
  });
});
