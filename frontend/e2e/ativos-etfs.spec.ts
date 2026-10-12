import { expect, test } from "@playwright/test";

// Páginas de ETFs e a explicação "O que é" das três classes de ativo. Rodam contra a API de mentira
// (e2e/ativos/stub-api.mjs). IVVB11 vem sem o patrimônio da CVM, e FIXA11 sem 12 meses de histórico.

test.describe.configure({ timeout: 60_000 });

const dica = (page: import("@playwright/test").Page, nome: string) => page.getByRole("button", { name: `O que é ${nome}?` });

test.describe("listagem de ETFs", () => {
  test("mostra 5, expande para 10 e volta para 5, com categoria e índice", async ({ page }) => {
    await page.goto("/ativos/etfs");

    const linhas = page.getByRole("table").getByRole("link");
    await expect(page.getByRole("heading", { level: 1, name: "ETFs" })).toBeVisible();
    await expect(linhas).toHaveCount(5);
    await expect(page.getByText("Mostrando 5 de 10 ETFs do catálogo.")).toBeVisible();
    await expect(page.getByRole("row", { name: /BOVA11/ })).toContainText("Ações do Brasil");
    await expect(page.getByRole("row", { name: /BOVA11/ })).toContainText("Ibovespa");

    await page.getByRole("button", { name: /Ver todas as 10/ }).click();
    await expect(linhas).toHaveCount(10);
    await expect(page.getByRole("link", { name: /HASH11/ })).toBeVisible();

    await page.getByRole("button", { name: "Mostrar só as 5" }).click();
    await expect(linhas).toHaveCount(5);
  });

  test("ETF não usa logo: mostra o ícone de ETF, e a linha abre a ficha", async ({ page }) => {
    await page.goto("/ativos/etfs");

    await expect(page.locator('img[src^="/logos/"]')).toHaveCount(0);
    await expect(page.getByRole("table").locator("[data-icone-de-etf]")).toHaveCount(5);

    await page.getByRole("link", { name: /BOVA11/ }).click();
    await expect(page).toHaveURL("/ativos/etfs/BOVA11");
  });

  test("as colunas têm o '?', e a variação ausente vira traço", async ({ page }) => {
    await page.goto("/ativos/etfs");
    for (const nome of ["Categoria do ETF", "Índice acompanhado", "Variação em 12 meses", "DY 12m"]) {
      await expect(dica(page, nome).first()).toBeVisible();
    }

    await page.getByRole("button", { name: /Ver todas as 10/ }).click();
    await expect(page.getByRole("row", { name: /FIXA11/ })).toContainText("—");
  });

  test("sem rolagem lateral em 1440, 768 e 375 px", async ({ page }) => {
    for (const largura of [1440, 768, 375]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/ativos/etfs");
      await page.getByRole("button", { name: /Ver todas as 10/ }).click();
      const cabe = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(cabe, `rolagem lateral em ${largura}px`).toBe(true);
    }
  });
});

test.describe("ficha do ETF", () => {
  test("mostra o cabeçalho, a explicação, o gráfico, os indicadores e o patrimônio da CVM", async ({ page }) => {
    await page.goto("/ativos/etfs/BOVA11");

    await expect(page.getByRole("heading", { level: 1, name: "BOVA11" })).toBeVisible();
    await expect(page.getByText("Índice: Ibovespa")).toBeVisible();
    await expect(page.getByRole("img", { name: /Preço de BOVA11 no fechamento de cada mês/ })).toBeVisible();
    for (const nome of ["Variação em 12 meses", "Dividend Yield (12 meses)", "Patrimônio líquido"]) {
      await expect(dica(page, nome)).toBeVisible();
    }
    const indicadores = page.getByRole("region", { name: "Indicadores" });
    await expect(indicadores).toContainText("40,4%");
    await expect(indicadores).toContainText("R$ 17,7 bi");
    await expect(indicadores).toContainText("cadastro de classes da CVM (patrimônio, de 05/10/2026)");
    await expect(page.getByRole("note").filter({ hasText: "Um ano forte não costuma se repetir" })).toBeVisible();
  });

  test("manda conferir a taxa de administração no regulamento, em vez de mostrar um número sem fonte", async ({ page }) => {
    await page.goto("/ativos/etfs/BOVA11");
    await expect(page.getByText("A taxa de administração de cada ETF está no regulamento do fundo")).toBeVisible();
  });

  test("ETF que não pagou provento diz isso, e a seção de proventos mostra o vazio", async ({ page }) => {
    await page.goto("/ativos/etfs/BOVA11");
    await expect(page.getByText("Nenhum provento registrado nos últimos 12 meses")).toBeVisible();
    await expect(page.getByText("Nenhum provento nos últimos 12 meses.")).toBeVisible();
  });

  test("ETF que pagou provento mostra a agenda", async ({ page }) => {
    await page.goto("/ativos/etfs/SMAL11");
    await expect(page.getByRole("region", { name: "Proventos recentes" }).getByText("data-ex").first()).toBeVisible();
  });

  test("CVM sem patrimônio: o indicador vira traço e o resto da ficha segue", async ({ page }) => {
    await page.goto("/ativos/etfs/IVVB11");

    const linha = page.getByRole("region", { name: "Indicadores" }).getByRole("listitem").filter({ hasText: "Patrimônio líquido" });
    await expect(linha.locator("strong")).toHaveText("—");
    await expect(page.getByRole("img", { name: /Preço de IVVB11/ })).toBeVisible();
  });

  test("histórico curto: a variação em 12 meses é traço, e não um número inventado", async ({ page }) => {
    await page.goto("/ativos/etfs/FIXA11");
    const linha = page.getByRole("region", { name: "Indicadores" }).getByRole("listitem").filter({ hasText: "Variação em 12 meses" });
    await expect(linha.locator("strong")).toHaveText("—");
  });

  test("o breadcrumb tem quatro níveis, o 'Voltar' funciona e o ticker em minúsculas abre", async ({ page }) => {
    await page.goto("/ativos/etfs/bova11");
    await expect(page.getByRole("heading", { level: 1, name: "BOVA11" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Você está em" }).getByRole("listitem")).toHaveCount(4);

    await page.getByRole("link", { name: "Voltar para ETFs" }).first().click();
    await expect(page).toHaveURL("/ativos/etfs");
  });

  test("ETF fora do catálogo é não encontrado, com o caminho para a lista de ETFs", async ({ page }) => {
    await page.goto("/ativos/etfs/XXXX11");
    await expect(page.getByRole("heading", { level: 1, name: "Não encontramos esse ativo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver os ETFs" })).toHaveAttribute("href", "/ativos/etfs");

    await page.goto("/ativos/etfs/VALE3");
    await expect(page.getByRole("heading", { level: 1, name: "Não encontramos esse ativo" })).toBeVisible();
  });
});

test.describe("'O que é este ativo' nas três classes", () => {
  for (const rota of ["/ativos/acoes/VALE3", "/ativos/fiis/MXRF11", "/ativos/etfs/BOVA11"]) {
    test(`${rota}: a explicação vem logo abaixo do cabeçalho, antes do gráfico`, async ({ page }) => {
      await page.goto(rota);
      const ticker = rota.split("/").pop() ?? "";
      const sobre = page.getByRole("region", { name: `O que é ${ticker}` });

      await expect(sobre).toBeVisible();
      await expect(sobre).toContainText(`Explicação breve de ${ticker}`);

      const caixaSobre = await sobre.boundingBox();
      const caixaGrafico = await page.getByRole("region", { name: "Preço mês a mês" }).boundingBox();
      const caixaCabecalho = await page.getByRole("heading", { level: 1, name: ticker }).boundingBox();
      expect(caixaCabecalho?.y ?? 0).toBeLessThan(caixaSobre?.y ?? 0);
      expect(caixaSobre?.y ?? 0).toBeLessThan(caixaGrafico?.y ?? 0);
    });
  }
});

test.describe("menu Ativos com ETFs", () => {
  test("'Buscar ETFs' mostra cinco ETFs, e 'Ações por setor' não existe mais", async ({ page }) => {
    await page.goto("/");
    const principal = page.getByRole("navigation", { name: "Principal" });
    await principal.getByRole("button", { name: "Ativos" }).click();

    await expect(principal.getByText("Ações por setor")).toHaveCount(0);
    await expect(principal.getByRole("link", { name: "Buscar ETFs" })).toHaveAttribute("href", "/ativos/etfs");

    await principal.getByRole("link", { name: "Buscar ETFs" }).hover();
    const lista = principal.getByRole("list", { name: "ETFs da lista" });
    await expect(lista.getByRole("link")).toHaveCount(5);
    await lista.getByRole("link", { name: /^BOVA11/ }).click();
    await expect(page).toHaveURL("/ativos/etfs/BOVA11");
  });
});
