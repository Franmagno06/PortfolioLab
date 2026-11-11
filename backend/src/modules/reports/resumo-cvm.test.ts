import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ehAnaliseAtual, VERSAO_DA_ANALISE } from "./analise.js";
import type { DadosAcao, DadosFii } from "./cvm.provider.js";
import { INFORME_DE_FII, ITR_DE_BANCO, ITR_DE_INDUSTRIA, informeCom } from "./dados-de-teste.js";
import { formatarFracao, formatarReais, montarAnalise, variacao } from "./resumo-cvm.js";

const d = (v: string | number) => new Prisma.Decimal(v);
const valorDe = (a: ReturnType<typeof montarAnalise>, nome: string) => a.indicadores.find((i) => i.nome === nome)?.valor;
const titulos = (a: ReturnType<typeof montarAnalise>) => a.alertas.map((x) => x.titulo);

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
    expect(a.resumoExecutivo.join(" ")).toContain("sem anualizar");
    expect(a.resumoExecutivo[0]).toContain("demonstrações individuais do trimestre encerrado em 30 de junho de 2026");
  });

  it("banco: sem margem líquida, porque a conta 3.01 é receita de intermediação", () => {
    const a = montarAnalise(ITR_DE_BANCO, "1T26");

    expect(valorDe(a, "Margem líquida")).toBeUndefined();
    expect(a.resumoExecutivo.join(" ")).not.toContain("Margem líquida");
    expect(valorDe(a, "Retorno sobre o patrimônio no trimestre")).toBe("5,0%"); // 9 bi / 180 bi
  });

  it("lucro dos controladores, quando existe, é o lucro mostrado", () => {
    const dados: DadosAcao = {
      ...ITR_DE_BANCO,
      resultado: [
        ...ITR_DE_BANCO.resultado,
        { codigo: "3.11.01", conta: "Atribuído a Sócios da Empresa Controladora", atual: d("8500000000"), anterior: d("8500000000") },
      ],
    };

    expect(valorDe(montarAnalise(dados, "1T26"), "Lucro líquido atribuído aos controladores")).toBe("R$ 8,50 bi (0,0%)");
  });

  it("DFP compara com o exercício anterior e chama o retorno de 'no exercício'", () => {
    const a = montarAnalise({ ...ITR_DE_INDUSTRIA, documento: "DFP", dataReferencia: "2025-12-31" }, "4T25");

    expect(a.tipoDocumento).toBe("Demonstrações Financeiras Padronizadas (DFP)");
    expect(valorDe(a, "Retorno sobre o patrimônio no exercício")).toBe("10,0%");
    expect(a.resumoExecutivo.join(" ")).toContain("contra o exercício anterior");
    expect(a.resumoExecutivo.join(" ")).not.toContain("sem anualizar");
  });

  it("sem queda nem prejuízo, não há ponto de atenção: crescer não é alerta", () => {
    expect(montarAnalise(ITR_DE_INDUSTRIA, "2T26").alertas).toEqual([]);
  });

  it("prejuízo é crítico, e não vira também 'lucro em queda'", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "-50000000"), "2T26");

    expect(titulos(a)).toEqual(["Prejuízo no período"]);
    expect(a.alertas[0]?.severidade).toBe("critico");
    expect(a.alertas[0]?.detalhe).toContain("R$ -50,00 mi");
    // margem e retorno negativos ficam de fora: o alerta já diz o que aconteceu
    expect(valorDe(a, "Margem líquida")).toBe("-5,0%");
  });

  it("receita 15% abaixo da base vira atenção; 14,9% não", () => {
    expect(titulos(montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "850000000", "1000000000"), "2T26"))).toContain(
      "Receita 15% ou mais abaixo da base de comparação",
    );
    expect(titulos(montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", "851000000", "1000000000"), "2T26"))).toEqual([]);
  });

  it("lucro 15% abaixo da base vira atenção, com o tamanho da queda no detalhe", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "120000000", "200000000"), "2T26");

    expect(titulos(a)).toEqual(["Lucro 15% ou mais abaixo da base de comparação"]);
    expect(a.alertas[0]?.detalhe).toContain("recuou 40% contra o mesmo trimestre do ano anterior");
  });

  it("lucro depois de prejuízo na base não gera alerta de queda (variação sobre base negativa não diz nada)", () => {
    expect(montarAnalise(com(ITR_DE_INDUSTRIA, "3.11", "10000000", "-200000000"), "2T26").alertas).toEqual([]);
  });

  it("patrimônio líquido negativo é crítico e não entra em conta de retorno", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "2.03", "-100000000"), "2T26");

    expect(titulos(a)).toContain("Patrimônio líquido negativo");
    expect(valorDe(a, "Retorno sobre o patrimônio no trimestre")).toBeUndefined();
  });

  it("conta sem valor atual não quebra nem inventa: sai 'não informado' e some das contas derivadas", () => {
    const a = montarAnalise(com(ITR_DE_INDUSTRIA, "3.01", null), "2T26");

    expect(valorDe(a, "Receita de Venda de Bens e/ou Serviços")).toBe("não informado");
    expect(valorDe(a, "Margem líquida")).toBeUndefined();
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
    expect(a.resumoExecutivo[0]).toBe(
      "FUNDO EXEMPLO RECEBÍVEIS FII: informe mensal de março de 2026 (segmento Títulos e Valores Mobiliários, mandato Títulos e Valores Mobiliários, gestão Ativa).",
    );
  });

  it("o fundo de exemplo não tem ponto de atenção", () => {
    expect(montarAnalise(INFORME_DE_FII, "março de 2026").alertas).toEqual([]);
  });

  const comMes = (campos: Parameters<typeof informeCom>[1]): DadosFii => ({
    ...INFORME_DE_FII,
    mes: informeCom(INFORME_DE_FII.mes, campos),
  });

  it("dividend yield menor que o do mês anterior", () => {
    const a = montarAnalise(comMes({ dividendYieldMes: "0.008" }), "março de 2026");

    expect(titulos(a)).toEqual(["Dividend yield menor que no mês anterior"]);
    expect(a.alertas[0]?.detalhe).toBe("Passou de 1,00% para 0,80%.");
  });

  it("passivo acima de 15% do ativo, e o detalhe explica o que entra no passivo", () => {
    const a = montarAnalise(comMes({ totalPassivo: "200000000" }), "março de 2026");

    expect(titulos(a)).toEqual(["Passivo acima de 15% do ativo"]);
    expect(a.alertas[0]?.detalhe).toContain("equivale a 20,0% do ativo");
    // exatamente 15% não passa do corte
    expect(montarAnalise(comMes({ totalPassivo: "150000000" }), "março de 2026").alertas).toEqual([]);
  });

  it("disponibilidades perto de zero não viram alerta: é assim em quase todo fundo", () => {
    expect(montarAnalise(comMes({ disponibilidades: "0.19" }), "março de 2026").alertas).toEqual([]);
    expect(montarAnalise(comMes({ disponibilidades: "-0.03" }), "março de 2026").alertas).toEqual([]);
  });

  const composicao = (a: ReturnType<typeof montarAnalise>) => a.resumoExecutivo.find((l) => l.startsWith("Composição do ativo"));

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

  it("menos cotistas e novas cotas são informação, com os dois números", () => {
    const a = montarAnalise(comMes({ cotistas: "480000", cotasEmitidas: "110000000" }), "março de 2026");

    expect(titulos(a)).toEqual(["Menos cotistas que no mês anterior", "Novas cotas emitidas no mês"]);
    expect(a.alertas[0]?.detalhe).toBe("De 490.000 para 480.000: 10.000 a menos.");
    expect(a.alertas[1]?.detalhe).toContain("De 100.000.000 para 110.000.000 cotas");
  });

  it("sem o mês anterior, não há variação nem alerta de comparação", () => {
    const a = montarAnalise({ ...INFORME_DE_FII, mesAnterior: null }, "março de 2026");

    expect(valorDe(a, "Patrimônio líquido")).toBe("R$ 950,00 mi");
    expect(a.alertas).toEqual([]);
  });

  it("ativo zerado não vira divisão por zero", () => {
    expect(() => montarAnalise(comMes({ valorAtivo: "0" }), "março de 2026")).not.toThrow();
  });
});

describe("as frases não julgam nem recomendam", () => {
  const PROIBIDAS = /saud[aá]vel|robust|consistente|excelente|preocupante|barat|car[oa]\b|compr[ae]|vend[ae]r|recomend|oportunidade|no vermelho/i;

  it.each([
    ["banco", montarAnalise(ITR_DE_BANCO, "1T26")],
    ["indústria com prejuízo e queda", montarAnalise(com(com(ITR_DE_INDUSTRIA, "3.11", "-50000000"), "3.01", "500000000"), "2T26")],
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
  ])("%s", (_nome, a) => {
    const texto = [...a.resumoExecutivo, ...a.alertas.flatMap((x) => [x.titulo, x.detalhe]), ...a.indicadores.map((i) => i.nome)].join(" | ");
    expect(texto).not.toMatch(PROIBIDAS);
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
