import { expect, test, type Page } from "@playwright/test";

// Site público da raiz: o que o visitante vê sem conta. Roda contra o app de
// verdade (backend + frontend, ver playwright.config.ts) — a sugestão do
// desafio vem do algoritmo real, em POST /rebalance/exemplo.

/** Erro de JavaScript na página derruba o teste, mesmo que a tela "pareça" certa. */
function falharEmErroDeJs(page: Page) {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  return () => expect(erros, "erros de JavaScript na página").toEqual([]);
}

const mais = (page: Page, ticker: string) =>
  page.getByRole("button", { name: `Comprar mais uma cota de ${ticker}` });
const menos = (page: Page, ticker: string) =>
  page.getByRole("button", { name: `Uma cota a menos de ${ticker}` });

test.describe("site público", () => {
  test("abre sem sessão e diz o que é o PortfolioLab", async ({ page }) => {
    const semErros = falharEmErroDeJs(page);
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Entenda o que você compra");

    const principal = page.getByRole("navigation", { name: "Principal" });
    for (const nome of ["Aprender", "Ativos", "Planejar"]) {
      await expect(principal.getByRole("button", { name: nome })).toBeVisible();
    }
    await expect(principal.getByRole("link", { name: "Notícias" })).toBeVisible();
    semErros();
  });

  test("o menu Aprender abre com o desafio, e Esc fecha devolvendo o foco", async ({ page }) => {
    await page.goto("/");
    const aprender = page.getByRole("navigation", { name: "Principal" }).getByRole("button", { name: "Aprender" });

    await aprender.click();
    await expect(aprender).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Fazer o desafio" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: "Fazer o desafio" })).toBeHidden();
    await expect(aprender).toHaveAttribute("aria-expanded", "false");
    await expect(aprender).toBeFocused();
  });

  test("a área logada continua fechada para quem não tem sessão", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("o topo leva aos artigos", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /Começar pelos artigos/ })).toHaveAttribute("href", "/aprender");

    // movimento contínuo precisa de pausa (WCAG 2.2.2): o rótulo alterna
    await page.getByRole("button", { name: "Pausar animação" }).click();
    await expect(page.getByRole("button", { name: "Retomar animação" })).toBeVisible();
  });

  test("abrir o P/L mostra a conta", async ({ page }) => {
    await page.goto("/");
    const secao = page.locator("#como-ler-um-ativo");
    await secao.scrollIntoViewIfNeeded();

    const linha = secao.getByRole("button", { name: /Preço\/lucro/ });
    await expect(linha).toHaveAttribute("aria-expanded", "false");
    await linha.click();
    await expect(linha).toHaveAttribute("aria-expanded", "true");
    await expect(secao.getByText("preço ÷ lucro por Unit = P/L")).toBeVisible();
    await expect(secao.getByText(/R\$\s45,87\s÷\sR\$\s4,75\s=\s9,66/)).toBeVisible();
  });

  test("comece por aqui mostra artigos reais", async ({ page }) => {
    await page.goto("/");
    const secao = page.locator("#comece-por-aqui");
    await secao.scrollIntoViewIfNeeded();

    const cartoes = secao.getByRole("article");
    await expect(cartoes).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(cartoes.nth(i).getByRole("link")).toHaveAttribute("href", /^\/aprender\/[a-z0-9-]+$/);
    }
    await expect(secao.getByRole("link", { name: "Ver todos os artigos" })).toHaveAttribute("href", "/aprender");
  });
});

test.describe("bento Ativos e índices", () => {
  test("os quadros levam às fichas e aos índices, e a explicação sobe no foco", async ({ page }) => {
    await page.goto("/");
    const bento = page.locator("#ativos-e-indices");
    await bento.scrollIntoViewIfNeeded();

    await expect(bento.getByRole("heading", { level: 2, name: "Ativos e índices" })).toBeVisible();
    await expect(bento.getByRole("link", { name: /^Ações/ })).toHaveAttribute("href", "/ativos/acoes");
    await expect(bento.getByRole("link", { name: /^FIIs/ })).toHaveAttribute("href", "/ativos/fiis");
    await expect(bento.getByRole("link", { name: /^ETFs/ })).toHaveAttribute("href", "/ativos/etfs");
    await expect(bento.getByRole("link", { name: /^Selic/ })).toHaveAttribute("href", "/ativos/indices/selic");
    await expect(bento.getByRole("link", { name: /Ibovespa/ })).toHaveAttribute("href", "/ativos/indices/ibovespa");

    // no desktop a frase fica escondida até o foco (ou o mouse) chegar ao quadro
    const selic = bento.getByRole("link", { name: /^Selic/ });
    await expect(selic.locator("[data-explicacao]")).toHaveCSS("opacity", "0");
    await selic.focus();
    await expect(selic.locator("[data-explicacao]")).toHaveCSS("opacity", "1");
  });
});

test.describe("desafio do aporte de novembro", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#desafio");
  });

  test("o + respeita o orçamento: não deixa comprar cota que a sobra não paga", async ({ page }) => {
    // 2 × R$ 455,12 = R$ 910,24; sobram R$ 89,76, menos que uma terceira cota
    await mais(page, "IVVB11").click();
    await mais(page, "IVVB11").click();

    await expect(page.getByText("R$ 89,76")).toBeVisible();
    await expect(mais(page, "IVVB11")).toBeDisabled();
    // ainda cabe o que é barato
    await expect(mais(page, "MXRF11")).toBeEnabled();
  });

  test("comparar mostra a sugestão do algoritmo real para novembro", async ({ page }) => {
    const semErros = falharEmErroDeJs(page);
    await mais(page, "MXRF11").click();
    await page.getByRole("button", { name: "Comparar com o PortfolioLab" }).click();

    const resultado = page.getByRole("region", { name: "Resultado da comparação" });
    await expect(resultado).toBeVisible();
    // o IVVB11 que ficou para depois em outubro entra agora
    await expect(resultado).toContainText("1 cota de IVVB11");
    await expect(resultado).toContainText("2 cotas de HGLG11");
    await expect(resultado).toContainText("5 cotas de TAEE11");
    await expect(resultado).toContainText("1 cota de MXRF11");
    // e quem ficou de fora vem explicado, nas palavras do backend
    await expect(resultado).toContainText("BOVA11 ficou de fora");
    semErros();
  });

  test("mexer na compra depois de comparar descarta o resultado antigo", async ({ page }) => {
    await mais(page, "MXRF11").click();
    await page.getByRole("button", { name: "Comparar com o PortfolioLab" }).click();
    const resultado = page.getByRole("region", { name: "Resultado da comparação" });
    await expect(resultado).toBeVisible();

    await menos(page, "MXRF11").click();

    await expect(resultado).toBeHidden();
  });

  test("recomeçar zera a compra", async ({ page }) => {
    const cotas = page.getByRole("status", { name: "Cotas de HGLG11 na sua compra" });
    await mais(page, "HGLG11").click();
    await expect(cotas).toHaveText("1");

    await page.getByRole("button", { name: "Recomeçar" }).click();

    await expect(cotas).toHaveText("0");
    await expect(menos(page, "HGLG11")).toBeDisabled();
  });
});

test.describe("no celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a página não rola para o lado", async ({ page }) => {
    await page.goto("/");
    const largura = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.janela);
  });

  test("o bento a 390px não rola para o lado e mostra a explicação sem hover", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bento = page.locator("#ativos-e-indices");
    await bento.scrollIntoViewIfNeeded();

    const medidas = await bento.evaluate((el) => ({ scroll: el.scrollWidth, cliente: el.clientWidth }));
    expect(medidas.scroll).toBeLessThanOrEqual(medidas.cliente);

    // celular não tem hover: a frase de cada quadro precisa estar à vista de partida
    const explicacoes = bento.locator("[data-explicacao]");
    await expect(explicacoes).toHaveCount(8);
    for (let i = 0; i < 8; i++) {
      await explicacoes.nth(i).scrollIntoViewIfNeeded();
      await expect(explicacoes.nth(i)).toHaveCSS("opacity", "1");
    }
  });

  test("o menu abre a gaveta, a página atrás não rola e Esc fecha", async ({ page }) => {
    await page.goto("/");
    const abrir = page.getByRole("button", { name: "Abrir menu" });

    await abrir.click();
    const gaveta = page.getByRole("dialog", { name: "Menu do site" });
    await expect(gaveta).toBeVisible();
    await expect(gaveta.getByRole("button", { name: "Aprender" })).toBeVisible();
    // com a gaveta aberta, a página de trás fica travada
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(gaveta).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(abrir).toBeFocused();
  });
});

// Depende da conta carteira@portfoliolab.dev, que `npm run db:local` cria.
test("sair leva à página inicial", async ({ page }) => {
  const resposta = await page.request.post("/api/auth/login", {
    data: { email: "carteira@portfoliolab.dev", password: "demo123456" },
  });
  expect(resposta.ok(), `login da conta demo: ${resposta.status()}`).toBeTruthy();

  await page.goto("/dashboard");
  await page.getByRole("banner").getByRole("button", { name: "Sair" }).click();

  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toBe("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Entenda o que você compra");
});

test("ver a demonstração entra no dashboard da conta demo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Ver a demonstração" }).first().click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  // Prova de sessão, e não de dados: o "Sair" só existe na área logada. Esperar
  // o resumo da carteira faria o teste depender da cotação do Yahoo para 16
  // ativos — era o que o deixava instável em rodadas seguidas.
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});
