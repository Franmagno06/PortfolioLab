import { describe, expect, it } from "vitest";
import {
  agruparPorAtivo,
  blocosDoResumo,
  ehAnoInteiro,
  ehOficial,
  gruposDePontos,
  periodoAnterior,
  relatoriosAntigos,
  rotuloDoPeriodo,
  tabelaComparativa,
  type Relatorio,
} from "./relatorios";

let seq = 0;
function relatorio(ticker: string, period: string, indicadores: [string, string][] = [], extra: Partial<Relatorio> = {}): Relatorio {
  seq += 1;
  return {
    id: `r${seq}`,
    fileName: `${ticker} ${period}`,
    createdAt: `2026-11-10T12:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    source: "CVM",
    period,
    asset: { ticker, name: `Nome de ${ticker}`, type: ticker.endsWith("11") ? "FII" : "ACAO" },
    analysis: {
      versao: 2,
      tipoDocumento: "Informações Trimestrais (ITR)",
      resumoExecutivo: [],
      alertas: [],
      indicadores: indicadores.map(([nome, valor]) => ({ nome, valor })),
      dataReferencia: "2026-03-31",
      link: null,
    },
    ...extra,
  };
}

describe("rotuloDoPeriodo", () => {
  it.each([
    ["2026-T1", "1T26"],
    ["2025-T4", "4T25"],
    ["2026-03", "mar/26"],
    ["2026-12", "dez/26"],
  ])("%s vira %s", (chave, rotulo) => {
    expect(rotuloDoPeriodo(chave)).toBe(rotulo);
  });

  it("chave fora do formato sai como veio", () => {
    expect(rotuloDoPeriodo("2026")).toBe("2026");
    expect(rotuloDoPeriodo("2026-T5")).toBe("2026-T5");
    expect(rotuloDoPeriodo("2026-13")).toBe("2026-13");
  });
});

describe("periodoAnterior", () => {
  it.each([
    ["2026-T3", "2026-T2"],
    ["2026-T1", "2025-T4"],
    ["2026-03", "2026-02"],
    ["2026-10", "2026-09"],
    ["2026-01", "2025-12"],
  ])("antes de %s vem %s", (chave, anterior) => {
    expect(periodoAnterior(chave)).toBe(anterior);
  });

  it("o que não é período não tem anterior", () => {
    expect(periodoAnterior("abc")).toBeNull();
    expect(periodoAnterior("2026-T9")).toBeNull();
  });
});

describe("ehAnoInteiro", () => {
  it("só o 4º trimestre, que vem da demonstração anual", () => {
    expect(ehAnoInteiro("2025-T4")).toBe(true);
    expect(ehAnoInteiro("2026-T1")).toBe(false);
    expect(ehAnoInteiro("2026-04")).toBe(false);
  });
});

describe("ehOficial", () => {
  it("relatório da CVM com ativo, período e análise das regras atuais", () => {
    expect(ehOficial(relatorio("BBAS3", "2026-T1"))).toBe(true);
  });

  it.each([
    ["PDF enviado", { source: "PDF" as const }],
    ["sem ativo", { asset: null }],
    ["sem período", { period: null }],
    ["período fora do formato", { period: "1T26" }],
    ["sem análise", { analysis: null }],
    [
      "análise antiga, sem versão (IA ou seed antiga)",
      { analysis: { tipoDocumento: "ITR — Informações Trimestrais (CVM)", resumoExecutivo: [], alertas: [], indicadores: [] } },
    ],
  ])("não é oficial: %s", (_nome, extra) => {
    expect(ehOficial(relatorio("BBAS3", "2026-T1", [], extra))).toBe(false);
  });
});

describe("agruparPorAtivo", () => {
  it("um grupo por ativo, em ordem de ticker; dentro dele, do período mais recente para o mais antigo", () => {
    const grupos = agruparPorAtivo([
      relatorio("TAEE11", "2026-T1"),
      relatorio("BBAS3", "2025-T4"),
      relatorio("BBAS3", "2026-T2"),
      relatorio("BBAS3", "2026-T1"),
      relatorio("MXRF11", "2026-09"),
      relatorio("MXRF11", "2026-10"),
    ]);

    expect(grupos.map((g) => g.ticker)).toEqual(["BBAS3", "MXRF11", "TAEE11"]);
    expect(grupos[0]?.periodos.map((p) => p.period)).toEqual(["2026-T2", "2026-T1", "2025-T4"]);
    expect(grupos[1]?.periodos.map((p) => p.period)).toEqual(["2026-10", "2026-09"]);
    expect(grupos[0]).toMatchObject({ nome: "Nome de BBAS3", tipo: "ACAO" });
    expect(grupos[1]?.tipo).toBe("FII");
  });

  it("dois relatórios do mesmo ativo e período: fica o criado por último", () => {
    const velho = relatorio("BBAS3", "2026-T1", [["Lucro", "R$ 1,00 bi"]], { createdAt: "2026-05-01T12:00:00.000Z" });
    const novo = relatorio("BBAS3", "2026-T1", [["Lucro", "R$ 2,00 bi"]], { createdAt: "2026-11-01T12:00:00.000Z" });

    for (const lista of [[velho, novo], [novo, velho]]) {
      const [grupo] = agruparPorAtivo(lista);
      expect(grupo?.periodos).toHaveLength(1);
      expect(grupo?.periodos[0]?.id).toBe(novo.id);
    }
  });

  it("relatório antigo fica fora dos grupos e aparece em relatoriosAntigos", () => {
    const pdf = relatorio("MXRF11", "2026-03", [], { source: "PDF", fileName: "relatorio-gerencial.pdf" });
    const semVersao = relatorio("BBAS3", "2026-T1", [], {
      analysis: { tipoDocumento: "ITR", resumoExecutivo: ["texto antigo"], alertas: [], indicadores: [] },
    });
    const oficial = relatorio("BBAS3", "2026-T2");

    expect(agruparPorAtivo([pdf, semVersao, oficial]).map((g) => [g.ticker, g.periodos.length])).toEqual([["BBAS3", 1]]);
    expect(relatoriosAntigos([pdf, semVersao, oficial]).map((r) => r.id)).toEqual([pdf.id, semVersao.id]);
  });

  it("relatório sem análise nenhuma não aparece em lugar algum (não há o que mostrar)", () => {
    const vazio = relatorio("BBAS3", "2026-T1", [], { analysis: null });

    expect(agruparPorAtivo([vazio])).toEqual([]);
    expect(relatoriosAntigos([vazio])).toEqual([]);
  });

  it("lista vazia e lista só de antigos: nenhum grupo; não altera a lista recebida", () => {
    const lista = [relatorio("BBAS3", "2026-T1"), relatorio("BBAS3", "2026-T2")];
    const copia = [...lista];

    agruparPorAtivo(lista);

    expect(lista).toEqual(copia);
    expect(agruparPorAtivo([])).toEqual([]);
  });
});

describe("tabelaComparativa", () => {
  const doGrupo = (lista: Relatorio[]) => agruparPorAtivo(lista)[0]!.periodos;

  it("colunas do mais recente para o mais antigo, linhas na ordem do período mais recente", () => {
    const t = tabelaComparativa(
      doGrupo([
        relatorio("TAEE11", "2026-T1", [["Receita", "R$ 1,00 bi"], ["Lucro", "R$ 300,00 mi"]]),
        relatorio("TAEE11", "2026-T2", [["Receita", "R$ 1,07 bi (-15,4%)"], ["Lucro", "R$ 567,14 mi"], ["Margem líquida", "53,1%"]]),
      ]),
    );

    expect(t?.colunas.map((c) => c.rotulo)).toEqual(["2T26", "1T26"]);
    expect(t?.linhas).toEqual([
      { nome: "Receita", definicao: null, valores: ["R$ 1,07 bi (-15,4%)", "R$ 1,00 bi"] },
      { nome: "Lucro", definicao: null, valores: ["R$ 567,14 mi", "R$ 300,00 mi"] },
      { nome: "Margem líquida", definicao: null, valores: ["53,1%", null] },
    ]);
  });

  it("indicador que só existe num período antigo entra depois, com vazio nos outros", () => {
    const t = tabelaComparativa(
      doGrupo([
        relatorio("BBAS3", "2025-T4", [["Lucro", "R$ 13,70 bi"], ["Retorno sobre o patrimônio no exercício", "7,1%"]]),
        relatorio("BBAS3", "2026-T1", [["Lucro", "R$ 3,00 bi"], ["Retorno sobre o patrimônio no trimestre", "1,5%"]]),
      ]),
    );

    expect(t?.linhas.map((l) => l.nome)).toEqual([
      "Lucro",
      "Retorno sobre o patrimônio no trimestre",
      "Retorno sobre o patrimônio no exercício",
    ]);
    expect(t?.linhas[1]?.valores).toEqual(["1,5%", null]);
    expect(t?.linhas[2]?.valores).toEqual([null, "7,1%"]);
  });

  it("marca a coluna do 4º trimestre como ano inteiro", () => {
    const t = tabelaComparativa(doGrupo([relatorio("BBAS3", "2025-T4"), relatorio("BBAS3", "2026-T1")]));

    expect(t?.colunas.map((c) => [c.rotulo, c.anoInteiro])).toEqual([
      ["1T26", false],
      ["4T25", true],
    ]);
  });

  it("entram só os 4 períodos mais recentes", () => {
    const t = tabelaComparativa(
      doGrupo(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((p) => relatorio("MXRF11", p))),
    );

    expect(t?.colunas.map((c) => c.periodo)).toEqual(["2026-10", "2026-09", "2026-08", "2026-07"]);
  });

  it("com um período só (ou nenhum) não há tabela", () => {
    expect(tabelaComparativa(doGrupo([relatorio("BBAS3", "2026-T1")]))).toBeNull();
    expect(tabelaComparativa([])).toBeNull();
  });
});

describe("tabelaComparativa: definição do indicador", () => {
  it("leva a definição do período mais recente que a traz; análise antiga sem definição fica com null", () => {
    const novo = relatorio("BBAS3", "2026-T2", [["Margem líquida", "20,0%"]]);
    novo.analysis!.indicadores[0]!.definicao = "Lucro ÷ receita, no mesmo período.";
    const t = tabelaComparativa([novo, relatorio("BBAS3", "2026-T1", [["Margem líquida", "18,0%"], ["Lucro", "R$ 1,00 bi"]])]);

    expect(t?.linhas.map((l) => [l.nome, l.definicao])).toEqual([
      ["Margem líquida", "Lucro ÷ receita, no mesmo período."],
      ["Lucro", null],
    ]);
  });
});

describe("blocosDoResumo", () => {
  it("análise nova: os blocos como vieram, sem bloco vazio", () => {
    const a = relatorio("BBAS3", "2026-T2").analysis!;
    a.blocos = [
      { titulo: "O documento", itens: ["Texto."] },
      { titulo: "Balanço na data-base", itens: [] },
    ];

    expect(blocosDoResumo(a)).toEqual([{ titulo: "O documento", itens: ["Texto."] }]);
  });

  it("análise antiga (lista solta): um bloco só, sem título", () => {
    const a = { tipoDocumento: "ITR", resumoExecutivo: ["texto antigo"], alertas: [], indicadores: [] };

    expect(blocosDoResumo(a)).toEqual([{ titulo: null, itens: ["texto antigo"] }]);
    expect(blocosDoResumo({ tipoDocumento: "ITR", alertas: [], indicadores: [] })).toEqual([]);
  });
});

describe("gruposDePontos", () => {
  it("três grupos na ordem da tela, cada ponto com o critério, e grupo vazio não entra", () => {
    const a = relatorio("BBAS3", "2026-T2").analysis!;
    a.destaques = [{ titulo: "Lucro no período", detalhe: "Lucro: R$ 1,00 bi.", criterio: "lucro do período acima de zero" }];
    a.alertas = [
      { titulo: "Prejuízo", severidade: "critico", detalhe: "d1", criterio: "c1" },
      { titulo: "Receita em queda", severidade: "atencao", detalhe: "d2", criterio: "c2" },
    ];

    const grupos = gruposDePontos(a);
    expect(grupos.map((g) => g.titulo)).toEqual(["Destaques do período", "Pontos de atenção", "Pontos críticos"]);
    expect(grupos[0]?.itens[0]).toEqual({ titulo: "Lucro no período", detalhe: "Lucro: R$ 1,00 bi.", criterio: "lucro do período acima de zero" });

    a.destaques = [];
    a.alertas = [{ titulo: "Prejuízo", severidade: "critico", detalhe: "d1", criterio: "c1" }];
    expect(gruposDePontos(a).map((g) => g.titulo)).toEqual(["Pontos críticos"]);
  });

  it("análise antiga: sem destaques e sem critério, e o 'info' de antes vira o grupo Para saber", () => {
    const a = {
      tipoDocumento: "ITR",
      resumoExecutivo: [],
      indicadores: [],
      alertas: [
        { titulo: "Menos cotistas", severidade: "info" as const, detalhe: "d" },
        { titulo: "Queda", severidade: "atencao" as const, detalhe: "d" },
      ],
    };

    const grupos = gruposDePontos(a);
    expect(grupos.map((g) => g.titulo)).toEqual(["Pontos de atenção", "Para saber"]);
    expect(grupos[0]?.itens[0]?.criterio).toBeNull();
    expect(gruposDePontos({ tipoDocumento: "ITR", alertas: [], indicadores: [] })).toEqual([]);
  });
});
