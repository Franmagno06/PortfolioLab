import { describe, expect, it } from "vitest";
import type { DadosDosIndices } from "./indices";
import { DADOS_DE_EXEMPLO } from "./indices-exemplo";
import { artigosParaComecar, numerosDoBento, QUANTIDADE_DE_FICHAS, type ArtigoParaComecar } from "./home-dados";

const artigo = (slug: string, atualizadoEm: string): ArtigoParaComecar => ({
  slug,
  titulo: slug,
  subtitulo: "",
  categoria: "acoes-e-fiis",
  tempoLeitura: 2,
  atualizadoEm,
});

describe("artigosParaComecar", () => {
  const artigos = [
    artigo("antigo", "2026-09-01"),
    artigo("destaque", "2026-10-20"),
    artigo("meio", "2026-10-10"),
    artigo("novo", "2026-10-18"),
    artigo("recente", "2026-10-15"),
  ];

  it("devolve 3, sem o destaque, do mais recente ao mais antigo", () => {
    const r = artigosParaComecar(artigos, "destaque");

    expect(r).toHaveLength(3);
    expect(r.map((a) => a.slug)).not.toContain("destaque");
    expect(r.map((a) => a.slug)).toEqual(["novo", "recente", "meio"]);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.atualizadoEm >= r[i]!.atualizadoEm).toBe(true);
  });

  it("sem destaque, só ordena e corta", () => {
    expect(artigosParaComecar(artigos, undefined, 2).map((a) => a.slug)).toEqual(["destaque", "novo"]);
  });

  it("empate na data: ordem alfabética do título, em pt-BR", () => {
    const empatados = [artigo("Índice", "2026-10-15"), artigo("Zebra", "2026-10-15"), artigo("Ação", "2026-10-15")];
    expect(artigosParaComecar(empatados, undefined).map((a) => a.slug)).toEqual(["Ação", "Índice", "Zebra"]);
  });

  it("com menos artigos que `quantos`, devolve os que há", () => {
    expect(artigosParaComecar([artigo("a", "2026-10-01"), artigo("b", "2026-10-02")], "a", 3).map((a) => a.slug)).toEqual(["b"]);
  });

  it("destaque que não está na lista não tira ninguém", () => {
    expect(artigosParaComecar(artigos, "nao-existe", 5)).toHaveLength(5);
  });

  it("não mexe na lista que recebeu", () => {
    const copia = [...artigos];
    artigosParaComecar(artigos, "destaque");
    expect(artigos).toEqual(copia);
  });
});

describe("numerosDoBento", () => {
  it("sem dados: números fixos e nenhum minigráfico", () => {
    const r = numerosDoBento(null);
    expect(r.numeros.aoVivo).toBe(false);
    expect(r.minigraficoIbovespa).toBeNull();
  });

  it("com a fixture: 12 fechamentos mensais, o último é o último ponto do Ibovespa", () => {
    const r = numerosDoBento(DADOS_DE_EXEMPLO);
    const ibov = DADOS_DE_EXEMPLO.pontos.ibovespa;

    expect(r.numeros.aoVivo).toBe(true);
    expect(r.minigraficoIbovespa).toHaveLength(12);
    expect(r.minigraficoIbovespa!.at(-1)).toBe(ibov.at(-1)!.valor);
  });

  it("cada valor é o último fechamento do seu mês", () => {
    const ibov = DADOS_DE_EXEMPLO.pontos.ibovespa;
    const mesDoUltimo = ibov.at(-1)!.data.slice(0, 7);
    const ultimoDoMesAnterior = ibov.filter((p) => p.data.slice(0, 7) < mesDoUltimo).at(-1)!;

    expect(numerosDoBento(DADOS_DE_EXEMPLO).minigraficoIbovespa!.at(-2)).toBe(ultimoDoMesAnterior.valor);
  });

  it("com só 1 mês de dados não há minigráfico", () => {
    const umMes: DadosDosIndices = {
      ...DADOS_DE_EXEMPLO,
      pontos: {
        ...DADOS_DE_EXEMPLO.pontos,
        ibovespa: [
          { data: "2026-10-01", valor: 190000 },
          { data: "2026-10-15", valor: 192000 },
        ],
      },
    };
    const r = numerosDoBento(umMes);

    expect(r.numeros.aoVivo).toBe(true);
    expect(r.minigraficoIbovespa).toBeNull();
  });

  it("com 2 meses já há minigráfico, de 2 valores", () => {
    const doisMeses: DadosDosIndices = {
      ...DADOS_DE_EXEMPLO,
      pontos: {
        ...DADOS_DE_EXEMPLO.pontos,
        ibovespa: [
          { data: "2026-09-29", valor: 189000 },
          { data: "2026-09-30", valor: 190000 },
          { data: "2026-10-15", valor: 192000 },
        ],
      },
    };

    expect(numerosDoBento(doisMeses).minigraficoIbovespa).toEqual([190000, 192000]);
  });

  const comIbov = (ibovespa: { data: string; valor: number }[]): DadosDosIndices => ({
    ...DADOS_DE_EXEMPLO,
    pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa },
  });

  it("valor não finito é descartado: fica o último fechamento válido do mês", () => {
    const r = numerosDoBento(
      comIbov([
        { data: "2026-08-31", valor: 180000 },
        { data: "2026-09-29", valor: 189000 },
        { data: "2026-09-30", valor: Number.NaN },
        { data: "2026-10-14", valor: 192000 },
        { data: "2026-10-15", valor: Number.POSITIVE_INFINITY },
        { data: "2026-10-16", valor: 192115 },
      ]),
    );

    expect(r.minigraficoIbovespa).toEqual([180000, 189000, 192115]);
    expect(r.minigraficoIbovespa!.every(Number.isFinite)).toBe(true);
  });

  it("mês faltando no meio da janela: sem minigráfico", () => {
    const r = numerosDoBento(
      comIbov([
        { data: "2026-07-31", valor: 178000 },
        { data: "2026-08-31", valor: 180000 },
        // setembro não veio
        { data: "2026-10-16", valor: 192115 },
      ]),
    );

    expect(r.numeros.aoVivo).toBe(true);
    expect(r.minigraficoIbovespa).toBeNull();
  });

  it("a virada de ano conta como meses seguidos", () => {
    expect(
      numerosDoBento(
        comIbov([
          { data: "2025-12-30", valor: 160000 },
          { data: "2026-01-15", valor: 165000 },
        ]),
      ).minigraficoIbovespa,
    ).toEqual([160000, 165000]);
  });

  it("caindo no conjunto fixo (uma série vazia), não mostra minigráfico mesmo com Ibovespa", () => {
    const semIfix: DadosDosIndices = { ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, ifix: [] } };
    const r = numerosDoBento(semIfix);

    expect(r.numeros.aoVivo).toBe(false);
    expect(r.minigraficoIbovespa).toBeNull();
  });
});

describe("QUANTIDADE_DE_FICHAS", () => {
  it("conta as fichas do catálogo", () => {
    expect(QUANTIDADE_DE_FICHAS).toEqual({ acoes: 15, fiis: 15, etfs: 10 });
  });
});
