import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { dataDiaCurta, mesNumerico, mesPorExtenso } from "./format";
import { DICAS } from "./indicadores-explicados";
import {
  acumular,
  anosDoCdi,
  CATEGORIAS,
  cdiPorAno,
  INDICES,
  ipcaEm12Meses,
  lerCategoria,
  lerOrdem,
  marcasDoEixoX,
  mesesAntes,
  mesesDoIpca,
  mudancasDaSelic,
  pontosPercentuais,
  recortar,
  reduzirParaGrafico,
  resumir,
  SLUGS,
  type Indice,
  type PontoSerie,
  type Slug,
} from "./indices";
import { destaqueDoIndice, ordenarEFiltrar, paragrafoDeHoje, provedorDeIndices, variacaoEmMeses } from "./indices-dados";
import { CDI_MENSAL, IPCA_MENSAL, SELIC_MENSAL, SERIES_DE_PONTOS } from "./indices-series";

const indice = (slug: Slug) => INDICES.find((i) => i.slug === slug) as Indice;
const arred = (v: number, casas = 1) => Math.round(v * 10 ** casas) / 10 ** casas;
const textoDe = (slug: Slug) => paragrafoDeHoje(indice(slug)).map((t) => (typeof t === "string" ? t : t.forte)).join("");

describe("catálogo de índices", () => {
  it("tem os oito slugs pedidos, um índice por slug, em três categorias", () => {
    expect(INDICES.map((i) => i.slug).sort()).toEqual([...SLUGS].sort());
    expect(new Set(INDICES.map((i) => i.categoria))).toEqual(new Set(CATEGORIAS.map((c) => c.id)));
    expect(INDICES.filter((i) => i.tipo === "taxa").map((i) => i.slug)).toEqual(["selic", "ipca", "cdi"]);
  });

  it("toda dica do card existe, e todo índice tem fonte, armadilha e veja também", () => {
    for (const i of INDICES) {
      expect(DICAS[i.dica], i.slug).toBeDefined();
      expect(i.fonte.nome.length, i.slug).toBeGreaterThan(1);
      expect(i.armadilha.length, i.slug).toBeGreaterThan(40);
      expect(i.veja_tambem.length, i.slug).toBeGreaterThanOrEqual(3);
      expect(i.periodos, i.slug).toContain(i.periodoPadrao);
    }
  });

  it("todo link de 'veja também' e todo artigo apontam para uma página que existe", () => {
    const app = join(process.cwd(), "src", "app", "(site)");
    const artigos = join(process.cwd(), "src", "content", "aprender", "artigos");
    for (const i of INDICES) {
      expect(existsSync(join(artigos, `${i.artigo}.mdx`)), i.artigo).toBe(true);
      for (const link of i.veja_tambem) {
        const [, secao, resto] = link.href.split("/");
        if (secao === "aprender") expect(existsSync(join(artigos, `${resto}.mdx`)), link.href).toBe(true);
        else if (link.href.startsWith("/ativos/indices/")) expect(SLUGS).toContain(link.href.split("/").pop());
        else expect(existsSync(join(app, link.href, "page.tsx")), link.href).toBe(true);
      }
    }
  });

  it("nenhum texto recomenda nem promete retorno", () => {
    const textos = INDICES.flatMap((i) => [i.descricao, i.armadilha, i.comoFunciona ?? "", ...i.explicacao])
      .join(" ")
      .toLowerCase();
    for (const proibida of ["recomend", "oportunidade", "compre", "vale a pena", "garantid"]) {
      expect(textos).not.toContain(proibida);
    }
  });
});

describe("séries de exemplo", () => {
  it("são determinísticas: carregar o módulo de novo gera os mesmos números", async () => {
    vi.resetModules();
    const outra = await import("./indices-series");
    expect(outra.SERIES_DE_PONTOS).not.toBe(SERIES_DE_PONTOS); // é outra geração, não o mesmo objeto
    expect(outra.SERIES_DE_PONTOS.ibovespa).toEqual(SERIES_DE_PONTOS.ibovespa);
    expect(outra.IPCA_MENSAL).toEqual(IPCA_MENSAL);
  });

  it("os índices de pontos cobrem pelo menos 15 anos de pregões, em ordem, sem fim de semana", () => {
    for (const [slug, serie] of Object.entries(SERIES_DE_PONTOS)) {
      expect(serie[0]?.data, slug).toBe("2011-01-03");
      expect(serie[serie.length - 1]?.data, slug).toBe("2026-10-15");
      expect(serie.length, slug).toBeGreaterThan(15 * 250);
      for (let i = 1; i < serie.length; i++) {
        expect((serie[i] as PontoSerie).data > (serie[i - 1] as PontoSerie).data).toBe(true);
      }
      expect(serie.every((p) => ![0, 6].includes(new Date(`${p.data}T12:00:00Z`).getUTCDay())), slug).toBe(true);
      expect(serie.every((p) => p.valor > 0), slug).toBe(true);
    }
  });

  it("os índices de pontos batem as âncoras do protótipo: valor de hoje, 12 e 60 meses", () => {
    const esperado: Record<string, [number, number, number]> = {
      ibovespa: [192115, 14.2, 77.6],
      ifix: [3772, 9.6, 38.4],
      smll: [2205, 12.3, 31.8],
      sp500: [7012.6, 15.8, 72.6],
      idiv: [14120, 18.9, 92.3],
    };
    for (const [slug, [hoje, v12, v60]] of Object.entries(esperado)) {
      const d = destaqueDoIndice(indice(slug as Slug));
      expect(d.valor, slug).toBe(hoje);
      expect(arred(d.variacao12m), slug).toBe(v12);
      expect(arred(variacaoEmMeses(slug as Slug, 60) ?? 0), slug).toBe(v60);
    }
  });

  it("Selic: 13,75% hoje, −1,25 p.p. em 12 meses, pico de 15,00% em 06/2025 e mínima de 2,00% em 08/2020", () => {
    const d = destaqueDoIndice(indice("selic"));
    expect(d.valorFormatado).toBe("13,75% a.a.");
    expect(d.secundario.texto).toBe("−1,25 p.p.");
    const r = resumir(SELIC_MENSAL);
    expect([r?.maxima.valor, r?.maxima.data]).toEqual([15, "2025-06"]);
    expect([r?.minima.valor, r?.minima.data]).toEqual([2, "2020-08"]);
  });

  it("IPCA: 4,58% em 12 meses e 0,82% em setembro, no card e na tabela da ficha", () => {
    const d = destaqueDoIndice(indice("ipca"));
    expect(d.valorFormatado).toBe("4,58%");
    expect(d.secundario.texto).toBe("0,82%");
    const [setembro] = mesesDoIpca(IPCA_MENSAL);
    expect(setembro?.mes).toBe("2026-09");
    expect(setembro?.doMes).toBe(0.82);
    expect(setembro?.em12Meses).toBe(4.58);
    expect(arred(setembro?.noAno ?? 0, 2)).toBe(3.95);
  });

  it("IPCA: cada ano até 2024 fecha no IPCA anual, e 2025 dá 4,26%", () => {
    const anual = (ano: string) => arred(acumular(IPCA_MENSAL.filter((p) => p.data.startsWith(ano)).map((p) => p.valor)), 2);
    expect(anual("2015")).toBeCloseTo(10.67, 1);
    expect(anual("2021")).toBeCloseTo(10.06, 1);
    expect(anual("2025")).toBe(4.26);
  });

  it("CDI: 13,65% hoje (Selic menos 0,10) e o card mostra o mesmo acumulado da ficha", () => {
    const d = destaqueDoIndice(indice("cdi"));
    expect(d.valorFormatado).toBe("13,65% a.a.");
    expect(CDI_MENSAL.at(-1)?.valor).toBe(13.65);
    const porAno = cdiPorAno(CDI_MENSAL, "2026-09");
    expect(porAno.at(-1)?.data).toBe("2026");
    expect(anosDoCdi(porAno)[0]?.ano).toBe("2026");
  });
});

describe("contas", () => {
  it("acumular compõe as taxas: 1% e 1% dão 2,01%", () => {
    expect(arred(acumular([1, 1]), 4)).toBe(2.01);
    expect(acumular([])).toBe(0);
  });

  it("IPCA em 12 meses de 12 meses de 1% dá 12,68%", () => {
    const mensal = Array.from({ length: 12 }, (_, i) => ({ data: `2020-${String(i + 1).padStart(2, "0")}`, valor: 1 }));
    expect(ipcaEm12Meses(mensal)).toEqual([{ data: "2020-12", valor: 12.68 }]);
  });

  it("mesesAntes não passa do último dia do mês", () => {
    expect(mesesAntes("2026-10-15", 12)).toBe("2025-10-15");
    expect(mesesAntes("2026-03-31", 1)).toBe("2026-02-28");
    expect(mesesAntes("2026-01-10", 2)).toBe("2025-11-10");
  });

  it("recortar: mensal pelos últimos meses, anual pelos últimos anos, diário pela data", () => {
    expect(recortar(SELIC_MENSAL, "1A", "mensal")).toHaveLength(12);
    expect(recortar(SELIC_MENSAL, "5A", "mensal")).toHaveLength(60);
    expect(recortar(SELIC_MENSAL, "Max", "mensal")).toHaveLength(SELIC_MENSAL.length);
    expect(recortar(cdiPorAno(CDI_MENSAL, "2026-09"), "3A", "anual").map((p) => p.data)).toEqual(["2024", "2025", "2026"]);
    const umAno = recortar(SERIES_DE_PONTOS.ibovespa, "1A", "diaria");
    expect(umAno[0]?.data).toBe("2025-10-15");
    expect(umAno.at(-1)?.data).toBe("2026-10-15");
  });

  it("trocar o período muda os dados: 6M e 1A não começam no mesmo dia", async () => {
    const seis = await provedorDeIndices.getSerie("ibovespa", "6M");
    const um = await provedorDeIndices.getSerie("ibovespa", "1A");
    expect(seis[0]?.data).not.toBe(um[0]?.data);
    expect(seis.length).toBeLessThan(um.length);
  });

  it("reduzirParaGrafico mantém o último ponto e respeita o máximo", () => {
    const serie = SERIES_DE_PONTOS.ifix;
    const reduzida = reduzirParaGrafico(serie, 300);
    expect(reduzida.length).toBeLessThanOrEqual(301);
    expect(reduzida.at(-1)).toEqual(serie.at(-1));
    expect(reduzirParaGrafico(serie.slice(0, 10), 300)).toHaveLength(10);
  });

  it("resumo: máxima e mínima ficam com a primeira vez que o valor apareceu, e a média é a média", () => {
    const r = resumir([
      { data: "a", valor: 2 },
      { data: "b", valor: 4 },
      { data: "c", valor: 4 },
      { data: "d", valor: 2 },
    ]);
    expect(r?.maxima.data).toBe("b");
    expect(r?.minima.data).toBe("a");
    expect(r?.media).toBe(3);
    expect(resumir([])).toBeNull();
  });

  it("mudanças da Selic: a mais recente primeiro, com o acumulado no ano", () => {
    const [ultima, penultima] = mudancasDaSelic(SELIC_MENSAL);
    expect(ultima).toEqual({ mes: "2026-09", meta: 13.75, variacao: -0.25, noAno: -1.25 });
    expect(penultima?.mes).toBe("2026-08");
    expect(pontosPercentuais(-0.25)).toBe("−0,25 p.p.");
    expect(pontosPercentuais(0.5)).toBe("+0,50 p.p.");
  });

  it("os textos com número vêm das séries", () => {
    expect(textoDe("selic")).toContain("13,75% ao ano");
    expect(textoDe("selic")).toContain("06/2025");
    expect(textoDe("ipca")).toContain("Em setembro, a inflação do mês foi de 0,82%");
    expect(textoDe("ipca")).toContain("4,26%");
    expect(textoDe("cdi")).toContain("13,65% ao ano");
  });
});

describe("ordem e filtro da listagem", () => {
  it("lê só valores conhecidos da URL", () => {
    expect(lerOrdem("az")).toBe("az");
    expect(lerOrdem("qualquer")).toBe("buscados");
    expect(lerOrdem(undefined)).toBe("buscados");
    expect(lerCategoria("exterior")).toBe("exterior");
    expect(lerCategoria(["exterior", "x"])).toBeNull();
  });

  it("filtra por categoria e ordena", () => {
    expect(ordenarEFiltrar(INDICES, "buscados", null).map((i) => i.slug)[0]).toBe("ibovespa");
    expect(ordenarEFiltrar(INDICES, "az", null).map((i) => i.nome)).toEqual(
      [...INDICES.map((i) => i.nome)].sort((a, b) => a.localeCompare(b, "pt-BR")),
    );
    expect(ordenarEFiltrar(INDICES, "buscados", "juros-inflacao")).toHaveLength(3);
    expect(ordenarEFiltrar(INDICES, "buscados", "bolsa-brasil")).toHaveLength(4);
    expect(ordenarEFiltrar(INDICES, "buscados", "exterior").map((i) => i.slug)).toEqual(["sp500"]);
    const porVariacao = ordenarEFiltrar(INDICES, "variacao", null).map((i) => destaqueDoIndice(i).variacao12m);
    expect(porVariacao).toEqual([...porVariacao].sort((a, b) => b - a));
  });
});

describe("eixo horizontal", () => {
  it("nunca passa de sete rótulos, e o diário inclui o primeiro e o último dia", () => {
    for (const periodo of ["1A", "3A", "5A", "10A", "Max"] as const) {
      expect(marcasDoEixoX(recortar(SELIC_MENSAL, periodo, "mensal"), "mensal").length, periodo).toBeLessThanOrEqual(8);
    }
    const umAno = recortar(SERIES_DE_PONTOS.ibovespa, "1A", "diaria");
    const marcas = marcasDoEixoX(umAno, "diaria");
    expect(marcas).toHaveLength(6);
    expect(marcas[0]).toBe(umAno[0]?.data);
    expect(marcas.at(-1)).toBe(umAno.at(-1)?.data);
  });
});

describe("formatos novos", () => {
  it("mês por extenso, mês numérico e data curta", () => {
    expect(mesPorExtenso("2026-09")).toBe("setembro");
    expect(mesNumerico("2025-01")).toBe("01/2025");
    expect(dataDiaCurta("2026-09-10")).toBe("10/09/26");
  });
});
