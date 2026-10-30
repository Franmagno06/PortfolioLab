import { describe, expect, it } from "vitest";
import {
  analisarRelatorioDeterministico,
  enxugarHistorico,
  responderBuscaContextual,
} from "./gemini.js";

describe("motor determinístico de relatórios (gemini.ts)", () => {
  it("enxugarHistorico trunca mensagens e limita quantidade", () => {
    const historico = [
      { content: "msg1" },
      { content: "msg2" },
      { content: "msg3" },
      { content: "msg4" },
      { content: "msg5" },
      { content: "msg6" },
      { content: "msg7" },
    ];
    const enxugado = enxugarHistorico(historico);
    expect(enxugado).toHaveLength(6);
    expect(enxugado[0]?.content).toBe("msg2");
  });

  it("analisarRelatorioDeterministico extrai tipo, indicadores e alertas", () => {
    const doc = `
      Relatório Gerencial de FII - Fundo Imobiliário ABC
      O fundo apresentou Dividend Yield de 0,85% no mês.
      P/VP fechou em 0,95.
      Houve emissão de cotas recentemente.
      O lucro líquido operacional foi positivo e a distribuição foi mantida.
    `;
    const analise = analisarRelatorioDeterministico(doc, "ABC11.pdf");
    expect(analise.tipoDocumento).toBe("Relatório Gerencial de FII");
    expect(analise.indicadores).toEqual(
      expect.arrayContaining([
        { nome: "Dividend Yield", valor: "0,85%" },
        { nome: "P/VP", valor: "0,95" },
      ]),
    );
    expect(analise.alertas.some((a) => a.titulo.includes("Emissão de cotas"))).toBe(true);
    expect(analise.resumoExecutivo.length).toBeGreaterThan(0);
  });

  it("responderBuscaContextual localiza os trechos relevantes sem IA", () => {
    const doc = `
      A vacância física do portfólio recuou para 4,2% neste trimestre.
      As receitas de locação totalizaram R$ 45 milhões.
      O endividamento permanece controlado com alavancagem de 12%.
    `;
    const resposta = responderBuscaContextual("relatorio.pdf", doc, "vacância física");
    expect(resposta).toContain("Busca Contextual no Documento");
    expect(resposta).toContain("vacância física");
  });
});
