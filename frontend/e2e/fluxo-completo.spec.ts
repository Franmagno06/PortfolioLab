import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Percurso ponta a ponta: registrar → entrar → lançar transação →
// simular aporte → conferir a sugestão. Roda contra o app de verdade
// (backend + frontend reais — ver playwright.config.ts), por isso precisa
// do Postgres local do docker-compose já de pé com o schema aplicado
// (skill rodar-testes-seguro). NÃO faz parte do CI automático (ci.yml) —
// roda localmente antes de um release.
const email = `playwright-${randomUUID()}@portfoliolab.dev`;
const password = "senha123";

test("registrar, lançar transação e simular aporte", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Nome").fill("Testadora E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();

  // Timeout maior que o padrão (5s): primeira requisição contra o dev server
  // recém-subido (Next compilando a rota sob demanda, backend recém-conectado
  // ao Postgres local) é mais lenta que uma requisição normal.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.goto("/carteira");
  await page.getByRole("button", { name: "+ Nova transação" }).click();
  // Escopado ao formulário "Registrar transação": a carteira também tem o
  // card de Proventos, que tem seu próprio campo "Ativo" (um <select>), então
  // getByLabel("Ativo") na página inteira é ambíguo.
  const novaTransacao = page.locator("form", {
    has: page.getByRole("heading", { name: "Registrar transação" }),
  });
  await novaTransacao.getByLabel("Ativo").fill("PETR4");
  await expect(novaTransacao.getByText("✓ PETR4")).toBeVisible({ timeout: 15_000 });
  await novaTransacao.getByLabel("Qtd.").fill("10");
  await novaTransacao.getByRole("button", { name: "Registrar compra" }).click();

  await expect(page.getByText("PETR4").first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/simulacao");
  await page.getByPlaceholder("Adicionar meta: PETR4").fill("PETR4");
  await expect(page.getByText("✓ PETR4")).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder("%").fill("100");
  await page.getByRole("button", { name: "+" }).click();

  await page.getByLabel("Valor do aporte (R$)").fill("1500");
  await page.getByRole("button", { name: "Calcular aporte" }).click();

  await expect(page.getByRole("heading", { name: "O que comprar" })).toBeVisible({
    timeout: 15_000,
  });
});
