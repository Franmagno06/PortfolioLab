import { describe, expect, it } from "vitest";
import type { ItemNoticia } from "../news/rss.js";
import { nomeParaBusca, noticiasDoAtivo } from "./ativos.noticias.js";

const item = (titulo: string, publicadoEm: string, resumo = "", fonte = "Money Times"): ItemNoticia => ({
  titulo,
  resumo,
  link: `https://exemplo.com.br/${encodeURIComponent(titulo)}`,
  fonte,
  publicadoEm,
});

describe("nomeParaBusca", () => {
  it("tira a classe da ação", () => {
    expect(nomeParaBusca("Petrobras PN")).toBe("Petrobras");
    expect(nomeParaBusca("Taesa Unit")).toBe("Taesa");
    expect(nomeParaBusca("Banco do Brasil ON")).toBe("Banco do Brasil");
  });

  it("tira o '(antigo ...)' dos FIIs renomeados", () => {
    expect(nomeParaBusca("Pátria Log (antigo CSHG Logística)")).toBe("Pátria Log");
    expect(nomeParaBusca("Pátria Escritórios (antigo CSHG Real Estate)")).toBe("Pátria Escritórios");
  });

  it("nome sem nada a tirar fica como está", () => {
    expect(nomeParaBusca("Maxi Renda")).toBe("Maxi Renda");
    expect(nomeParaBusca("Vale S.A.")).toBe("Vale S.A.");
  });
});

describe("noticiasDoAtivo", () => {
  const feed = [
    item("Petrobras anuncia novo poço no pré-sal", "2026-10-09T10:00:00.000Z"),
    item("Ibovespa fecha em alta com bancos", "2026-10-09T18:00:00.000Z"),
    item("PETR4 sobe 3% e lidera o índice", "2026-10-08T10:00:00.000Z"),
    item("Mercado olha Selic", "2026-10-07T10:00:00.000Z", "O destaque do dia foi a Petrobras (PETR4), que subiu."),
    item("Petrobrasilia inaugura nova avenida", "2026-10-06T10:00:00.000Z"),
  ];

  it("fica com as que citam o nome ou o ticker, as mais recentes primeiro", () => {
    const resultado = noticiasDoAtivo(feed, "PETR4", "Petrobras PN");

    expect(resultado.map((n) => n.titulo)).toEqual([
      "Petrobras anuncia novo poço no pré-sal",
      "PETR4 sobe 3% e lidera o índice",
      "Mercado olha Selic",
    ]);
  });

  it("acha também pelo resumo, porque a manchete brasileira costuma ser genérica", () => {
    const resultado = noticiasDoAtivo(feed, "PETR4", "Petrobras PN");

    expect(resultado.map((n) => n.titulo)).toContain("Mercado olha Selic");
  });

  it("exige a palavra inteira: 'Petrobrasilia' não é 'Petrobras'", () => {
    const resultado = noticiasDoAtivo(feed, "PETR4", "Petrobras PN");

    expect(resultado.map((n) => n.titulo)).not.toContain("Petrobrasilia inaugura nova avenida");
  });

  it("devolve título, fonte, data e link da matéria", () => {
    const [primeira] = noticiasDoAtivo(
      [item("VALE3 divulga produção", "2026-10-09T10:00:00.000Z", "", "Suno Notícias")],
      "VALE3",
      "Vale S.A.",
    );

    expect(primeira).toEqual({
      titulo: "VALE3 divulga produção",
      fonte: "Suno Notícias",
      publicadaEm: "2026-10-09T10:00:00.000Z",
      url: "https://exemplo.com.br/VALE3%20divulga%20produ%C3%A7%C3%A3o",
    });
  });

  it("no máximo cinco", () => {
    const muitas = Array.from({ length: 9 }, (_, i) =>
      item(`MXRF11 paga rendimento ${i}`, `2026-10-0${i + 1}T10:00:00.000Z`),
    );

    expect(noticiasDoAtivo(muitas, "MXRF11", "Maxi Renda")).toHaveLength(5);
  });

  it("ativo que ninguém citou: lista vazia, que não é erro", () => {
    expect(noticiasDoAtivo(feed, "KNIP11", "Kinea Índices de Preços")).toEqual([]);
  });

  it("feed vazio: lista vazia", () => {
    expect(noticiasDoAtivo([], "PETR4", "Petrobras PN")).toEqual([]);
  });
});

describe("noticiasDoAtivo: matéria repetida em vários portais", () => {
  it("fica só a mais recente de cada título", () => {
    const itens = [
      item("VALE3 sobe com minério", "2026-10-09T10:00:00.000Z", "", "Money Times"),
      item("Vale3 sobe com minério", "2026-10-09T12:00:00.000Z", "", "InfoMoney"),
      item("VALE3 paga dividendos", "2026-10-08T12:00:00.000Z"),
    ];
    const r = noticiasDoAtivo(itens, "VALE3", "Vale ON");
    expect(r.map((n) => n.fonte)).toEqual(["InfoMoney", "Money Times"]);
    expect(r).toHaveLength(2);
  });
});
