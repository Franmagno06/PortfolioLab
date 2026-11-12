import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ehAnaliseAtual, VERSAO_DA_ANALISE } from "./analise.js";
import type { DadosAcao, DadosFii } from "./cvm.provider.js";
import { INFORME_DE_FII, ITR_DE_BANCO, ITR_DE_INDUSTRIA, informeCom } from "./dados-de-teste.js";
import { formatarFracao, formatarReais, montarAnalise, variacao } from "./resumo-cvm.js";

type A = ReturnType<typeof montarAnalise>;
const d = (v: string | number) => new Prisma.Decimal(v);
const valorDe = (a: A, nome: string) => a.indicadores.find((i) => i.nome === nome)?.valor;
const definicaoDe = (a: A, nome: string) => a.indicadores.find((i) => i.nome === nome)?.definicao;
const titulos = (a: A) => a.alertas.map((x) => x.titulo);
const destaques = (a: A) => a.destaques.map((x) => x.titulo);
/** Todas as frases dos blocos do resumo, na ordem. */
const resumo = (a: A) => a.blocos.flatMap((b) => b.itens);

/** Troca os valores de uma conta do resultado ou do balanço, sem alterar o original. */
function com(dados: DadosAcao, codigo: string, atual: string | null, anterior?: string | null): DadosAcao {
  const troca = (c: DadosAcao["resultado"][number]) =>
    c.codigo === codigo
      ? { ...c, atual: atual === null ? null : d(atual), anterior: anterior === undefined ? c.anterior : anterior === null ? null : d(anterior) }
      : c;
  return { ...dados, resultado: dados.resultado.map(troca), balanco: dados.balanco.map(troca) };
}

describe("formatação", () => {
  it("reais em trilhões, bilhões, milhões e por extenso, com o sinal", () => {
    expect(formatarReais(d("2588100000000"))).toBe("R$ 2,59 tri");
    expect(formatarReais(d("78450000000"))).toBe("R$ 78,45 bi");
    expect(formatarReais(d("312100000"))).toBe("R$ 312,10 mi");
    expect(formatarReais(d("4500"))).toBe("R$ 4.500,00");
    expect(formatarReais(d("-2500000000"))).toBe("R$ -2,50 bi");
  });

  it("fração da CVM vira percentual", () => {
    expect(formatarFracao(d("0.004342"))).toBe("0,43%");
    expect(formatarFracao(d("0.2"), 1)).toBe("20,0%");
  });

  it("variação tem sinal, e não existe sem base", () => {
    expect(variacao(d(125), d(100))).toBe("+25,0%");
    expect(variacao(d(75), d(100))).toBe("-25,0%");
    expect(variacao(d(100), d(0))).toBeNull();
    // o que arredonda para zero sai sem sinal, vindo de cima ou de baixo
    expect(variacao(d(100), d(100))).toBe("0,0%");
    expect(variacao(d("99.97"), d(100))).toBe("0,0%");
    expect(variacao(d("100.04"), d(100))).toBe("0,0%");
    expect(variacao(d(100), null)).toBeNull();
  });

  it("variação sobre base negativa usa o módulo da base: de -100 para -50 é melhora de 50%", () => {
    expect(variacao(d(-50), d(-100))).toBe("+50,0%");
  });
});

describe("montarAnalise: ação", () => {
  it("carrega a versão das regras, a data-base e o link do documento", () => {
    const a = montarAnalise(ITR_DE_BANCO, "1T26");

    expect(VERSAO_DA_ANALISE).toBe(3);
    expect(a.versao).toBe(VERSAO_DA_ANALISE);
    expect(ehAnaliseAtual(a)).toBe(true);
    expect(a.tipoDocumento).toBe("Informações Trimestrais (ITR)");
    expect(a.dataReferencia).toBe("2026-03-31");
    expect(a.link).toBe(ITR_DE_BANCO.link);
  });

  it("indústria: margem líquida e retorno do trimestre saem da conta, e o nome diz que é do trimestre", () => {
    const a = montarAnalise(ITR_DE_INDUSTRIA, "2T26");

    expect(valorDe(a, "Receita de Venda de Bens e/ou Serviços")).toBe("R$ 1,00 bi (+25,0%)");
    expect(valorDe(a, "Lucro/Prejuízo Consolidado do Período")).toBe("R$ 200,00 mi (+25,0%)");
    expect(valorDe(a, "Margem líquida")).toBe("20,0%"); // 200 mi / 1 bi
    expect(valorDe(a, "Retorno sobre o patrimônio no trimestre")).toBe("10,0%"); // 200 mi / 2 bi
    expect(valorDe(a, "Patrimônio líquido")).toBe("R$ 2,00 bi (+5,3%)");
    expect(valorDe(a, "Ativo total")).toBe("R$ 5,00 bi (0,0%)");
    expect(resumo(a).join(" ")).toContain("sem anualizar");
    expect(resumo(a)[0]).toContain("demonstrações individuais do trimestre encerrado em 30 de junho de 2026");
  });

  it("o resumo vem em blocos: o documento, o resultado e o balanço", () => {
    const a = montarAnalise(ITR_DE_INDUSTRIA, "2T26");

    expect(a.blocos.map((b) => b.titulo)).toEqual(["O documento", "Resultado do trimestre", "Balanço na data-base"]);
    const [documento, resultado, balanco] = a.blocos;
    // o bloco do documento explica o que é o ITR e o que "individuais" quer dizer
    expect(documento?.itens.join(" ")).toContain("Informações Trimestrais");
    expect(documento?.itens.join(" ")).toContain("sem somar as controladas");
    expect(resultado?.itens.some((l) => l.startsWith("Margem líquida"))).toBe(true);
    expect(balanco?.itens.some((l) => l.startsWith("Patrimônio líquido"))).toBe(true);
  });

  it("o balanço mostra as obrigações com terceiros: ativo total menos patrimônio líquido", () => {
    const a = montarAnalise(ITR_DE_INDUSTRIA, "2T26");
    // 5 bi - 2 bi = 3 bi, 60% do ativo
    expect(a.blocos[2]?.itens).toContain(
      "Obrigações com terceiros (ativo total menos patrimônio líquido): R$ 3,00 bi, 60,0% do ativo.",
    );
  });

  it("DFP: o bloco do documento diz que é o exercício inteiro, auditado, e o bloco do resultado é do exercício", () => {
    const a = montarAnalise({ ...ITR_DE_INDUSTRIA, documento: "DFP", consolidado: true, dataReferencia: "2025-12-31" }, "4T25");

    expect(a.blocos.map((b) => b.titulo)).toEqual(["O documento", "Resultado do exercício", "Balanço na data-base"]);
    expect(a.blocos[0]?.itens.join(" ")).toContain("auditor independente");
    expect(a.blocos[0]?.itens.join(" ")).toContain("somam a companhia e as controladas");
  });

  it("cada indicador traz uma definição neutra da conta", () => {
    const a = montarAnalise(ITR_DE_INDUSTRIA, "2T26");

    expect(a.indicadores.every((i) => i.definicao.length > 0)).toBe(true);
    expect(definicaoDe(a, "Margem líquida")).toBe("Lucro ÷ receita, no mesmo período.");
    expect(definicaoDe(a, "Retorno sobre o patrimônio no trimestre")).toContain("sem anualizar");
    expect(definicaoDe(a, "Patrimônio líquido")).toContain("ativo total menos");
  });

  it("banco: sem margem líquida, porque a conta 3.01 é receita de intermediação, e a definição diz isso", () => {
    const a = montarAnalise(ITR_DE_BANCO, "1T26");

    expect(valorDe(a, "Margem líquida")).toBeUndefined();
    expect(resumo(a).join(" ")).not.toContain("Margem líquida");
    expect(valorDe(a, "Retorno sobre o patrimônio no trimestre")).toBe("5,0%"); // 9 bi / 180 bi
    expect(definicaoDe(a, "Receitas de Intermediação Financeira")).toContain("custo de captação");
  });

  it("lucro dos controladores, quando existe, é o lucro mostrado", () => {
    const dados: DadosAcao = {
      ...ITR_DE_BANCO,
      resultado: [
        ...ITR_DE_BANCO.resultado,
        { codigo: "3.11.01", conta: "Atribuído a Sócios da Empresa Controladora", atual: d("8500000000"), anterior: d("8500000000") },
      ],
    };
    const a = montarAnalise(dados, "1T26");

    expect(valorDe(a, "Lucro líquido atribuído aos controladores")).toBe("R$ 8,50 bi (0,0%)");
    expect(definicaoDe(a, "Lucro líquido atribuído aos controladores")).toContain("minoritários");
  });

  it("DFP compara com o exercício anterior e chama o retorno de 'no exercício'", () => {
    const a = montarAnalise({ ...ITR_DE_INDUSTRIA, documento: "DFP", dataReferencia: "2025-12-31" }, "4T25");

    expect(a.tipoDocumento).toBe("Demonstrações Financeiras Padronizadas (DFP)");
    expect(valorDe(a, "Retorno sobre o patrimônio no exercício")).toBe("10,0%");
    expect(resumo(a).join(" ")).toContain("contra o exercício anterior");
    expect(resumo(a).join(" ")).not.toContain("sem anualizar");
  });

  it("sem queda nem prejuízo, não há ponto de atenção nem crítico", () => {
    expect(montarAnalise(ITR_DE_INDUSTRIA, "2T26").alertas).toEqual([]);
  });

  it("prejuízo é crítico, com o critério, e não vira também 'lucro em queda'", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "-50000000"), "2T26");

    expect(titulos(a)).toEqual(["Prejuízo no período"]);
    expect(a.alertas[0]?.severidade).toBe("critico");
    expect(a.alertas[0]?.detalhe).toContain("R$ -50,00 mi");
    expect(a.alertas[0]?.criterio).toBe("lucro do período abaixo de zero");
    expect(valorDe(a, "Margem líquida")).toBe("-5,0%");
  });

  it("receita 15% abaixo da base vira atenção; 14,9% não", () => {
    const quinze = montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "850000000", "1000000000"), "2T26");
    expect(titulos(quinze)).toContain("Receita 15% ou mais abaixo da base de comparação");
    expect(quinze.alertas[0]?.criterio).toBe("receita 15% ou mais abaixo da base de comparação");
    expect(titulos(montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "851000000", "1000000000"), "2T26"))).toEqual([]);
  });

  it("lucro 15% abaixo da base vira atenção, com o tamanho da queda no detalhe", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "120000000", "200000000"), "2T26");

    expect(titulos(a)).toEqual(["Lucro 15% ou mais abaixo da base de comparação"]);
    expect(a.alertas[0]?.detalhe).toContain("recuou 40% contra o mesmo trimestre do ano anterior");
    expect(a.alertas[0]?.criterio).toBe("lucro 15% ou mais abaixo da base de comparação, com lucro nos dois períodos");
  });

  it("lucro depois de prejuízo na base não gera alerta de queda (variação sobre base negativa não diz nada)", () => {
    expect(montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "10000000", "-200000000"), "2T26").alertas).toEqual([]);
  });

  it("receita com base zero ou negativa não gera alerta nem destaque", () => {
    for (const base of ["0", "-1000000"]) {
      const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "500000000", base), "2T26");
      expect(titulos(a)).toEqual([]);
      expect(destaques(a)).not.toContain("Receita 15% ou mais acima da base de comparação");
    }
  });

  it("patrimônio líquido negativo é crítico e não entra em conta de retorno", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "2.03", "-100000000"), "2T26");

    expect(titulos(a)).toContain("Patrimônio líquido negativo");
    expect(a.alertas.find((x) => x.titulo === "Patrimônio líquido negativo")?.criterio).toBe("patrimônio líquido abaixo de zero");
    expect(valorDe(a, "Retorno sobre o patrimônio no trimestre")).toBeUndefined();
  });

  it("patrimônio ou receita zerados não viram divisão por zero (no Decimal, zero conta como 'positivo')", () => {
    const semPl = montarAnalise(com(ITR_DE_INDUSTRIA, "2.03", "0"), "2T26");
    const semReceita = montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "0"), "2T26");

    expect(valorDe(semPl, "Retorno sobre o patrimônio no trimestre")).toBeUndefined();
    expect(valorDe(semReceita, "Margem líquida")).toBeUndefined();
  });

  it("conta sem valor atual não quebra nem inventa: sai 'não informado' e some das contas derivadas", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", null), "2T26");

    expect(valorDe(a, "Receita de Venda de Bens e/ou Serviços")).toBe("não informado");
    expect(valorDe(a, "Margem líquida")).toBeUndefined();
  });
});

describe("destaques do período: ação", () => {
  it("indústria crescendo: receita e lucro acima do corte, lucro no período e patrimônio maior", () => {
    const a = montarAnalise(ITR_DE_INDUSTRIA, "2T26");

    expect(destaques(a)).toEqual([
      "Receita 15% ou mais acima da base de comparação",
      "Lucro no período",
      "Lucro 15% ou mais acima da base de comparação",
      "Patrimônio líquido maior que no fim do exercício anterior",
    ]);
    expect(a.destaques.map((x) => x.criterio)).toEqual([
      "receita 15% ou mais acima da base de comparação",
      "lucro do período acima de zero",
      "lucro 15% ou mais acima da base de comparação, com lucro nos dois períodos",
      "patrimônio líquido acima do fim do exercício anterior",
    ]);
    expect(a.destaques[0]?.detalhe).toBe("Receita de Venda de Bens e/ou Serviços subiu 25% contra o mesmo trimestre do ano anterior.");
    expect(a.destaques[3]?.detalhe).toBe("De R$ 1,90 bi para R$ 2,00 bi (+5,3%).");
  });

  it("corte da receita: 15% acima entra; 14,9% não", () => {
    expect(destaques(montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "1150000000", "1000000000"), "2T26"))).toContain(
      "Receita 15% ou mais acima da base de comparação",
    );
    expect(destaques(montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "1149000000", "1000000000"), "2T26"))).not.toContain(
      "Receita 15% ou mais acima da base de comparação",
    );
  });

  it("corte do lucro: 15% acima entra; 14,9% não, mas o lucro no período continua", () => {
    const quinze = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "230000000", "200000000"), "2T26");
    const quase = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "229800000", "200000000"), "2T26");

    expect(destaques(quinze)).toContain("Lucro 15% ou mais acima da base de comparação");
    expect(destaques(quase)).not.toContain("Lucro 15% ou mais acima da base de comparação");
    expect(destaques(quase)).toContain("Lucro no período");
  });

  it("lucro depois de prejuízo na base: lucro no período, sem variação sobre base negativa", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "10000000", "-200000000"), "2T26");

    expect(destaques(a)).toContain("Lucro no período");
    expect(destaques(a)).not.toContain("Lucro 15% ou mais acima da base de comparação");
    expect(a.destaques.find((x) => x.titulo === "Lucro no período")?.detalhe).toBe(
      "Lucro/Prejuízo Consolidado do Período: R$ 10,00 mi. Na base de comparação, o resultado foi de R$ -200,00 mi.",
    );
  });

  it("lucro com base zero não gera destaque de variação", () => {
    expect(destaques(montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "10000000", "0"), "2T26"))).not.toContain(
      "Lucro 15% ou mais acima da base de comparação",
    );
  });

  it("prejuízo ou lucro zero não é destaque de lucro", () => {
    for (const valor of ["-50000000", "0"]) {
      const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", valor), "2T26");
      expect(destaques(a).filter((t) => t.startsWith("Lucro"))).toEqual([]);
    }
  });

  it("patrimônio: menor, igual no arredondamento ou vindo de base negativa não é destaque", () => {
    const pl = (atual: string, anterior: string) =>
      destaques(montarAnalise(com(ITR_DE_INDUSTRIA, "2.03", atual, anterior), "2T26")).filter((t) => t.startsWith("Patrimônio"));

    expect(pl("1800000000", "1900000000")).toEqual([]);
    expect(pl("1900000500", "1900000000")).toEqual([]); // +0,00003%: sai "0,0%", não é movimento
    expect(pl("100000000", "-50000000")).toEqual([]);
    expect(pl("1919000000", "1900000000")).toEqual(["Patrimônio líquido maior que no fim do exercício anterior"]); // +1,0%
  });
});

describe("montarAnalise: fundo imobiliário", () => {
  it("indicadores do informe, com variação no mês só para o que não é taxa", () => {
    const a = montarAnalise(INFORME_DE_FII, "março de 2026");

    expect(a.tipoDocumento).toBe("Informe Mensal de FII");
    expect(a.link).toBeNull();
    expect(a.dataReferencia).toBe("2026-03-01");
    expect(valorDe(a, "Patrimônio líquido")).toBe("R$ 950,00 mi (+1,1% no mês)");
    expect(valorDe(a, "Valor patrimonial por cota")).toBe("R$ 9,50 (+1,1% no mês)");
    expect(valorDe(a, "Dividend yield do mês")).toBe("1,00%");
    expect(valorDe(a, "Número de cotistas")).toBe("500.000 (+2,0% no mês)");
    expect(resumo(a)[0]).toBe(
      "FUNDO EXEMPLO RECEBÍVEIS FII: informe mensal de março de 2026 (segmento Títulos e Valores Mobiliários, mandato Títulos e Valores Mobiliários, gestão Ativa).",
    );
  });

  it("o resumo vem em blocos, e cada indicador tem definição", () => {
    const a = montarAnalise(INFORME_DE_FII, "março de 2026");

    expect(a.blocos.map((b) => b.titulo)).toEqual(["O informe", "Patrimônio e cotas", "Rendimento do mês", "Carteira e passivo"]);
    expect(a.blocos[0]?.itens.join(" ")).toContain("entrega à CVM todo mês");
    expect(a.indicadores.every((i) => i.definicao.length > 0)).toBe(true);
    expect(definicaoDe(a, "Valor patrimonial por cota")).toBe("Patrimônio líquido ÷ número de cotas emitidas.");
  });

  it("o fundo de exemplo não tem ponto de atenção", () => {
    expect(montarAnalise(INFORME_DE_FII, "março de 2026").alertas).toEqual([]);
  });

  const comMes = (campos: Parameters<typeof informeCom>[1]): DadosFii => ({
    ...INFORME_DE_FII,
    mes: informeCom(INFORME_DE_FII.mes, campos),
  });

  it("dividend yield menor que o do mês anterior, com o critério", () => {
    const a = montarAnalise(comMes({ dividendYieldMes: "0.008" }), "março de 2026");

    expect(titulos(a)).toEqual(["Dividend yield menor que no mês anterior"]);
    expect(a.alertas[0]?.detalhe).toBe("Passou de 1,00% para 0,80%.");
    expect(a.alertas[0]?.criterio).toBe("dividend yield do mês abaixo do informado no mês anterior");
  });

  it("passivo acima de 15% do ativo, e o detalhe explica o que entra no passivo", () => {
    const a = montarAnalise(comMes({ totalPassivo: "200000000" }), "março de 2026");

    expect(titulos(a)).toEqual(["Passivo acima de 15% do ativo"]);
    expect(a.alertas[0]?.detalhe).toContain("equivale a 20,0% do ativo");
    expect(a.alertas[0]?.criterio).toBe("passivo total acima de 15% do ativo do fundo");
    // exatamente 15% não passa do corte
    expect(montarAnalise(comMes({ totalPassivo: "150000000" }), "março de 2026").alertas).toEqual([]);
  });

  it("disponibilidades perto de zero não viram alerta: é assim em quase todo fundo", () => {
    expect(montarAnalise(comMes({ disponibilidades: "0.19" }), "março de 2026").alertas).toEqual([]);
    expect(montarAnalise(comMes({ disponibilidades: "-0.03" }), "março de 2026").alertas).toEqual([]);
  });

  const composicao = (a: A) => resumo(a).find((l) => l.startsWith("Composição do ativo"));

  it("composição do ativo: cada grupo com a fatia, e resíduo (menos de 0,5%) fica de fora", () => {
    // ativo de 1 bi: 900 mi em CRI (90%), 20 mi em disponibilidades (2%)
    expect(composicao(montarAnalise(INFORME_DE_FII, "março de 2026"))).toBe(
      "Composição do ativo: títulos de crédito imobiliário (CRI, LCI e similares), R$ 900,00 mi (90,0% do ativo); caixa e aplicações de liquidez, R$ 20,00 mi (2,0% do ativo).",
    );
    // centavos em disponibilidades e R$ 0,00 em imóveis somem da frase
    expect(composicao(montarAnalise(comMes({ disponibilidades: "0.19", imoveisParaRenda: "0.004" }), "março de 2026"))).toBe(
      "Composição do ativo: títulos de crédito imobiliário (CRI, LCI e similares), R$ 900,00 mi (90,0% do ativo).",
    );
  });

  it("composição usa os totais por grupo quando o informe os traz (somam várias colunas)", () => {
    const a = montarAnalise(comMes({ imoveisTotal: "600000000", papelTotal: "300000000", liquidezTotal: "100000000" }), "março de 2026");

    expect(composicao(a)).toBe(
      "Composição do ativo: imóveis, R$ 600,00 mi (60,0% do ativo); títulos de crédito imobiliário (CRI, LCI e similares), R$ 300,00 mi (30,0% do ativo); caixa e aplicações de liquidez, R$ 100,00 mi (10,0% do ativo).",
    );
  });

  it("menos cotistas e novas cotas ficam no bloco de patrimônio e cotas, não entre os pontos", () => {
    const a = montarAnalise(comMes({ cotistas: "480000", cotasEmitidas: "110000000" }), "março de 2026");
    const cotas = a.blocos.find((b) => b.titulo === "Patrimônio e cotas")?.itens.join(" ") ?? "";

    expect(a.alertas).toEqual([]);
    expect(cotas).toContain("Cotistas: 480.000, -2,0% contra o mês anterior");
    expect(cotas).toContain("Cotas emitidas: 110.000.000 (eram 100.000.000 no mês anterior)");
    expect(cotas).toContain("divide os rendimentos por mais cotas");
  });

  it("sem o mês anterior, não há variação, alerta nem destaque de comparação", () => {
    const a = montarAnalise({ ...INFORME_DE_FII, mesAnterior: null }, "março de 2026");

    expect(valorDe(a, "Patrimônio líquido")).toBe("R$ 950,00 mi");
    expect(a.alertas).toEqual([]);
    expect(a.destaques).toEqual([]);
  });

  it("ativo zerado não vira divisão por zero", () => {
    expect(() => montarAnalise(comMes({ valorAtivo: "0" }), "março de 2026")).not.toThrow();
  });
});

describe("destaques do período: fundo imobiliário", () => {
  const comMeses = (mes: Parameters<typeof informeCom>[1], anterior: Parameters<typeof informeCom>[1] = {}): DadosFii => ({
    ...INFORME_DE_FII,
    mes: informeCom(INFORME_DE_FII.mes, mes),
    mesAnterior: informeCom(INFORME_DE_FII.mesAnterior!, anterior),
  });

  it("valor patrimonial por cota maior que no mês anterior, com o critério e os dois números", () => {
    const a = montarAnalise(INFORME_DE_FII, "março de 2026");

    expect(destaques(a)).toEqual(["Valor patrimonial por cota maior que no mês anterior"]);
    expect(a.destaques[0]?.detalhe).toBe("De R$ 9,40 para R$ 9,50 (+1,1%).");
    expect(a.destaques[0]?.criterio).toBe("valor patrimonial por cota acima do informado no mês anterior");
  });

  it("dividend yield maior que no mês anterior", () => {
    const a = montarAnalise(comMeses({ dividendYieldMes: "0.012" }), "março de 2026");

    expect(destaques(a)).toContain("Dividend yield maior que no mês anterior");
    expect(a.destaques.find((x) => x.titulo.startsWith("Dividend"))?.detalhe).toBe("Passou de 1,00% para 1,20%.");
    expect(a.destaques.find((x) => x.titulo.startsWith("Dividend"))?.criterio).toBe(
      "dividend yield do mês acima do informado no mês anterior",
    );
  });

  it("dividend yield que só muda depois da segunda casa do percentual não é destaque nem atenção", () => {
    const acima = montarAnalise(comMeses({ dividendYieldMes: "0.01001" }), "março de 2026");
    const abaixo = montarAnalise(comMeses({ dividendYieldMes: "0.00999" }), "março de 2026");

    expect(destaques(acima)).not.toContain("Dividend yield maior que no mês anterior");
    expect(titulos(abaixo)).not.toContain("Dividend yield menor que no mês anterior");
  });

  it("rentabilidade efetiva maior que no mês anterior; sem o dado do mês anterior, nada", () => {
    expect(destaques(montarAnalise(comMeses({}, { rentabilidadeEfetivaMes: "0.008" }), "março de 2026"))).toContain(
      "Rentabilidade efetiva maior que no mês anterior",
    );
    // o mês anterior do exemplo não traz rentabilidade
    expect(destaques(montarAnalise(INFORME_DE_FII, "março de 2026"))).not.toContain("Rentabilidade efetiva maior que no mês anterior");
  });

  it("valor por cota menor, igual ou com base zero não é destaque", () => {
    const cota = (atual: string, anterior: string) =>
      destaques(montarAnalise(comMeses({ valorPatrimonialCota: atual }, { valorPatrimonialCota: anterior }), "março de 2026"));

    expect(cota("9.3", "9.4")).toEqual([]);
    expect(cota("9.4", "9.4")).toEqual([]);
    expect(cota("9.5", "0")).toEqual([]);
  });
});

describe("as frases não julgam nem recomendam", () => {
  const PROIBIDAS =
    /saud[aá]vel|robust|consistente|excelente|preocupante|barat|car[oa]\b|compr[ae]|vend[ae]r|recomend|oportunidade|no vermelho|bom sinal|mau sinal|\bbo[am]\b|\bbons\b|ruim|\bfort[ea]|\bfrac[oa]|\bmelhor|\bpior|positiv|atrativ|promissor|\bs[oó]lid|sustent[aá]vel|vale a pena|merece|aten[cç][aã]o redobrada/i;

  const casos: [string, A][] = [
    ["banco", montarAnalise(ITR_DE_BANCO, "1T26")],
    ["indústria crescendo", montarAnalise(ITR_DE_INDUSTRIA, "2T26")],
    ["indústria em DFP", montarAnalise({ ...ITR_DE_INDUSTRIA, documento: "DFP", consolidado: true, dataReferencia: "2025-12-31" }, "4T25")],
    ["indústria com prejuízo e queda", montarAnalise(com(com(ITR_DE_INDUSTRIA, "3.11", "-50000000"), "3.01", "500000000"), "2T26")],
    ["indústria saindo de prejuízo", montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "10000000", "-200000000"), "2T26")],
    ["fundo", montarAnalise(INFORME_DE_FII, "março de 2026")],
    [
      "fundo com todos os alertas",
      montarAnalise(
        {
          ...INFORME_DE_FII,
          mes: informeCom(INFORME_DE_FII.mes, {
            dividendYieldMes: "0.005",
            totalPassivo: "300000000",
            disponibilidades: "1000000",
            cotistas: "1",
            cotasEmitidas: "200000000",
          }),
        },
        "março de 2026",
      ),
    ],
    [
      "fundo com todos os destaques",
      montarAnalise(
        {
          ...INFORME_DE_FII,
          mes: informeCom(INFORME_DE_FII.mes, { dividendYieldMes: "0.02" }),
          mesAnterior: informeCom(INFORME_DE_FII.mesAnterior!, { rentabilidadeEfetivaMes: "0.001" }),
        },
        "março de 2026",
      ),
    ],
  ];

  it.each(casos)("%s", (_nome, a) => {
    const texto = [
      ...a.blocos.flatMap((b) => [b.titulo, ...b.itens]),
      ...a.alertas.flatMap((x) => [x.titulo, x.detalhe, x.criterio]),
      ...a.destaques.flatMap((x) => [x.titulo, x.detalhe, x.criterio]),
      ...a.indicadores.flatMap((i) => [i.nome, i.definicao]),
    ].join(" | ");
    expect(texto).not.toMatch(PROIBIDAS);
  });

  it("o filtro pega as palavras de juízo que deve pegar", () => {
    for (const frase of ["um bom sinal", "resultado forte", "receita fraca", "melhor trimestre", "número positivo", "Boa notícia", "base sólida"]) {
      expect(frase).toMatch(PROIBIDAS);
    }
  });
});

describe("ehAnaliseAtual", () => {
  it("recusa análise de versão anterior, sem versão (IA, seed antiga) e o que não é objeto", () => {
    expect(ehAnaliseAtual({ ...montarAnalise(ITR_DE_BANCO, "1T26"), versao: VERSAO_DA_ANALISE - 1 })).toBe(false);
    expect(ehAnaliseAtual({ tipoDocumento: "ITR — Informações Trimestrais (CVM)", resumoExecutivo: [], alertas: [], indicadores: [] })).toBe(false);
    expect(ehAnaliseAtual(null)).toBe(false);
    expect(ehAnaliseAtual("texto")).toBe(false);
  });
});
