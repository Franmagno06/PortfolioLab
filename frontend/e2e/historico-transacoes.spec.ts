import { expect, test, type Page } from "@playwright/test";

// Histórico de transações em /carteira, com a conta de demonstração (27
// transações, criada por `npm run db:local`). Não depende do Yahoo: a lista e o
// DELETE são do backend local, e a demo recusa a exclusão.

const MENSAGEM_DA_DEMO =
  "A conta de demonstração é só para olhar. Crie uma conta grátis para registrar as suas operações.";

async function entrarNaContaDemo(page: Page) {
  const resposta = await page.request.post("/api/auth/login", {
    data: { email: "carteira@portfoliolab.dev", password: "demo123456" },
  });
  expect(resposta.ok(), `login da conta demo: ${resposta.status()} ${await resposta.text()}`).toBeTruthy();
}

const historico = (page: Page) => page.getByRole("region", { name: "Histórico de transações" });

test.describe("histórico de transações", () => {
  test.beforeEach(async ({ page }) => {
    await entrarNaContaDemo(page);
  });

  test("lista 20 por página, carrega o resto e a demo recusa apagar com a mensagem do servidor", async ({ page }) => {
    await page.goto("/carteira");

    const secao = historico(page);
    await expect(secao.getByRole("heading", { name: "Histórico de transações" })).toBeVisible({ timeout: 15_000 });
    const linhas = secao.getByRole("listitem");
    await expect(linhas).toHaveCount(20);

    await secao.getByRole("button", { name: "Carregar mais" }).click();
    await expect(linhas).toHaveCount(27);
    await expect(secao.getByRole("button", { name: "Carregar mais" })).toHaveCount(0);

    const primeira = linhas.first();
    await primeira.getByRole("button", { name: /^Apagar/ }).click();
    await expect(primeira.getByText(/^Apagar esta (compra|venda) de/)).toBeVisible();
    await primeira.getByRole("button", { name: "Apagar", exact: true }).click();

    await expect(primeira.getByRole("alert")).toHaveText(MENSAGEM_DA_DEMO);
    await expect(linhas).toHaveCount(27);
  });

  test("Cancelar fecha a confirmação sem apagar nada", async ({ page }) => {
    await page.goto("/carteira");
    const linhas = historico(page).getByRole("listitem");
    await expect(linhas).toHaveCount(20, { timeout: 15_000 });

    await linhas.first().getByRole("button", { name: /^Apagar/ }).click();
    await expect(linhas.first().getByRole("button", { name: "Cancelar" })).toBeFocused();
    await linhas.first().getByRole("button", { name: "Cancelar" }).click();

    await expect(linhas.first().getByRole("button", { name: "Cancelar" })).toHaveCount(0);
    await expect(linhas.first().getByRole("button", { name: /^Apagar/ })).toBeFocused();
    await expect(linhas).toHaveCount(20);
  });
});

test.describe("histórico de transações no celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("não rola a página para o lado e os botões têm pelo menos 44px", async ({ page }) => {
    await entrarNaContaDemo(page);
    await page.goto("/carteira");
    const linhas = historico(page).getByRole("listitem");
    await expect(linhas).toHaveCount(20, { timeout: 15_000 });

    const largura = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.janela);

    const botao = await linhas.first().getByRole("button", { name: /^Apagar/ }).boundingBox();
    expect(botao?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
