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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("aporte do mês");
    const secoes = page.getByRole("navigation", { name: "Seções da página" });
    for (const nome of ["O que é", "Desafio do aporte", "Ferramentas", "Aprender"]) {
      await expect(secoes.getByRole("link", { name: nome })).toBeVisible();
    }
    semErros();
  });

  test("a área logada continua fechada para quem não tem sessão", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("desafio do aporte", () => {
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

  test("comparar mostra a sugestão do algoritmo real", async ({ page }) => {
    const semErros = falharEmErroDeJs(page);
    await mais(page, "MXRF11").click();
    await page.getByRole("button", { name: "Comparar com o PortfolioLab" }).click();

    const resultado = page.getByRole("region", { name: "Resultado da comparação" });
    await expect(resultado).toBeVisible();
    // a mesma resposta que rebalance.exemplo.test.ts confere no backend
    await expect(resultado).toContainText("16 cotas de TAEE11");
    await expect(resultado).toContainText("2 cotas de HGLG11");
    await expect(resultado).toContainText("1 cota de MXRF11");
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
});

// Depende da conta carteira@portfoliolab.dev, que `npm run db:local` cria.
test("explorar a demonstração entra no dashboard da conta demo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Explorar a demonstração" }).first().click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  // Prova de sessão, e não de dados: o "Sair" só existe na área logada. Esperar
  // o resumo da carteira faria o teste depender da cotação do Yahoo para 16
  // ativos — era o que o deixava instável em rodadas seguidas.
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});
