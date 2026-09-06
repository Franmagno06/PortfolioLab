import { describe, expect, it } from "vitest";
import { selecionarSecoesRelevantes, selecionarTrechos } from "./trechos.js";

// Um relatório de banco tem 760 mil caracteres. Mandar isso inteiro a cada
// pergunta do chat custa ~217 mil tokens por turno e estoura o limite por
// minuto da API. Estes testes cobrem o recorte que resolve isso.
describe("selecionarTrechos", () => {
  it("devolve o texto inteiro quando ele já cabe", () => {
    const curto = "O lucro líquido foi de R$ 3,4 bilhões.";
    expect(selecionarTrechos(curto, "qual o lucro?", 10_000)).toBe(curto);
  });

  it("prefere o trecho que responde à pergunta", () => {
    const texto = [
      "A governança do fundo é exercida pelo administrador.",
      "A vacância física encerrou o trimestre em 8,2%, ante 9,1% no anterior.",
      "O regulamento prevê assembleia anual de cotistas.",
    ].join("\n\n");

    const saida = selecionarTrechos(texto, "como está a vacância?", 120);

    expect(saida).toContain("vacância física encerrou");
    expect(saida).not.toContain("assembleia anual");
  });

  it("respeita o limite de caracteres", () => {
    const bloco = "inadimplência ".repeat(50);
    const texto = Array.from({ length: 40 }, (_, i) => `${bloco} bloco ${i}`).join("\n\n");

    const saida = selecionarTrechos(texto, "inadimplência", 2000);

    expect(saida.length).toBeLessThanOrEqual(2000);
  });

  it("ignora palavras curtas e comuns da pergunta", () => {
    // "de", "o", "a" casariam com tudo e anulariam a seleção
    const texto = [
      "O documento foi elaborado de acordo com as normas.",
      "O índice de Basileia encerrou o período em 14,23%.",
    ].join("\n\n");

    const saida = selecionarTrechos(texto, "qual é o índice de Basileia?", 80);

    expect(saida).toContain("Basileia");
  });

  it("mantém a ordem original dos trechos escolhidos", () => {
    const texto = [
      "Primeiro: a inadimplência subiu.",
      "Meio: texto sem relação com nada.",
      "Terceiro: a inadimplência caiu no fim.",
    ].join("\n\n");

    const saida = selecionarTrechos(texto, "inadimplência", 200);

    expect(saida.indexOf("Primeiro")).toBeLessThan(saida.indexOf("Terceiro"));
  });

  it("sem termo útil na pergunta, devolve o começo do documento", () => {
    // O começo costuma trazer capa, sumário e destaques do período
    const texto = Array.from({ length: 30 }, (_, i) => `bloco numero ${i}`).join("\n\n");

    const saida = selecionarTrechos(texto, "e aí?", 60);

    expect(saida).toContain("bloco numero 0");
  });

  it("não estoura com texto vazio", () => {
    expect(selecionarTrechos("", "qualquer coisa", 100)).toBe("");
  });
});

// A análise inicial não tem pergunta para se guiar: o recorte precisa achar
// sozinho onde está o conteúdo financeiro do documento.
describe("selecionarSecoesRelevantes", () => {
  const juridiquês =
    "O presente instrumento rege-se pelas disposicoes do regulamento e pelas " +
    "normas aplicaveis, observadas as deliberacoes da assembleia geral. ".repeat(40);
  const financeiro =
    "O lucro liquido ajustado somou R$ 3,4 bilhoes, queda de 53,5% em doze meses. " +
    "A margem financeira bruta atingiu R$ 27,4 bilhoes, alta de 14,8%. " +
    "A inadimplencia acima de 90 dias encerrou em 5,05% ante 3,63%. ".repeat(35);

  it("devolve o texto inteiro quando ele já cabe", () => {
    const curto = "Lucro de R$ 10 milhões no trimestre.";
    expect(selecionarSecoesRelevantes(curto, 10_000)).toBe(curto);
  });

  it("prefere a seção com números e termos de resultado", () => {
    const texto = [juridiquês, financeiro, juridiquês].join("\n\n");

    const saida = selecionarSecoesRelevantes(texto, financeiro.length + 200);

    expect(saida).toContain("lucro liquido ajustado");
    expect(saida).not.toContain("assembleia geral");
  });

  it("respeita o limite de caracteres", () => {
    const texto = Array.from({ length: 30 }, () => financeiro).join("\n\n");

    expect(selecionarSecoesRelevantes(texto, 5000).length).toBeLessThanOrEqual(5000);
  });

  it("mantém a ordem original das seções escolhidas", () => {
    const texto = [
      "Abertura: o lucro liquido do periodo foi de R$ 1,0 bilhao, alta de 10,0%. ".repeat(30),
      juridiquês,
      "Fechamento: a margem financeira encerrou em R$ 2,0 bilhoes, queda de 5,0%. ".repeat(30),
    ].join("\n\n");

    // cabe a abertura e o fechamento, mas não o juridiquês do meio
    const saida = selecionarSecoesRelevantes(texto, 5000);

    expect(saida.indexOf("Abertura")).toBeLessThan(saida.indexOf("Fechamento"));
  });

  it("não descarta o começo do documento, onde ficam capa e destaques", () => {
    // O primeiro bloco quase não tem número, mas carrega a identificação do
    // documento — sem ele a IA não sabe de quem é o relatório nem de que período
    const abertura =
      "Banco do Brasil S.A. Analise do Desempenho Primeiro Trimestre de 2026. ".repeat(30);
    const texto = [abertura, ...Array.from({ length: 20 }, () => financeiro)].join("\n\n");

    const saida = selecionarSecoesRelevantes(texto, 4000);

    expect(saida).toContain("Analise do Desempenho");
  });

  it("não estoura com texto vazio", () => {
    expect(selecionarSecoesRelevantes("", 100)).toBe("");
  });
});
