// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { brl, indicadorOuTraco, numero, percentual } from "@/lib/format";
import { ATIVO_DE_EXEMPLO as ativo } from "@/lib/site-dados";
import { AtivoAnotado, PainelDeCriterios } from "./ativo-anotado";
import { ESCALA_MAXIMA_PVP, posicaoNaReguaPvp, ReguaPvp } from "./regua-pvp";

afterEach(cleanup);

// o brl põe um espaço que não separa depois do "R$": aqui comparamos com espaço comum
const limpo = (s: string | null) => (s ?? "").replace(/ /g, " ");
const textoDoCard = () => limpo(screen.getByRole("article").textContent);
const linha = (nome: RegExp) => screen.getByRole("button", { name: nome });

describe("AtivoAnotado", () => {
  it("o cabeçalho diz que a empresa é fictícia e os números são ilustrativos", () => {
    render(<AtivoAnotado />);
    const texto = textoDoCard();
    for (const t of [brl(ativo.preco), "Empresa Exemplo S.A.", "empresa fictícia, números ilustrativos"]) {
      expect(texto, t).toContain(limpo(t));
    }
    expect(screen.getByRole("heading", { name: "Empresa Exemplo S.A." })).toBeTruthy();
  });

  it("não mostra ticker real, variação de mercado nem cor de alta ou baixa", () => {
    const { container } = render(<AtivoAnotado />);
    for (const b of screen.getAllByRole("button")) fireEvent.click(b);
    expect(textoDoCard()).not.toMatch(/\b[A-Z]{4}\d{1,2}\b/);
    expect(container.querySelector(".text-gain-ink, .text-loss-ink")).toBeNull();
  });

  it("mostra os cinco indicadores com valor e frase sempre visíveis", () => {
    render(<AtivoAnotado />);
    const valores = [
      [/Preço\/lucro/, indicadorOuTraco(ativo.pl), "cerca de 10 anos"],
      [/Preço\/valor patrimonial/, indicadorOuTraco(ativo.pvp), "para cada R$ 1,00 de patrimônio contábil"],
      [/Dividend yield/, percentual(ativo.dy12m, 2), "de proventos para cada R$ 100 do preço de hoje"],
      [/Retorno sobre o patrimônio/, percentual(ativo.roe, 2), "de lucro em um ano"],
      [/Margem líquida/, percentual(ativo.margemLiquida, 2), "viram lucro depois de tudo"],
    ] as const;
    for (const [nome, valor, frase] of valores) {
      const botao = linha(nome);
      expect(limpo(botao.textContent), String(nome)).toContain(valor);
      expect(textoDoCard(), frase).toContain(frase);
      expect(botao.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("os corpos fechados ficam inertes e abrir tira o inert", () => {
    render(<AtivoAnotado />);
    const botao = linha(/Preço\/lucro/);
    const corpo = document.getElementById(botao.getAttribute("aria-controls")!)!;
    expect(corpo.hasAttribute("inert")).toBe(true);
    fireEvent.click(botao);
    expect(corpo.hasAttribute("inert")).toBe(false);
  });

  it("abrir o P/L mostra a conta preço ÷ lucro por ação com os números do exemplo", () => {
    render(<AtivoAnotado />);
    const botao = linha(/Preço\/lucro/);
    fireEvent.click(botao);
    const corpo = document.getElementById(botao.getAttribute("aria-controls")!)!;
    const texto = limpo(corpo.textContent);
    expect(texto).toContain("preço ÷ lucro por ação = P/L");
    expect(texto).toContain(`${brl(ativo.preco)} ÷ ${brl(ativo.lucroPorAcao)} = ${indicadorOuTraco(ativo.pl)}`);
    expect(texto).toContain("Lucro pontual");
    // a conta bate com o P/L do próprio exemplo
    expect(Math.round((ativo.preco / ativo.lucroPorAcao) * 100) / 100).toBe(ativo.pl);
  });

  it("cada conta aberta reproduz os campos derivados do exemplo", () => {
    render(<AtivoAnotado />);
    const abrir = (nome: RegExp) => {
      const b = linha(nome);
      fireEvent.click(b);
      return limpo(document.getElementById(b.getAttribute("aria-controls")!)!.textContent);
    };

    const pvp = abrir(/Preço\/valor patrimonial/);
    expect(pvp).toContain(`${brl(ativo.preco)} ÷ ${brl(ativo.valorPatrimonialPorAcao)} = ${indicadorOuTraco(ativo.pvp)}`);
    expect(Math.round((ativo.preco / ativo.valorPatrimonialPorAcao) * 100) / 100).toBe(ativo.pvp);

    const dy = abrir(/Dividend yield/);
    expect(dy).toContain(`${brl(ativo.proventos12m.porUnidade)} ÷ ${brl(ativo.preco)} = ${percentual(ativo.dy12m, 2)}`);
    expect(Math.round((ativo.proventos12m.porUnidade / ativo.preco) * 10000) / 100).toBe(ativo.dy12m);
    expect(dy).toContain("preço caindo");

    const roe = abrir(/Retorno sobre o patrimônio/);
    expect(roe).toContain("lucro por ação ÷ patrimônio por ação = ROE");
    expect(roe).toContain(`${brl(ativo.lucroPorAcao)} ÷ ${brl(ativo.valorPatrimonialPorAcao)} = ${percentual(ativo.roe, 2)}`);
    expect((ativo.lucroPorAcao / ativo.valorPatrimonialPorAcao) * 100).toBe(ativo.roe);
    const margem = abrir(/Margem líquida/);
    expect(margem).toContain("lucro líquido ÷ receita líquida = margem líquida");
    expect(margem).toContain(`R$ 400 mi ÷ R$ 1,6 bi = ${percentual(ativo.margemLiquida, 2)}`);
    expect((ativo.lucroLiquido / ativo.receitaLiquida) * 100).toBe(ativo.margemLiquida);
  });

  it("só o P/VP tem régua, com rótulos neutros", () => {
    const { container } = render(<AtivoAnotado />);
    const reguas = container.querySelectorAll("[data-regua]");
    expect(reguas).toHaveLength(1);
    const botao = linha(/Preço\/valor patrimonial/);
    expect(document.getElementById(botao.getAttribute("aria-controls")!)!.contains(reguas[0]!)).toBe(true);
    fireEvent.click(botao); // fechado, o corpo é aria-hidden e a régua some da árvore de acessibilidade
    const texto = limpo(reguas[0]!.textContent);
    expect(texto).toContain("abaixo do patrimônio contábil");
    expect(texto).toContain("acima do patrimônio contábil");
    expect(screen.getByRole("img", { name: /Régua do P\/VP, de 0 a 3 ou mais: 2,00, acima do patrimônio contábil/ })).toBeTruthy();
  });

  it("o marcador da régua fica na posição proporcional ao P/VP do exemplo", () => {
    const { container } = render(<AtivoAnotado />);
    const marcador = container.querySelector<HTMLElement>("[data-marcador='pvp']")!;
    const esperado = (ativo.pvp / ESCALA_MAXIMA_PVP) * 100;
    expect(parseFloat(marcador.style.left)).toBeCloseTo(esperado, 5);
    expect(esperado).toBeGreaterThan(50); // acima de 1,0 (33,3%)
  });

  it("a régua tem escala 0, 1,0 e 3+ e rótulos que não se cruzam", () => {
    const { container } = render(<AtivoAnotado />);
    const t = limpo(container.querySelector("[data-regua]")!.textContent);
    for (const x of ["0", "1,0", "3+", "abaixo do patrimônio contábil", "acima do patrimônio contábil"]) expect(t).toContain(x);
  });

  it("P/VP zero, negativo ou ausente não desenha a régua", () => {
    for (const v of [0, -1.2, null, Number.NaN]) {
      const { container, unmount } = render(<ReguaPvp pvp={v} />);
      expect(container.querySelector("[data-regua]"), String(v)).toBeNull();
      unmount();
    }
  });

  it("o corpo do ROE lembra que um ano isolado diz pouco", () => {
    render(<AtivoAnotado />);
    const b = linha(/Retorno sobre o patrimônio/);
    fireEvent.click(b);
    expect(limpo(document.getElementById(b.getAttribute("aria-controls")!)!.textContent)).toContain("Um ano isolado diz pouco");
  });

  it("tem os links das fichas de ações e dos indicadores explicados, sem ficha da empresa fictícia", () => {
    render(<AtivoAnotado />);
    expect(screen.getByRole("link", { name: "Ver as fichas das ações do site" }).getAttribute("href")).toBe("/ativos/acoes");
    expect(screen.getByRole("link", { name: "Indicadores explicados" }).getAttribute("href")).toBe("/aprender/indicadores");
  });

  it("posicaoNaReguaPvp prende o marcador dentro da barra", () => {
    expect(posicaoNaReguaPvp(1)).toBeCloseTo(100 / 3, 5);
    expect(posicaoNaReguaPvp(0)).toBe(0);
    expect(posicaoNaReguaPvp(-2)).toBe(0);
    expect(posicaoNaReguaPvp(7)).toBe(100);
    expect(posicaoNaReguaPvp(Number.NaN)).toBe(0);
  });

  it("nenhum texto da seção diz barato, caro, compre ou oportunidade", () => {
    const { container } = render(
      <>
        <AtivoAnotado />
        <PainelDeCriterios />
      </>,
    );
    for (const b of screen.getAllByRole("button")) fireEvent.click(b);
    expect(container.textContent ?? "").not.toMatch(/\b(barat\w*|car[oa]s?|compre|oportunidade\w*|melhores)\b/i);
  });

  it("não sobra nenhum número do exemplo antigo nem arredondado de outro jeito", () => {
    render(<AtivoAnotado />);
    for (const b of screen.getAllByRole("button")) fireEvent.click(b);
    const texto = textoDoCard();
    for (const t of ["TAEE11", "Taesa", "Unit", "45,87", "9,66", "1,96", "6,55", "20,86", "3,0065"]) {
      expect(texto, t).not.toContain(t);
    }
    expect(numero(ativo.pl, 2)).toBe("10,00");
  });
});


describe("PainelDeCriterios", () => {
  it("enquadra os critérios como exemplo, aplicados só à empresa fictícia, sem cor de veredito", () => {
    const { container } = render(<PainelDeCriterios />);
    const texto = limpo(container.textContent);
    expect(screen.getByRole("heading", { name: "Critérios de exemplo" })).toBeTruthy();
    expect(texto).toContain("Cada pessoa escolhe os seus, e o site não avalia ativos.");
    expect(texto).toContain("Empresa Exemplo S.A., a empresa fictícia");
    expect(container.querySelector(".text-gain-ink, .text-loss-ink")).toBeNull();
  });

  it("continua com o link da carteira", () => {
    render(<PainelDeCriterios />);
    expect(screen.getByRole("link", { name: "Ver os indicadores da minha carteira" }).getAttribute("href")).toBe("/indicadores");
  });
});
