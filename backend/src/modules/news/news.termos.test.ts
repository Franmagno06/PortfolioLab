import { describe, expect, it } from "vitest";
import { citaAtivo, termosDoAtivo } from "./news.service.js";

// Os nomes abaixo são os que o Yahoo Finance devolveu de verdade para a
// carteira de demonstração. Testar contra o nome real é o ponto: o nome
// societário quase nunca é o que a imprensa escreve.
describe("termosDoAtivo", () => {
  it("mantém o ticker como termo, sempre", () => {
    expect(termosDoAtivo("PETR4", "Petróleo Brasileiro S.A. - Petrobras")).toContain("petr4");
  });

  it("descarta o sufixo societário", () => {
    expect(termosDoAtivo("KLBN4", "Klabin S.A.")).toContain("klabin");
  });

  it("aproveita a marca depois do hífen", () => {
    // "Cemig" é como a imprensa escreve; o nome longo raramente aparece
    const termos = termosDoAtivo("CMIG4", "Companhia Energética de Minas Gerais - CEMIG");
    expect(termos).toContain("cemig");
  });

  it("descarta a papelada de fundo no nome do FII", () => {
    expect(termosDoAtivo("KNRI11", "Kinea Renda Imobiliária Fundo de Investimento Imobiliário")).toContain(
      "kinea renda imobiliaria",
    );
    expect(termosDoAtivo("XPML11", "Xp Malls Fundo Investimentos Imobiliarios")).toContain("xp malls");
    expect(
      termosDoAtivo("VISC11", "Vinci Shopping Centers Fundo Investimento Imobiliario - Fii"),
    ).toContain("vinci shopping centers");
  });

  it("não deixa sobrar termo genérico que casaria com tudo", () => {
    // "Energia" sozinha apareceria em metade do noticiário do setor elétrico
    const termos = termosDoAtivo("XXXX3", "Energia S.A.");
    expect(termos).toEqual(["xxxx3"]);
  });

  it("não deixa sobrar termo curto demais", () => {
    expect(termosDoAtivo("XPBR31", "Xp S.A.")).toEqual(["xpbr31"]);
  });
});

describe("citaAtivo", () => {
  const termos = termosDoAtivo("BBAS3", "Banco do Brasil S.A.");

  it("acha o ticker no título", () => {
    expect(citaAtivo("Banco do Brasil (BBAS3) aprova dividendos", "", termos)).toBe(true);
  });

  it("acha o nome no título, sem depender de acento ou caixa", () => {
    expect(citaAtivo("BANCO DO BRASIL anuncia recompra", "", termos)).toBe(true);
  });

  it("acha o ativo no resumo quando o título não o cita", () => {
    // O caso que motivou a mudança: a manchete é genérica, o lead é que nomeia
    expect(
      citaAtivo(
        "Bancos puxam o Ibovespa nesta sexta",
        "O movimento veio de BBAS3, que subiu 3% após o balanço.",
        termos,
      ),
    ).toBe(true);
  });

  it("não casa notícia que não fala do ativo", () => {
    expect(citaAtivo("Bitcoin ronda os US$ 80 mil", "Criptomoedas em alta", termos)).toBe(false);
  });

  it("exige palavra inteira, não pedaço de outra", () => {
    // "banco do brasil" é prefixo de "banco do brasilia": sem limite de
    // palavra na busca, esta notícia entraria como se fosse do BBAS3
    expect(citaAtivo("Banco do Brasilia lança linha de crédito", "", termos)).toBe(false);
  });
});
