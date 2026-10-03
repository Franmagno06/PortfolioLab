import { expect, test, type Page } from "@playwright/test";

// Área logada dentro do site: o mesmo cabeçalho da página inicial (com
// "Sair") e as abas da carteira logo abaixo, no lugar do antigo menu lateral.
// Depende da conta carteira@portfoliolab.dev, que `npm run db:local` cria.

/** Login pela API: mais rápido que preencher o formulário, e o cookie fica no contexto. */
async function entrarNaContaDemo(page: Page) {
  const resposta = await page.request.post("/api/auth/login", {
    data: { email: "carteira@portfoliolab.dev", password: "demo123456" },
  });
  expect(resposta.ok(), `login da conta demo: ${resposta.status()} ${await resposta.text()}`).toBeTruthy();
}

const abas = (page: Page) => page.getByRole("navigation", { name: "Minha carteira" });

test.describe("área logada", () => {
  test.beforeEach(async ({ page }) => {
    await entrarNaContaDemo(page);
  });

  test("tem o cabeçalho do site com Sair e as seis abas da carteira", async ({ page }) => {
    await page.goto("/dashboard");

    const cabecalho = page.getByRole("banner");
    await expect(cabecalho.getByRole("button", { name: "Sair" })).toBeVisible();
    await expect(cabecalho.getByRole("link", { name: "Entrar" })).toHaveCount(0);

    for (const nome of ["Resumo", "Posições", "Simular aporte", "Relatórios com IA", "Indicadores", "Notícias"]) {
      await expect(abas(page).getByRole("link", { name: nome })).toBeVisible();
    }
    await expect(abas(page).getByRole("link", { name: "Resumo" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Resumo" })).toBeVisible();
  });

  test("trocar de aba abre a página e marca a aba atual", async ({ page }) => {
    await page.goto("/dashboard");

    await abas(page).getByRole("link", { name: "Simular aporte" }).click();

    await expect(page).toHaveURL(/\/simulacao$/);
    await expect(page.getByRole("heading", { level: 1, name: "Simulação de aportes" })).toBeVisible();
    await expect(abas(page).getByRole("link", { name: "Simular aporte" })).toHaveAttribute("aria-current", "page");
    await expect(abas(page).getByRole("link", { name: "Resumo" })).not.toHaveAttribute("aria-current", "page");
  });

  test("o menu Planejar do cabeçalho leva à simulação", async ({ page }) => {
    await page.goto("/carteira");
    const principal = page.getByRole("navigation", { name: "Principal" });

    await principal.getByRole("button", { name: "Planejar" }).click();
    await page.getByRole("link", { name: /Simular o aporte do mês/ }).click();

    await expect(page).toHaveURL(/\/simulacao$/);
    await expect(abas(page).getByRole("link", { name: "Simular aporte" })).toHaveAttribute("aria-current", "page");
  });

  test("Sair encerra a sessão e fecha a área logada", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("banner").getByRole("button", { name: "Sair" }).click();

    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("área logada no celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await entrarNaContaDemo(page);
  });

  test("as abas rolam para o lado sem empurrar a página", async ({ page }) => {
    await page.goto("/noticias");

    const largura = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.janela);
    // a aba da página atual entra na tela sozinha, mesmo sendo a última
    await expect(abas(page).getByRole("link", { name: "Notícias" })).toBeInViewport();
  });

  test("a gaveta do cabeçalho termina em Sair", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Abrir menu" }).click();

    const gaveta = page.getByRole("dialog", { name: "Menu do site" });
    await expect(gaveta.getByRole("button", { name: "Sair" })).toBeVisible();
    await expect(gaveta.getByRole("link", { name: "Entrar" })).toHaveCount(0);
  });
});
