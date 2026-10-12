import { expect, test } from "@playwright/test";

// Páginas de ativos: de onde vêm os dados e o que a tela faz quando uma fonte não responde.
// Roda contra a API de mentira (e2e/ativos/stub-api.mjs), que tem tickers reservados para cada
// estado: B3SA3 e HGBS11 sem preço; ABEV3 e XPLG11 sem leitura da CVM; RENT3 com histórico defasado;
// WEGE3 e KNCR11 sem notícia nem provento; SUZB3 com a ficha fora do ar.

test.describe.configure({ timeout: 60_000 });

const API_DE_MENTIRA = "http://localhost:3399";

test.describe("de onde vêm os dados", () => {
  test("nenhuma tela fala em dados de exemplo, e as fichas dizem a fonte e a data de leitura", async ({ page }) => {
    for (const rota of ["/ativos/acoes", "/ativos/fiis", "/ativos/acoes/VALE3", "/ativos/fiis/MXRF11"]) {
      await page.goto(rota);
      await expect(page.locator("body"), rota).not.toContainText(/de exemplo/i);
    }

    await page.goto("/ativos/acoes/VALE3");
    await expect(page.getByRole("region", { name: "Resultados trimestrais" })).toContainText("Fonte: CVM (dados abertos), lido em 12/10/2026.");
    await expect(page.getByRole("region", { name: "Proventos recentes" })).toContainText("Fonte: Yahoo Finance, lido em 12/10/2026.");
  });

  test("os resultados trimestrais saem em bilhões, a partir dos reais da CVM", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");
    const linha = page.getByRole("region", { name: "Resultados trimestrais" }).getByRole("row", { name: /1T26/ });

    await expect(linha).toContainText("8,00");
    await expect(linha).toContainText("188,10");
  });

  test("a ação mostra as notícias com link para o portal de origem, abrindo em outra aba", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");
    const link = page.getByRole("link", { name: "VALE3 sobe com a alta do minério de ferro" });

    await expect(link).toHaveAttribute("href", "https://exemplo.invalid/vale3-sobe");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(page.getByText("InfoMoney · 09/10/2026")).toBeVisible();
  });

  test("a composição do FII diz de qual mês é o informe, e a de fundo de fundos é lida como tal", async ({ page }) => {
    await page.goto("/ativos/fiis/KFOF11");
    const bloco = page.getByRole("region", { name: "Composição da carteira do fundo" });

    await expect(bloco).toContainText("no informe mensal de ago/2026");
    await expect(bloco.getByText("78,6%")).toBeVisible();
    await expect(bloco.getByText("Este é um fundo de fundos")).toBeVisible();
  });
});

test.describe("quando uma fonte não responde", () => {
  test("sem preço: a ficha avisa no cabeçalho e no bloco de indicadores, e a listagem mostra traço", async ({ page }) => {
    await page.goto("/ativos/acoes/B3SA3");

    await expect(page.getByRole("heading", { level: 1, name: "B3SA3" })).toBeVisible();
    await expect(page.getByText("O Yahoo Finance não informou o preço agora.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Indicadores" }).getByRole("alert")).toContainText("Não foi possível carregar este bloco agora.");
    // o resto da ficha continua de pé
    await expect(page.getByRole("region", { name: "Resultados trimestrais" }).getByRole("row", { name: /1T26/ })).toBeVisible();

    await page.goto("/ativos/acoes");
    await page.getByRole("button", { name: /Ver todas as 15/ }).click();
    const linha = page.getByRole("row", { name: /B3SA3/ });
    await expect(linha).toContainText("—");
    await expect(linha).not.toContainText("R$");
  });

  test("CVM sem leitura: só o bloco de resultados vira erro, o resto da ficha segue", async ({ page }) => {
    await page.goto("/ativos/acoes/ABEV3");

    await expect(page.getByRole("region", { name: "Resultados trimestrais" }).getByRole("alert")).toContainText("Não foi possível carregar este bloco agora.");
    await expect(page.getByRole("region", { name: "Indicadores" }).getByRole("heading", { level: 3, name: /^Valuation/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Preço de ABEV3/ })).toBeVisible();
  });

  test("histórico com a última tentativa falha: mostra o gráfico e avisa que pode estar defasado", async ({ page }) => {
    await page.goto("/ativos/acoes/RENT3");
    const bloco = page.getByRole("region", { name: "Preço mês a mês" });

    await expect(bloco.getByRole("img", { name: /Preço de RENT3/ })).toBeVisible();
    await expect(bloco).toContainText("lido em 05/10/2026");
    await expect(bloco).toContainText("A fonte não respondeu na última tentativa");
  });

  test("sem notícia nem provento: diz que não há, e não que deu erro", async ({ page }) => {
    await page.goto("/ativos/acoes/WEGE3");

    await expect(page.getByText("Nenhuma notícia recente cita WEGE3.")).toBeVisible();
    await expect(page.getByText("Nenhum provento nos últimos 12 meses.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Notícias sobre WEGE3" }).getByRole("alert")).toHaveCount(0);
  });

  test("FII sem informe da CVM: patrimônio, cotistas, taxa e gestão viram traço, e a composição avisa", async ({ page }) => {
    await page.goto("/ativos/fiis/XPLG11");
    const indicadores = page.getByRole("region", { name: "Indicadores" });

    for (const nome of ["Patrimônio líquido", "Número de cotistas", "Taxa de administração", "Tipo de gestão"]) {
      await expect(indicadores.getByRole("listitem").filter({ hasText: nome }).locator("strong")).toHaveText("—");
    }
    await expect(page.getByRole("region", { name: "Composição da carteira do fundo" }).getByRole("alert")).toBeVisible();
    // preço e proventos, que vêm de outra fonte, continuam
    await expect(page.getByRole("img", { name: /Preço de XPLG11/ })).toBeVisible();
  });

  test("FII sem preço: mostra o aviso no cabeçalho em vez de um número", async ({ page }) => {
    await page.goto("/ativos/fiis/HGBS11");
    await expect(page.getByText("O Yahoo Finance não informou o preço agora.")).toBeVisible();
  });

  test("a API fora do ar para um ativo mostra a tela de erro com 'Tentar de novo', e o site segue de pé", async ({ page }) => {
    await page.goto("/ativos/acoes/SUZB3");

    await expect(page.getByText("Não conseguimos carregar esta página agora")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();

    // a listagem continua abrindo
    await page.goto("/ativos/acoes");
    await expect(page.getByRole("table").getByRole("link")).toHaveCount(5);
  });

  test("a API fora do ar para a listagem mostra o erro, e 'Tentar de novo' recupera quando ela volta", async ({ page, request }) => {
    await request.post(`${API_DE_MENTIRA}/__modo`, { data: { listas: "erro" } });
    try {
      await page.goto("/ativos/acoes");
      await expect(page.getByText("Não conseguimos carregar esta página agora")).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);

      await request.post(`${API_DE_MENTIRA}/__modo/reset`);
      await page.getByRole("button", { name: "Tentar de novo" }).click();
      await expect(page.getByRole("table").getByRole("link")).toHaveCount(5);
    } finally {
      await request.post(`${API_DE_MENTIRA}/__modo/reset`);
    }
  });
});
