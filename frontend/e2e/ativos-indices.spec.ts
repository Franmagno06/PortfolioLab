import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { numero, percentual } from "../src/lib/format";
import { CATEGORIAS, formatarData, INDICES, type Indice } from "../src/lib/indices";
import { destaqueDoIndice, ordenarEFiltrar, provedorDaApi } from "../src/lib/indices-dados";
import { DADOS_DE_EXEMPLO } from "../src/lib/indices-exemplo";

const provedorDeTeste = provedorDaApi(DADOS_DE_EXEMPLO);

// Páginas de índices (/ativos/indices). Os dados vêm da API de mentira (e2e/ativos/stub-api.mjs), que
// responde GET /indices/dados com e2e/ativos/indices-dados.json, gerado de lib/indices-exemplo.ts. Os
// valores esperados saem da própria lib, e não de números escritos no teste, para o teste conferir que
// a tela mostra o que a fonte de dados diz. Os cenários de falha ligam o modo do stub (POST /__modo).

test.describe.configure({ timeout: 60_000 });

const API_DE_MENTIRA = "http://localhost:3399";

/** Liga um cenário do stub só durante o teste; o modo é global, e o desligamento volta ao normal. */
async function comCenario(request: APIRequestContext, indices: string, teste: () => Promise<void>) {
  await request.post(`${API_DE_MENTIRA}/__modo`, { data: { indices } });
  try {
    await teste();
  } finally {
    await request.post(`${API_DE_MENTIRA}/__modo/reset`);
  }
}

const indice = (slug: string) => INDICES.find((i) => i.slug === slug) as Indice;
const cards = (page: Page) => page.getByRole("article");
const balao = (page: Page) => page.locator("[data-balao-do-grafico]").first();
const titulosDosCards = (page: Page) => cards(page).getByRole("heading", { level: 2 });

test.describe("listagem", () => {
  test("mostra os oito índices, cada um com valor e variação iguais aos da ficha", async ({ page }) => {
    await page.goto("/ativos/indices");
    await expect(page.getByRole("heading", { level: 1, name: "Índices" })).toBeVisible();
    await expect(cards(page)).toHaveCount(8);

    const ipca = cards(page).filter({ has: page.getByRole("link", { name: "IPCA", exact: true }) });
    await expect(ipca).toContainText("4,58%");
    await expect(ipca).toContainText("0,82%");
    await expect(cards(page).filter({ hasText: "Ibovespa" }).first()).toContainText(destaqueDoIndice(indice("ibovespa"), DADOS_DE_EXEMPLO).valorFormatado);
  });

  test("filtro por categoria e ordenação ficam na URL e sobrevivem ao recarregar", async ({ page }) => {
    await page.goto("/ativos/indices");

    const bolsa = CATEGORIAS.find((c) => c.id === "bolsa-brasil");
    await page.getByRole("link", { name: `${bolsa?.rotulo} (4)` }).click();
    await expect(page).toHaveURL("/ativos/indices?categoria=bolsa-brasil");
    await expect(cards(page)).toHaveCount(4);
    await expect(page.getByRole("link", { name: /Bolsa brasileira/ })).toHaveAttribute("aria-current", "true");

    await page.getByLabel("Ordenar por").selectOption("az");
    await expect(page).toHaveURL(/categoria=bolsa-brasil/);
    await expect(page).toHaveURL(/ordem=az/);
    const esperado = ordenarEFiltrar(INDICES, "az", "bolsa-brasil", DADOS_DE_EXEMPLO).map((i) => i.nome);
    await expect(titulosDosCards(page)).toHaveText(esperado);

    await page.reload();
    await expect(page.getByLabel("Ordenar por")).toHaveValue("az");
    await expect(titulosDosCards(page)).toHaveText(esperado);

    await page.getByRole("link", { name: "Todos (8)" }).click();
    await expect(page).toHaveURL("/ativos/indices?ordem=az");
    await expect(cards(page)).toHaveCount(8);
  });

  test("maior variação em 12 meses põe o índice que mais subiu primeiro", async ({ page }) => {
    await page.goto("/ativos/indices?ordem=variacao");
    const esperado = ordenarEFiltrar(INDICES, "variacao", null, DADOS_DE_EXEMPLO).map((i) => i.nome);
    await expect(titulosDosCards(page)).toHaveText(esperado);
  });

  test("clicar no card leva à ficha certa; breadcrumb e Voltar trazem de volta", async ({ page }) => {
    await page.goto("/ativos/indices");
    // clica na altura do minigráfico, e não no nome: o link cobre o card inteiro (só o "?" fica por cima)
    await cards(page).filter({ has: page.getByRole("link", { name: "Selic", exact: true }) }).click({ position: { x: 120, y: 110 } });
    await expect(page).toHaveURL("/ativos/indices/selic");
    await expect(page.getByRole("heading", { level: 1, name: "Selic" })).toBeVisible();

    const migalhas = page.getByRole("navigation", { name: "Você está em" });
    await expect(migalhas.getByRole("listitem")).toHaveText(["Início/", "Ativos/", "Índices/", "Selic"]);
    await migalhas.getByRole("link", { name: "Índices" }).click();
    await expect(page).toHaveURL("/ativos/indices");

    await page.getByRole("link", { name: "IFIX", exact: true }).click();
    await expect(page).toHaveURL("/ativos/indices/ifix");
    await page.getByRole("link", { name: "Voltar para índices" }).first().click();
    await expect(page).toHaveURL("/ativos/indices");
  });

  test("o '?' abre por teclado, explica o número e não navega", async ({ page }) => {
    await page.goto("/ativos/indices");
    const botao = page.getByRole("button", { name: "O que é Selic meta?" });
    await botao.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip").filter({ hasText: "Copom" })).toBeVisible();
    await expect(page).toHaveURL("/ativos/indices");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip").filter({ hasText: "Copom" })).toBeHidden();
  });
});

test.describe("o '?' no toque", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("tocar no '?' de um card abre a explicação sem abrir a ficha", async ({ page }) => {
    await page.goto("/ativos/indices");
    await page.getByRole("button", { name: "O que é IPCA em 12 meses?" }).tap();
    await expect(page.getByRole("tooltip").filter({ hasText: "inflação oficial" })).toBeVisible();
    await expect(page).toHaveURL("/ativos/indices");
  });
});

test.describe("fichas", () => {
  // O status HTTP não é 404: o loading.tsx de /ativos põe a página dentro de um Suspense, e o Next já
  // começou a responder (200) quando o notFound() acontece. Ele marca a página como noindex, e é isso
  // que se confere aqui, junto com o conteúdo.
  test("endereço de índice que não existe mostra o 404 dos índices, fora dos buscadores", async ({ page }) => {
    await page.goto("/ativos/indices/xyz");
    await expect(page.getByRole("heading", { name: "Não encontramos esse índice" })).toBeVisible();
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Ibovespa" })).toHaveAttribute("href", "/ativos/indices/ibovespa");
  });

  test("Selic: passar o mouse na última barra mostra o valor exato e o mês", async ({ page }) => {
    const selic = indice("selic");
    const serie = await provedorDeTeste.getSerie("selic", selic.periodoPadrao);
    const ultimo = serie[serie.length - 1];

    await page.goto("/ativos/indices/selic");
    await page.locator(".recharts-bar-rectangle").last().hover();
    await expect(balao(page)).toContainText(percentual(ultimo?.valor ?? 0, 2));
    await expect(balao(page)).toContainText(formatarData(ultimo?.data ?? "", "mensal"));
  });

  test("Selic: trocar o período muda o número de barras e o resumo", async ({ page }) => {
    await page.goto("/ativos/indices/selic");
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(60);
    await page.getByRole("button", { name: "Mostrar 1 ano" }).click();
    await expect(page.getByRole("button", { name: "Mostrar 1 ano" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(12);
    await expect(page.getByRole("heading", { name: "Resumo do período (1A)" })).toBeVisible();
  });

  test("Ibovespa: no fim do gráfico de área, o tooltip mostra o último fechamento e a data", async ({ page }) => {
    const ibov = await provedorDeTeste.getSerie("ibovespa", "1A");
    const ultimo = ibov[ibov.length - 1];

    await page.goto("/ativos/indices/ibovespa");
    const grafico = page.locator(".recharts-surface").first();
    await grafico.scrollIntoViewIfNeeded(); // o mouse só alcança o que está na tela
    const caixa = await grafico.boundingBox();
    if (!caixa) throw new Error("gráfico sem tamanho");
    // A área do gráfico termina 12px antes da borda do SVG (a margem direita). O movimento se repete
    // porque o primeiro pode chegar antes de o gráfico hidratar.
    await expect(async () => {
      await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
      await page.mouse.move(caixa.x + caixa.width - 13, caixa.y + caixa.height / 2, { steps: 5 });
      await expect(balao(page)).toContainText(`${numero(ultimo?.valor ?? 0, 2)} pts`, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(balao(page)).toContainText(formatarData(ultimo?.data ?? "", "diaria"));
  });

  test("Ibovespa: o gráfico anda com as setas do teclado", async ({ page }) => {
    await page.goto("/ativos/indices/ibovespa");
    const grafico = page.locator(".recharts-surface").first();
    await grafico.focus();
    await page.keyboard.press("ArrowRight");
    await expect(balao(page)).toContainText("pts");
    const primeiro = await balao(page).innerText();
    await page.keyboard.press("ArrowRight");
    await expect(balao(page)).not.toHaveText(primeiro);
  });

  test("Ibovespa: trocar para 5A muda o subtítulo, o resumo e a tabela", async ({ page }) => {
    await page.goto("/ativos/indices/ibovespa");
    await expect(page.getByText(/em 1 ano\./)).toBeVisible();
    await page.getByRole("button", { name: "Mostrar 5 anos" }).click();
    await expect(page.getByText(/\+77,6% em 5 anos\./)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resumo do período (5A)" })).toBeVisible();

    await page.getByText("Ver os dados em tabela").click();
    const tabela = page.getByRole("table", { name: /5 anos/ });
    await expect(tabela).toBeVisible();
    await expect(tabela.getByRole("row").nth(1)).toContainText("15/10/26");
  });

  test("toda ficha mostra a fonte, a data e a nota da fonte, sem aviso de exemplo", async ({ page }) => {
    for (const i of INDICES) {
      await page.goto(`/ativos/indices/${i.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: i.nome })).toBeVisible();
      await expect(page.getByText(`Fonte: ${i.fonte.nome}`).first()).toBeVisible();
      await expect(page.getByText("Atualizado em 15/10/2026").first()).toBeVisible();
      const via = i.tipo === "pontos" ? ", via Yahoo Finance" : "";
      const nota = page.getByRole("main").getByText(`Fonte: ${i.fonte.nome} (${i.fonte.serie})${via}. Dados até`);
      await expect(nota).toBeVisible();
      await expect(nota).toContainText("Nada aqui é recomendação de investimento");
      await expect(page.getByText(/Dados de exemplo/)).toHaveCount(0);
      if (i.tipo === "pontos") await expect(nota).toContainText("Cotação com atraso de cerca de 15 minutos.");
    }
  });

  test("ficha do IFIX com um ponto mostra o aviso de histórico curto, sem gráfico", async ({ page, request }) => {
    await comCenario(request, "curto", async () => {
      await page.goto("/ativos/indices/ifix");
      await expect(page.getByText("O histórico do IFIX começa em 15/10/2026. O gráfico aparece a partir do segundo pregão.")).toBeVisible();
      await expect(page.locator(".recharts-surface")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /Resumo do período/ })).toHaveCount(0);
      await expect(page.getByText("Variação em 12 meses").locator("..")).toContainText("—");
    });
  });

  test("uma série vazia (IPCA) deixa só aquele índice sem gráfico, e os outros seguem", async ({ page, request }) => {
    await comCenario(request, "ipca-vazio", async () => {
      await page.goto("/ativos/indices/ipca");
      await expect(page.getByRole("heading", { level: 1, name: "IPCA" })).toBeVisible();
      await expect(page.getByText("Não conseguimos buscar os índices agora. Tente de novo em alguns minutos.")).toBeVisible();
      await expect(page.locator(".recharts-surface")).toHaveCount(0);

      await page.goto("/ativos/indices/selic");
      await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();

      // a listagem também avisa quando a API respondeu mas uma série veio vazia
      await page.goto("/ativos/indices");
      await expect(page.getByText("Não conseguimos buscar alguns índices agora.", { exact: false })).toBeVisible();
      await expect(page.getByText("Não conseguimos buscar os índices agora.", { exact: false })).toHaveCount(0);
    });
  });

  test("API fora mostra o aviso na ficha e na listagem, e não quebra", async ({ page, request }) => {
    await comCenario(request, "erro", async () => {
      await page.goto("/ativos/indices/selic");
      await expect(page.getByRole("heading", { level: 1, name: "Selic" })).toBeVisible();
      await expect(page.getByText("Não conseguimos buscar os índices agora. Tente de novo em alguns minutos.")).toBeVisible();
      await expect(page.locator(".recharts-surface")).toHaveCount(0);

      await page.goto("/ativos/indices");
      await expect(page.getByRole("heading", { level: 1, name: "Índices" })).toBeVisible();
      await expect(page.getByText("Não conseguimos buscar os índices agora. Tente de novo em alguns minutos.")).toBeVisible();
      await expect(cards(page)).toHaveCount(8);
      await expect(cards(page).first()).toContainText("—");
    });
  });
});

test.describe("cabeçalho e acesso", () => {
  test("nenhuma aba do cabeçalho aparece destacada nas páginas de índices", async ({ page }) => {
    for (const caminho of ["/ativos/indices", "/ativos/indices/ibovespa"]) {
      await page.goto(caminho);
      const nav = page.getByRole("navigation", { name: "Principal" }).first();
      await expect(nav.locator("[aria-current]")).toHaveCount(0);
      const fundos = await nav.locator("button, a").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
      expect(new Set(fundos).size, caminho).toBe(1);
    }
  });

  test("quem está logado também abre os índices, sem ser mandado ao dashboard", async ({ page, context }) => {
    await context.addCookies([{ name: "token", value: "qualquer", url: "http://localhost:3100" }]);
    const resposta = await page.goto("/ativos/indices/selic");
    expect(resposta?.status()).toBe(200);
    await expect(page).toHaveURL("/ativos/indices/selic");
  });
});

for (const largura of [1440, 768, 390]) {
  test(`sem rolagem horizontal em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const caminho of ["/ativos/indices", "/ativos/indices/selic", "/ativos/indices/cdi", "/ativos/indices/sp500"]) {
      await page.goto(caminho);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra, caminho).toBe(0);
    }
  });
}
