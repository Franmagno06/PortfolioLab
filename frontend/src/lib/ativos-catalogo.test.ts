import { describe, expect, it } from "vitest";
import { buscarAcao, buscarFii, gerarHistorico, MESES_DO_GRAFICO } from "./ativos-fichas";
import {
  ACOES,
  ACOES_INICIAIS,
  acharAcaoResumo,
  acharFiiResumo,
  FIIS,
  FIIS_INICIAIS,
  inicialDoAtivo,
  QUANTIDADE_INICIAL,
} from "./ativos-catalogo";

const TICKERS_DE_ACOES = [
  "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "ABEV3", "WEGE3", "B3SA3",
  "SUZB3", "ELET3", "RENT3", "JBSS3", "RADL3", "EQTL3", "TAEE11",
];
const TICKERS_DE_FIIS = [
  "MXRF11", "HGLG11", "KNRI11", "KNCR11", "KNIP11", "BTLG11", "XPLG11", "VISC11",
  "HGRE11", "BCFF11", "HGBS11", "VILG11", "RBRF11", "XPML11", "IRDM11",
];

describe("catálogo curado", () => {
  it("tem as 15 ações e os 15 FIIs combinados, na ordem combinada", () => {
    expect(ACOES.map((a) => a.ticker)).toEqual(TICKERS_DE_ACOES);
    expect(FIIS.map((f) => f.ticker)).toEqual(TICKERS_DE_FIIS);
  });

  it("não repete ticker", () => {
    expect(new Set(ACOES.map((a) => a.ticker)).size).toBe(ACOES.length);
    expect(new Set(FIIS.map((f) => f.ticker)).size).toBe(FIIS.length);
  });

  it("a listagem começa pelos cinco primeiros", () => {
    expect(QUANTIDADE_INICIAL).toBe(5);
    expect(ACOES_INICIAIS.map((a) => a.ticker)).toEqual(TICKERS_DE_ACOES.slice(0, 5));
    expect(FIIS_INICIAIS.map((f) => f.ticker)).toEqual(TICKERS_DE_FIIS.slice(0, 5));
  });

  it("todo preço é positivo", () => {
    for (const ativo of [...ACOES, ...FIIS]) expect(ativo.preco).toBeGreaterThan(0);
  });

  it("acha o ativo em maiúsculas ou minúsculas, e só na classe certa", () => {
    expect(acharAcaoResumo("vale3")?.ticker).toBe("VALE3");
    expect(acharFiiResumo("mxrf11")?.ticker).toBe("MXRF11");
    expect(acharAcaoResumo("MXRF11")).toBeUndefined();
    expect(acharFiiResumo("VALE3")).toBeUndefined();
    expect(acharAcaoResumo("XXXX9")).toBeUndefined();
  });

  it("a inicial do avatar é a primeira letra do ticker", () => {
    expect(inicialDoAtivo("vale3")).toBe("V");
  });
});

describe("gerarHistorico", () => {
  it("devolve 12 meses terminando no preço atual", () => {
    const h = gerarHistorico("VALE3", 62.48, 0.06);
    expect(h).toHaveLength(12);
    expect(h.map((p) => p.mes)).toEqual(MESES_DO_GRAFICO);
    expect(h[11]?.fechamento).toBe(62.48);
  });

  it("é determinístico: a mesma entrada dá a mesma série", () => {
    expect(gerarHistorico("PETR4", 38.12, 0.07)).toEqual(gerarHistorico("PETR4", 38.12, 0.07));
  });

  it("tickers diferentes dão séries diferentes", () => {
    expect(gerarHistorico("PETR4", 38.12, 0.07)).not.toEqual(gerarHistorico("VALE3", 38.12, 0.07));
  });

  it("nunca produz preço zero ou negativo", () => {
    for (const ticker of [...TICKERS_DE_ACOES, ...TICKERS_DE_FIIS]) {
      for (const ponto of gerarHistorico(ticker, 10, 0.07)) expect(ponto.fechamento).toBeGreaterThan(0);
    }
  });
});

describe("buscarAcao", () => {
  it("monta a ficha completa de uma ação", async () => {
    const ficha = await buscarAcao("VALE3");
    expect(ficha?.ticker).toBe("VALE3");
    expect(ficha?.historico).toHaveLength(12);
    expect(ficha?.proventos).toHaveLength(4);
    expect(ficha?.resultados.map((r) => r.periodo)).toEqual(["3T25", "4T25", "1T26", "2T26"]);
    expect(ficha?.noticias.length).toBeGreaterThan(0);
  });

  it("marca os três bancos do catálogo, e só eles", async () => {
    const bancos: string[] = [];
    for (const ticker of TICKERS_DE_ACOES) {
      if ((await buscarAcao(ticker))?.banco) bancos.push(ticker);
    }
    expect(bancos).toEqual(["ITUB4", "BBDC4", "BBAS3"]);
  });

  it("banco tem ROA e não tem margem líquida nem dívida/EBITDA; empresa comum é o contrário", async () => {
    const banco = await buscarAcao("ITUB4");
    expect(banco?.roa).not.toBeNull();
    expect(banco?.margemLiquida).toBeNull();
    expect(banco?.dividaEbitda).toBeNull();

    const empresa = await buscarAcao("VALE3");
    expect(empresa?.roa).toBeNull();
    expect(empresa?.margemLiquida).not.toBeNull();
  });

  it("devolve null para ticker fora do catálogo, inclusive um FII", async () => {
    expect(await buscarAcao("XXXX9")).toBeNull();
    expect(await buscarAcao("MXRF11")).toBeNull();
  });

  it("os proventos têm data-ex e não têm data de pagamento (a fonte não informa)", async () => {
    const ficha = await buscarAcao("PETR4");
    for (const p of ficha?.proventos ?? []) {
      expect(Object.keys(p).sort()).toEqual(["dataEx", "tipo", "valor"]);
    }
  });
});

describe("buscarFii", () => {
  it("monta a ficha completa de um FII", async () => {
    const ficha = await buscarFii("MXRF11");
    expect(ficha?.tipo).toBe("Papel");
    expect(ficha?.historico).toHaveLength(12);
    expect(ficha?.proventos).toHaveLength(4);
  });

  it("a composição da carteira soma 100% em todos os fundos", async () => {
    for (const ticker of TICKERS_DE_FIIS) {
      const soma = (await buscarFii(ticker))?.composicao.reduce((s, f) => s + f.pct, 0);
      expect(soma, ticker).toBe(100);
    }
  });

  it("não existe vacância em nenhum campo da ficha (dado ainda não confiável)", async () => {
    const ficha = await buscarFii("HGLG11");
    expect(JSON.stringify(ficha).toLowerCase()).not.toContain("vac");
  });

  it("devolve null para ticker fora do catálogo, inclusive uma ação", async () => {
    expect(await buscarFii("XXXX11")).toBeNull();
    expect(await buscarFii("VALE3")).toBeNull();
  });
});
