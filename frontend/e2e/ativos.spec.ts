import { expect, test, type Page } from "@playwright/test";

// Páginas de ativos: listagens e fichas de ações e FIIs. Rodam contra uma API de mentira
// (e2e/ativos/stub-api.mjs, ver playwright.ativos.config.ts), então os números são os mesmos
// sempre e o teste não depende de backend, Yahoo ou CVM. O que se confere aqui é o comportamento:
// navegar, explicar (os "?"), avisar (as armadilhas), mostrar de onde vem cada dado, o que a tela
// faz quando uma fonte não responde, e não quebrar em tela de celular.

test.describe.configure({ timeout: 60_000 });

/** Erro de JavaScript ou console.error derruba o teste, mesmo que a tela "pareça" certa. */
function falharEmErroNoConsole(page: Page) {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && erros.push(`console: ${m.text()}`));
  return () => expect(erros, "erros no console").toEqual([]);
}

const migalhas = (page: Page) => page.getByRole("navigation", { name: "Você está em" });
const dica = (page: Page, nome: string) => page.getByRole("button", { name: `O que é ${nome}?` });

test.describe("listagem de ações", () => {
  test("mostra 5, expande para 15 e volta para 5", async ({ page }) => {
    const semErros = falharEmErroNoConsole(page);
    await page.goto("/ativos/acoes");

    const linhas = page.getByRole("table").getByRole("link");
    const botao = page.getByRole("button", { name: /Ver todas as 15/ });

    await expect(page.getByRole("heading", { level: 1, name: "Ações" })).toBeVisible();
    await expect(linhas).toHaveCount(5);
    await expect(page.getByText("Mostrando 5 de 15 ações do catálogo.")).toBeVisible();
    await expect(botao).toHaveAttribute("aria-expanded", "false");

    await botao.click();
    await expect(linhas).toHaveCount(15);
    await expect(page.getByText("Mostrando 15 de 15 ações do catálogo.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mostrar só as 5" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /TAEE11/ })).toBeVisible();

    await page.getByRole("button", { name: "Mostrar só as 5" }).click();
    await expect(linhas).toHaveCount(5);
    await expect(page.getByRole("link", { name: /TAEE11/ })).toBeHidden();
    semErros();
  });

  test("cada ação mostra o logo da empresa, servido pelo próprio site", async ({ page }) => {
    await page.goto("/ativos/acoes");
    // só os visíveis: a tabela (computador) e os cards (celular) estão ambos no HTML, um deles escondido
    const logos = page.locator('img[src^="/logos/"]:visible');

    await expect(logos).toHaveCount(5);
    await expect(logos.first()).toHaveAttribute("src", "/logos/PETR4.svg");
    // a imagem carregou de verdade (não é um ícone quebrado)
    for (const logo of await logos.all()) {
      expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    await expect(page.getByText("Os logos são marcas de seus titulares")).toBeVisible();
  });

  test("a linha é um link de verdade e abre a ficha certa", async ({ page }) => {
    await page.goto("/ativos/acoes");
    const link = page.getByRole("link", { name: /VALE3/ });

    await expect(link).toHaveAttribute("href", "/ativos/acoes/VALE3");
    await link.click();

    await expect(page).toHaveURL("/ativos/acoes/VALE3");
    await expect(page.getByRole("heading", { level: 1, name: "VALE3" })).toBeVisible();
  });

  test("o breadcrumb tem 'Ativos' como texto, e 'Início' e 'Ações' como links", async ({ page }) => {
    await page.goto("/ativos/acoes");

    await expect(migalhas(page).getByRole("link", { name: "Início" })).toBeVisible();
    await expect(migalhas(page).getByText("Ativos", { exact: true })).toBeVisible();
    await expect(migalhas(page).getByRole("link", { name: "Ativos" })).toHaveCount(0);
    await expect(migalhas(page).getByText("Ações", { exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("cada coluna de indicador tem o '?', e o texto é um tooltip", async ({ page }) => {
    await page.goto("/ativos/acoes");
    for (const nome of ["P/L", "P/VP", "DY 12m", "ROE"]) {
      await expect(dica(page, nome)).toBeVisible();
    }
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    await dica(page, "DY 12m").click();
    await expect(page.getByRole("tooltip")).toContainText("DY 7% quer dizer R$ 7 pagos, no passado");
  });

  test("sem rolagem lateral em 1440, 768 e 375 px, e a tabela vira cards no celular", async ({ page }) => {
    for (const largura of [1440, 768, 375]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/ativos/acoes");
      await page.getByRole("button", { name: /Ver todas as 15/ }).click();

      const cabeNaTela = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(cabeNaTela, `rolagem lateral em ${largura}px`).toBe(true);

      if (largura === 375) {
        await expect(page.getByRole("table")).toBeHidden();
        await expect(page.getByRole("list").getByRole("link", { name: /PETR4/ })).toBeVisible();
      } else {
        await expect(page.getByRole("table")).toBeVisible();
      }
    }
  });
});

test.describe("listagem de FIIs", () => {
  test("mostra 5, expande para 15 e volta para 5, com tipo e segmento", async ({ page }) => {
    const semErros = falharEmErroNoConsole(page);
    await page.goto("/ativos/fiis");

    const linhas = page.getByRole("table").getByRole("link");
    await expect(page.getByRole("heading", { level: 1, name: "Fundos imobiliários (FIIs)" })).toBeVisible();
    await expect(linhas).toHaveCount(5);
    await expect(page.getByRole("row", { name: /MXRF11/ })).toContainText("Papel");
    await expect(page.getByRole("row", { name: /MXRF11/ })).toContainText("Recebíveis (CRI)");

    await page.getByRole("button", { name: /Ver todas as 15/ }).click();
    await expect(linhas).toHaveCount(15);
    await expect(page.getByText("Mostrando 15 de 15 fundos do catálogo.")).toBeVisible();

    await page.getByRole("button", { name: "Mostrar só as 5" }).click();
    await expect(linhas).toHaveCount(5);
    semErros();
  });

  test("FII não usa logo: cada fundo mostra o ícone do seu tipo", async ({ page }) => {
    await page.goto("/ativos/fiis");

    await expect(page.locator('img[src^="/logos/"]')).toHaveCount(0);
    const icones = page.getByRole("table").locator("[data-icone-de-fii]");
    await expect(icones).toHaveCount(5);
    // MXRF11, HGLG11, KNRI11, KNCR11, KNIP11
    await expect(icones).toHaveText(["", "", "", "", ""]);
    expect(await icones.evaluateAll((els) => els.map((el) => el.getAttribute("data-icone-de-fii")))).toEqual(["Papel", "Tijolo", "Tijolo", "Papel", "Papel"]);
  });

  test("a coluna Tipo explica tijolo, papel, híbrido e FoF", async ({ page }) => {
    await page.goto("/ativos/fiis");
    await dica(page, "Tipo de fundo").click();

    const balao = page.getByRole("tooltip");
    for (const termo of ["Tijolo", "Papel", "Híbrido", "FoF"]) await expect(balao).toContainText(termo);
  });

  test("clicar numa linha abre a ficha, e o 'Voltar' do topo e do pé retornam à listagem", async ({ page }) => {
    await page.goto("/ativos/fiis");
    await page.getByRole("link", { name: /HGLG11/ }).click();
    await expect(page).toHaveURL("/ativos/fiis/HGLG11");

    await page.getByRole("link", { name: "Voltar para FIIs" }).first().click();
    await expect(page).toHaveURL("/ativos/fiis");

    await page.getByRole("link", { name: /HGLG11/ }).click();
    await page.getByRole("link", { name: "Voltar para FIIs" }).last().click();
    await expect(page).toHaveURL("/ativos/fiis");
  });
});

test.describe("ficha da ação", () => {
  test("mostra o cabeçalho, o gráfico, os quatro grupos de indicadores e o 'entenda' em cada um", async ({ page }) => {
    const semErros = falharEmErroNoConsole(page);
    await page.goto("/ativos/acoes/VALE3");

    await expect(page.getByRole("heading", { level: 1, name: "VALE3" })).toBeVisible();
    await expect(page.getByText("Vale S.A.", { exact: true })).toBeVisible();
    await expect(page.getByText("ON · ordinária")).toBeVisible();
    await expect(page.getByRole("img", { name: /Preço de VALE3 no fechamento de cada mês/ })).toBeVisible();

    for (const grupo of ["Valuation", "Dividendos", "Rentabilidade", "Endividamento"]) {
      await expect(page.getByRole("heading", { level: 3, name: new RegExp(`^${grupo}`) })).toBeVisible();
    }
    for (const nome of ["Preço/lucro (P/L)", "Preço/valor patrimonial (P/VP)", "Dividend Yield (12 meses)", "ROE", "Margem líquida", "Dívida líquida/EBITDA"]) {
      await expect(dica(page, nome)).toBeVisible();
    }
    await expect(page.getByText("Pelo preço de hoje, o lucro de cerca de 7 anos pagaria a ação.")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Resultados trimestrais" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Proventos recentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notícias sobre VALE3" })).toBeVisible();
    semErros();
  });

  test("o gráfico tem uma alternativa em texto com os 12 fechamentos, e nada focável dentro dele", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");
    const tabela = page.getByRole("table", { name: /Fechamento de VALE3/ });

    await expect(tabela.getByRole("row")).toHaveCount(13);
    await expect(tabela.getByRole("row", { name: /out\/2026/ })).toContainText("62,48");
    await expect(page.getByRole("img", { name: /Preço de VALE3/ }).locator("[tabindex]")).toHaveCount(0);
  });

  test("o gráfico desenha de verdade a linha do preço, na ação e no FII", async ({ page }) => {
    for (const rota of ["/ativos/acoes/PETR4", "/ativos/fiis/HGLG11"]) {
      await page.goto(rota);
      const linha = page.getByRole("img", { name: /Preço de/ }).locator("path.recharts-area-curve");

      await expect(linha, rota).toHaveCount(1);
      await expect(linha, rota).toHaveAttribute("d", /^M[\d.]+,[\d.]+C/);
    }
  });

  test("as armadilhas da ação ficam dentro da explicação e aparecem ao abri-la", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");

    // fechada, a nota não é lida nem focada
    await expect(page.getByRole("note")).toHaveCount(0);
    for (const botao of await page.getByRole("button", { name: "Entender melhor" }).all()) await botao.click();

    await expect(page.getByRole("note").filter({ hasText: "Lucro pontual" })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "distorcer o P/L" })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "DY alto pode ser o preço caindo, não o provento subindo" })).toBeVisible();
  });

  test("o chip ON/PN/Unit tem tooltip", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");
    await dica(page, "ON, PN e Unit").click();

    await expect(page.getByRole("tooltip")).toContainText("ON = ação ordinária: dá direito a voto");
  });

  test("banco mostra ROA e não mostra margem líquida nem dívida/EBITDA", async ({ page }) => {
    await page.goto("/ativos/acoes/ITUB4");

    await expect(dica(page, "ROA")).toBeVisible();
    await expect(page.getByText("De cada R$ 100 em ativos, o banco gerou")).toBeVisible();
    await expect(dica(page, "Margem líquida")).toHaveCount(0);
    await expect(dica(page, "Dívida líquida/EBITDA")).toHaveCount(0);
    await expect(page.getByText("Em banco, a dívida faz parte do negócio")).toBeVisible();
  });

  test("empresa comum mostra margem líquida e não mostra ROA", async ({ page }) => {
    await page.goto("/ativos/acoes/WEGE3");

    await expect(dica(page, "Margem líquida")).toBeVisible();
    await expect(dica(page, "ROA")).toHaveCount(0);
  });

  test("relatórios: estado vazio com o caminho para a tela de Relatórios", async ({ page }) => {
    await page.goto("/ativos/acoes/PETR4");
    const bloco = page.getByRole("region", { name: "Relatórios de PETR4" });

    await expect(bloco.getByText("Você ainda não enviou nenhum relatório desta empresa.")).toBeVisible();
    await expect(bloco.getByRole("link", { name: "Ir para Relatórios" })).toHaveAttribute("href", "/relatorios");
  });

  test("'Registrar compra' leva à carteira", async ({ page }) => {
    await page.goto("/ativos/acoes/PETR4");
    await expect(page.getByRole("link", { name: "Registrar compra" })).toHaveAttribute("href", "/carteira");
  });

  test("o breadcrumb da ficha tem quatro níveis e 'Ações' leva à listagem", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");

    await expect(migalhas(page).getByRole("listitem")).toHaveCount(4);
    await migalhas(page).getByRole("link", { name: "Ações" }).click();
    await expect(page).toHaveURL("/ativos/acoes");
  });

  test("o ticker em minúsculas também abre a ficha", async ({ page }) => {
    await page.goto("/ativos/acoes/vale3");
    await expect(page.getByRole("heading", { level: 1, name: "VALE3" })).toBeVisible();
  });
});

test.describe("fichas no celular", () => {
  test("a 390px nenhuma ficha rola para o lado (a tabela do leitor de tela não vaza)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const rota of ["/ativos/acoes/VALE3", "/ativos/fiis/MXRF11", "/ativos/etfs/BOVA11"]) {
      await page.goto(rota);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const medidas = await page.evaluate(() => ({ pagina: document.documentElement.scrollWidth, janela: window.innerWidth }));
      expect(medidas.pagina, rota).toBeLessThanOrEqual(medidas.janela);
    }
  });
});

test.describe("ficha da ação: revelar ao rolar", () => {
  test("o cabeçalho e o bloco do preço nunca ficam dentro de um Revelar", async ({ page }) => {
    await page.goto("/ativos/acoes/VALE3");
    await expect(page.getByRole("heading", { level: 1, name: "VALE3" })).toBeVisible();
    const dentroDeRevelar = await page.evaluate(() =>
      ["h1", "#preco-titulo"].map((seletor) => document.querySelector(seletor)?.closest(".revelar") !== null),
    );
    expect(dentroDeRevelar).toEqual([false, false]);
  });

  test("sem JavaScript o HTML do servidor já traz os blocos visíveis (nada começa escondido)", async ({ browser }) => {
    const contexto = await browser.newContext({ javaScriptEnabled: false });
    const page = await contexto.newPage();
    await page.goto("/ativos/acoes/VALE3");
    const escondidos = await page.evaluate(() => document.querySelectorAll(".revelar-espera").length);
    expect(escondidos).toBe(0);
    await expect(page.locator("#indicadores-titulo")).toHaveCSS("opacity", "1");
    await contexto.close();
  });

  test("o bloco de indicadores espera fora da tela e aparece ao rolar até ele", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto("/ativos/acoes/VALE3");
    const bloco = page.locator("#indicadores-titulo").locator("xpath=ancestor::*[contains(@class,'revelar')][1]");
    // visto fora da tela na primeira leitura do observador: fica à espera
    await expect(bloco).toHaveClass(/revelar-espera/);
    await bloco.scrollIntoViewIfNeeded();
    await expect(bloco).not.toHaveClass(/revelar-espera/);
    await expect(bloco).toHaveCSS("opacity", "1");
  });
});

test.describe("ficha do FII", () => {
  test("mostra rendimento, patrimônio, gestão, composição e agenda de proventos", async ({ page }) => {
    const semErros = falharEmErroNoConsole(page);
    await page.goto("/ativos/fiis/MXRF11");

    await expect(page.getByRole("heading", { level: 1, name: "MXRF11" })).toBeVisible();
    for (const grupo of ["Rendimento", "Patrimônio", "Gestão"]) {
      await expect(page.getByRole("heading", { level: 3, name: new RegExp(`^${grupo}`) })).toBeVisible();
    }
    for (const nome of ["DY mensal", "Dividend Yield (12 meses)", "Preço/valor patrimonial (P/VP)", "Patrimônio líquido", "Número de cotistas", "Taxa de administração", "Tipo de gestão"]) {
      await expect(dica(page, nome)).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Composição da carteira do fundo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda de proventos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notícias sobre MXRF11" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para Relatórios" })).toHaveAttribute("href", "/relatorios");
    semErros();
  });

  test("as armadilhas do FII ficam dentro da explicação e aparecem ao abri-la", async ({ page }) => {
    await page.goto("/ativos/fiis/MXRF11");

    await expect(page.getByRole("note")).toHaveCount(0);
    for (const botao of await page.getByRole("button", { name: "Entender melhor" }).all()) await botao.click();

    await expect(page.getByRole("note").filter({ hasText: "DY muito acima da média do segmento" })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "P/VP abaixo de 1 com DY muito alto exige cuidado" })).toBeVisible();
  });

  test("não fala em vacância em nenhum fundo do catálogo", async ({ page }) => {
    for (const ticker of ["MXRF11", "HGLG11", "VISC11"]) {
      await page.goto(`/ativos/fiis/${ticker}`);
      await expect(page.getByRole("heading", { level: 1, name: ticker })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/vac[âa]ncia/i);
    }
  });

  test("a composição soma 100% e explica o tipo do fundo", async ({ page }) => {
    await page.goto("/ativos/fiis/MXRF11");
    const bloco = page.getByRole("region", { name: "Composição da carteira do fundo" });

    await expect(bloco.getByText("78,0%")).toBeVisible();
    await expect(bloco.getByText("Este é um fundo de “papel”")).toBeVisible();
  });
});

test.describe("ativo que não existe", () => {
  test("ticker fora do catálogo mostra a página de não encontrado, com o caminho de volta", async ({ page }) => {
    await page.goto("/ativos/acoes/XXXX9");

    await expect(page.getByRole("heading", { level: 1, name: "Não encontramos esse ativo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver as ações" })).toHaveAttribute("href", "/ativos/acoes");
    await expect(page.getByRole("link", { name: "Ver os fundos imobiliários" })).toHaveAttribute("href", "/ativos/fiis");
  });

  test("ticker em formato inválido também é não encontrado, e não a tela de erro", async ({ page }) => {
    for (const ticker of ["abc", "PETR4.SA"]) {
      await page.goto(`/ativos/acoes/${ticker}`);
      await expect(page.getByRole("heading", { level: 1, name: "Não encontramos esse ativo" }), ticker).toBeVisible();
    }
  });

  test("um FII no endereço de ações (e o inverso) também é não encontrado", async ({ page }) => {
    await page.goto("/ativos/acoes/MXRF11");
    await expect(page.getByRole("heading", { level: 1, name: "Não encontramos esse ativo" })).toBeVisible();

    await page.goto("/ativos/fiis/VALE3");
    await expect(page.getByRole("heading", { level: 1, name: "Não encontramos esse ativo" })).toBeVisible();
  });
});

test.describe("cabeçalho, rodapé e acesso", () => {
  const ROTAS_DE_ATIVOS = ["/ativos/acoes", "/ativos/acoes/VALE3", "/ativos/fiis", "/ativos/fiis/MXRF11", "/ativos/etfs", "/ativos/etfs/BOVA11"];

  test("o cabeçalho e o rodapé são idênticos nas seis rotas, e iguais aos da página inicial", async ({ page }) => {
    await page.goto("/");
    const cabecalhoDaInicial = await page.getByRole("banner").ariaSnapshot();
    const rodapeDaInicial = await page.getByRole("contentinfo").ariaSnapshot();

    for (const rota of ROTAS_DE_ATIVOS) {
      await page.goto(rota);
      expect(await page.getByRole("banner").ariaSnapshot(), `cabeçalho de ${rota}`).toBe(cabecalhoDaInicial);
      expect(await page.getByRole("contentinfo").ariaSnapshot(), `rodapé de ${rota}`).toBe(rodapeDaInicial);
    }
  });

  test("'Ativos' no cabeçalho não fica destacado nas páginas de ativos", async ({ page }) => {
    await page.goto("/ativos/acoes");
    const ativos = page.getByRole("navigation", { name: "Principal" }).getByRole("button", { name: "Ativos" });

    await expect(ativos).toHaveAttribute("aria-expanded", "false");
    await expect(ativos).not.toHaveAttribute("aria-current", /.+/);
  });

  test("as páginas de ativos abrem sem sessão, sem mandar para o login", async ({ page }) => {
    for (const rota of ROTAS_DE_ATIVOS) {
      await page.goto(rota);
      await expect(page, rota).toHaveURL(rota);
    }
  });

  test("quem já tem sessão também as vê, sem ser mandado para o dashboard", async ({ page, context }) => {
    // O proxy só confere se o cookie existe; quem valida o token é o backend.
    await context.addCookies([{ name: "token", value: "qualquer", url: "http://localhost:3000" }]);

    for (const rota of ROTAS_DE_ATIVOS) {
      await page.goto(rota);
      await expect(page, rota).toHaveURL(rota);
    }
  });

  test("a área logada continua fechada: /carteira sem sessão vai para o login", async ({ page }) => {
    await page.goto("/carteira");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("menu Ativos", () => {
  test("passar o mouse em 'Buscar ações' mostra cinco ações, e cada uma abre a ficha", async ({ page }) => {
    await page.goto("/");
    const principal = page.getByRole("navigation", { name: "Principal" });
    await principal.getByRole("button", { name: "Ativos" }).click();

    await expect(principal.getByRole("link", { name: "Buscar ações" })).toHaveAttribute("href", "/ativos/acoes");
    await expect(principal.getByRole("link", { name: "Buscar FIIs" })).toHaveAttribute("href", "/ativos/fiis");
    // o menu Ativos não tem mais item "em breve" (a "Agenda de proventos" saiu: menu sem itens mortos)
    await expect(principal.getByText("em breve")).toHaveCount(0);

    await principal.getByRole("link", { name: "Buscar ações" }).hover();
    const lista = principal.getByRole("list", { name: "Ações da lista" });
    await expect(lista.getByRole("link")).toHaveCount(5);
    await expect(lista.getByRole("link", { name: /^VALE3/ })).toBeVisible();

    await lista.getByRole("link", { name: /^VALE3/ }).click();
    await expect(page).toHaveURL("/ativos/acoes/VALE3");
  });

  test("passar o mouse em 'Buscar FIIs' mostra cinco fundos", async ({ page }) => {
    await page.goto("/ativos/acoes");
    const principal = page.getByRole("navigation", { name: "Principal" });
    await principal.getByRole("button", { name: "Ativos" }).click();
    await principal.getByRole("link", { name: "Buscar FIIs" }).hover();

    const lista = principal.getByRole("list", { name: "Fundos da lista" });
    await expect(lista.getByRole("link")).toHaveCount(5);
    await lista.getByRole("link", { name: /^MXRF11/ }).click();
    await expect(page).toHaveURL("/ativos/fiis/MXRF11");
  });

  test("o foco de teclado em 'Buscar ações' também abre os atalhos", async ({ page }) => {
    await page.goto("/");
    const principal = page.getByRole("navigation", { name: "Principal" });
    await principal.getByRole("button", { name: "Ativos" }).click();
    await principal.getByRole("link", { name: "Buscar ações" }).focus();

    await expect(principal.getByRole("list", { name: "Ações da lista" }).getByRole("link", { name: /^PETR4/ })).toBeVisible();
  });
});

test.describe("tooltip: teclado", () => {
  test("Enter abre, Esc fecha, e o foco continua no botão", async ({ page }) => {
    await page.goto("/ativos/acoes");
    const botao = dica(page, "P/L");

    await botao.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip")).toContainText("P/L = preço ÷ lucro por ação");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(botao).toBeFocused();
  });

  test("o texto está ligado ao botão por aria-describedby, mesmo com o balão fechado", async ({ page }) => {
    await page.goto("/ativos/acoes");
    await expect(dica(page, "P/L")).toHaveAccessibleDescription(/P\/L = preço ÷ lucro por ação/);
  });

  test("Tab para fora fecha o balão", async ({ page }) => {
    await page.goto("/ativos/acoes");
    await dica(page, "P/L").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tooltip")).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("um balão aberto não é cortado pelas bordas da tela em 375 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/ativos/acoes");

    for (const nome of ["DY 12m", "ROE"]) {
      await dica(page, nome).first().click();
      const caixa = await page.getByRole("tooltip").boundingBox();
      expect(caixa, nome).not.toBeNull();
      expect(caixa?.x ?? -1, `${nome}: borda esquerda`).toBeGreaterThanOrEqual(0);
      expect((caixa?.x ?? 0) + (caixa?.width ?? 0), `${nome}: borda direita`).toBeLessThanOrEqual(375);
    }
  });
});

test.describe("tooltip: toque", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("tocar abre, tocar de novo fecha, e tocar fora também fecha", async ({ page }) => {
    await page.goto("/ativos/acoes");
    const botao = dica(page, "DY 12m").first();

    await botao.tap();
    await expect(page.getByRole("tooltip")).toContainText("DY 7% quer dizer R$ 7 pagos");

    await botao.tap();
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    await botao.tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.getByRole("heading", { level: 1, name: "Ações" }).tap();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });

  test("o botão do '?' tem pelo menos 44 px de área de toque", async ({ page }) => {
    await page.goto("/ativos/acoes");
    const caixa = await dica(page, "P/L").first().boundingBox();

    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("tocar no '?' de um card não abre a ficha", async ({ page }) => {
    await page.goto("/ativos/acoes");
    await dica(page, "P/L").first().tap();

    await expect(page).toHaveURL("/ativos/acoes");
    await expect(page.getByRole("tooltip")).toBeVisible();
  });

  test("tocar no card abre a ficha", async ({ page }) => {
    await page.goto("/ativos/acoes");
    await page.getByRole("link", { name: /PETR4/ }).tap();

    await expect(page).toHaveURL("/ativos/acoes/PETR4");
  });
});
