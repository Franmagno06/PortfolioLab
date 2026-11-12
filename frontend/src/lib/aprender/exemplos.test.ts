import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ATIVO_DE_EXEMPLO, juroReal, juroRealLiquido } from "../site-dados";
import {
  ALIQUOTAS_ETF_RENDA_FIXA,
  aliquotaDeIrNaRendaFixa,
  aporteDeExemplo,
  cdbEquivalente,
  DADOS_PUBLICOS,
  depoisDaCompra,
  depoisDaVenda,
  dividendYieldPct,
  emCentavos,
  EXEMPLO_DE_APORTE,
  inflacaoMaisJuro,
  jurosCompostos,
  poderDeCompra,
  razaoPct,
  rendimentoDeUmAno,
  rendimentoLiquido,
  PRESETS_GRAFICO_ARTIGO,
  PROVENTOS_HIPOTETICOS_DE_FII,
  simularJurosCompostosAportes,
} from "./exemplos";

const artigo = (slug: string) => readFileSync(join(process.cwd(), "src", "content", "aprender", "artigos", `${slug}.mdx`), "utf8");

describe("preço médio (regra da Receita Federal)", () => {
  it("a taxa entra no custo da compra e a venda não mexe no preço médio", () => {
    const vazia = { quantidade: 0, pmCentavos: 0 };
    const primeira = depoisDaCompra(vazia, { quantidade: 10, precoCentavos: emCentavos(20), taxaCentavos: emCentavos(2) });
    expect(primeira).toEqual({ quantidade: 10, pmCentavos: 2020 }); // R$ 20,20

    const segunda = depoisDaCompra(primeira, { quantidade: 10, precoCentavos: emCentavos(30), taxaCentavos: emCentavos(2) });
    expect(segunda).toEqual({ quantidade: 20, pmCentavos: 2520 }); // (202 + 302) ÷ 20 = R$ 25,20

    expect(depoisDaVenda(segunda, 5)).toEqual({ quantidade: 15, pmCentavos: 2520 });
  });

  it("vender tudo zera o preço médio; vender mais do que tem é erro", () => {
    expect(depoisDaVenda({ quantidade: 3, pmCentavos: 1000 }, 3)).toEqual({ quantidade: 0, pmCentavos: 0 });
    expect(() => depoisDaVenda({ quantidade: 3, pmCentavos: 1000 }, 4)).toThrow();
  });
});

describe("os números da empresa fictícia do exemplo (Empresa Exemplo S.A.)", () => {
  it("P/L = preço ÷ lucro por ação: R$ 40,00 ÷ R$ 4,00 = 10", () => {
    expect(ATIVO_DE_EXEMPLO.preco / ATIVO_DE_EXEMPLO.lucroPorAcao).toBe(10);
    expect(ATIVO_DE_EXEMPLO.pl).toBe(10);
  });

  it("P/VP = preço ÷ patrimônio por ação: R$ 40,00 ÷ R$ 20,00 = 2", () => {
    expect(ATIVO_DE_EXEMPLO.preco / ATIVO_DE_EXEMPLO.valorPatrimonialPorAcao).toBe(2);
    expect(ATIVO_DE_EXEMPLO.pvp).toBe(2);
  });

  it("DY = proventos de 12 meses ÷ preço: R$ 2,40 ÷ R$ 40,00 = 6,00%; com o preço a R$ 30,00, 8,00%", () => {
    expect(dividendYieldPct(emCentavos(2.4), emCentavos(40)).toFixed(2)).toBe("6.00");
    expect(dividendYieldPct(emCentavos(2.4), emCentavos(30)).toFixed(2)).toBe("8.00");
    expect(ATIVO_DE_EXEMPLO.proventos12m.porUnidade).toBe(2.4);
    expect(ATIVO_DE_EXEMPLO.dy12m).toBe(6);
  });

  it("ROE = lucro ÷ patrimônio: R$ 400 mi ÷ R$ 2 bi = 20%", () => {
    expect(razaoPct(ATIVO_DE_EXEMPLO.lucroLiquido, ATIVO_DE_EXEMPLO.patrimonioLiquido)).toBe(ATIVO_DE_EXEMPLO.roe);
    expect(ATIVO_DE_EXEMPLO.roe).toBe(20);
  });

  it("o artigo P/L e P/VP escreve os mesmos números que a conta dá", () => {
    const texto = artigo("pl-e-pvp");
    for (const trecho of ["R$ 40,00", "R$ 4,00", "R$ 20,00", "10,00", "2,00"]) expect(texto, trecho).toContain(trecho);
  });

  it("os artigos que usam a empresa do exemplo dizem que ela é fictícia e não citam ticker real como exemplo", () => {
    for (const slug of ["pl-e-pvp", "dividend-yield", "roe-margem-e-endividamento"]) {
      const texto = artigo(slug);
      expect(texto, slug).toContain("Empresa Exemplo S.A.");
      expect(texto, slug).toContain("empresa fictícia");
      expect(texto, slug).toContain("valores ilustrativos, inventados para este exemplo");
      expect(texto, slug).not.toContain("TAEE11");
    }
  });
});

describe("aporte de exemplo: R$ 1.000 numa carteira de R$ 7.000, metas 50%, 30% e 20%", () => {
  // A conta à mão, como o backend faz (rebalance.service.ts, calcularAporte):
  // patrimônio projetado = 7.000 + 1.000 = 8.000.
  // déficits: A = 50% × 8.000 − 3.000 = 1.000; B = 30% × 8.000 − 3.000 = −600 (acima da meta); C = 20% × 8.000 − 1.000 = 600.
  // soma dos déficits positivos = 1.600. Fatias: A = 1.000 × 1.000 ÷ 1.600 = 625; C = 1.000 × 600 ÷ 1.600 = 375.
  // 1ª passada: A compra ⌊625 ÷ 30⌋ = 20 cotas (R$ 600), sobram 400; C compra ⌊375 ÷ 100⌋ = 3 cotas (R$ 300), sobram 100.
  // 2ª passada: ainda faltam 400 em A e 300 em C; A, o maior, compra ⌊min(400, 100) ÷ 30⌋ = 3 cotas (R$ 90), sobram 10.
  // R$ 10 não compram uma cota de nenhum: fim. A = 23 cotas (R$ 690), C = 3 cotas (R$ 300), B = 0, sobra = R$ 10.
  const { compras, sobraCentavos } = aporteDeExemplo(EXEMPLO_DE_APORTE.metas, EXEMPLO_DE_APORTE.aporteCentavos);
  const de = (t: string) => compras.find((c) => c.ticker === t)!;

  it("a ordem é a do maior déficit para o menor", () => {
    expect(compras.map((c) => c.ticker)).toEqual(["Ativo A", "Ativo C", "Ativo B"]);
  });

  it("Ativo A: déficit de R$ 1.000, fatia de R$ 625, 20 cotas na fatia e 3 no troco", () => {
    expect(de("Ativo A")).toMatchObject({ deficitCentavos: 100000, fatiaCentavos: 62500, cotasNaFatia: 20, cotasNoTroco: 3, cotas: 23, custoCentavos: 69000 });
  });

  it("Ativo C: déficit de R$ 600, fatia de R$ 375, 3 cotas", () => {
    expect(de("Ativo C")).toMatchObject({ deficitCentavos: 60000, fatiaCentavos: 37500, cotasNaFatia: 3, cotasNoTroco: 0, cotas: 3, custoCentavos: 30000 });
  });

  it("Ativo B está acima da meta e não recebe nada", () => {
    expect(de("Ativo B")).toMatchObject({ deficitCentavos: -60000, fatiaCentavos: 0, cotas: 0, custoCentavos: 0 });
  });

  it("sobram R$ 10,00 para o próximo aporte, e ninguém passa do próprio déficit", () => {
    expect(sobraCentavos).toBe(1000);
    for (const c of compras) if (c.deficitCentavos > 0) expect(c.custoCentavos).toBeLessThanOrEqual(c.deficitCentavos);
    expect(compras.reduce((s, c) => s + c.custoCentavos, 0) + sobraCentavos).toBe(EXEMPLO_DE_APORTE.aporteCentavos);
  });

  it("um algoritmo guloso (maior déficit leva tudo) daria outra resposta: 33 cotas de A e nenhuma de C", () => {
    // é o motivo de o site usar a fatia proporcional: aqui, C também anda na direção da meta
    expect(Math.floor(100000 / 3000)).toBe(33);
    expect(de("Ativo C").cotas).toBeGreaterThan(0);
  });

  it("carteira vazia com R$ 200 (o exemplo antigo): MXRF11 11 cotas, BOVA11 nenhuma, sobra R$ 80,65", () => {
    const r = aporteDeExemplo(
      [
        { ticker: "MXRF11", metaPct: 60, precoCentavos: emCentavos(10.85), posicaoCentavos: 0 },
        { ticker: "BOVA11", metaPct: 40, precoCentavos: emCentavos(110), posicaoCentavos: 0 },
      ],
      emCentavos(200),
    );
    expect(r.compras.map((c) => [c.ticker, c.cotas])).toEqual([["MXRF11", 11], ["BOVA11", 0]]);
    expect(r.sobraCentavos).toBe(8065);
  });

  it("empate no déficit: o mais barato vem primeiro, e depois o ticker", () => {
    const r = aporteDeExemplo(
      [
        { ticker: "ZZZ", metaPct: 50, precoCentavos: 1000, posicaoCentavos: 0 },
        { ticker: "AAA", metaPct: 50, precoCentavos: 2000, posicaoCentavos: 0 },
      ],
      10000,
    );
    expect(r.compras.map((c) => c.ticker)).toEqual(["ZZZ", "AAA"]);
  });
});

describe("juro real (Fisher) com os dados públicos conferidos no Banco Central", () => {
  it("(1 + 13,75%) ÷ (1 + 4,58%) − 1 = 8,77% ao ano", () => {
    const real = juroReal(DADOS_PUBLICOS.selicMeta.valorPct, DADOS_PUBLICOS.ipca12m.valorPct);
    expect(real.toFixed(2)).toBe("8.77");
  });

  it("depois de 15% de IR: 13,75% × 0,85 = 11,6875% e (1,116875 ÷ 1,0458) − 1 = 6,80% ao ano", () => {
    expect((DADOS_PUBLICOS.selicMeta.valorPct * 0.85).toFixed(4)).toBe("11.6875");
    expect(juroRealLiquido(DADOS_PUBLICOS.selicMeta.valorPct, DADOS_PUBLICOS.ipca12m.valorPct).toFixed(2)).toBe("6.80");
  });

  it("cada dado público traz a fonte, e o da Selic traz a data da conferência", () => {
    expect(DADOS_PUBLICOS.selicMeta.fonte).toMatch(/SGS 432/);
    expect(DADOS_PUBLICOS.selicMeta.conferidoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DADOS_PUBLICOS.ipca12m.fonte).toMatch(/SGS 13522/);
  });
});

// ── Os números de cada artigo ───────────────────────────────────────────────────────────────────
// Para cada número que um artigo escreve, a conta que o produz. Se alguém mudar o texto sem mudar a
// conta (ou o contrário), o teste falha e aponta o artigo.

const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const pct = (v: number, casas = 2) => `${v.toFixed(casas).replace(".", ",")}%`;
const { cdi, ipca12m, selicMeta, fgc } = DADOS_PUBLICOS;

const NUMEROS_DOS_ARTIGOS: Record<string, [descricao: string, esperado: string][]> = {
  "por-que-o-dinheiro-parado-perde-valor": [
    ["IPCA de 12 meses", pct(ipca12m.valorPct)],
    ["poder de compra de R$ 1.000", reais(poderDeCompra(100000, ipca12m.valorPct))],
    ["juro real", `${pct(juroReal(selicMeta.valorPct, ipca12m.valorPct))} ao ano`],
    ["a subtração que engana", pct(selicMeta.valorPct - ipca12m.valorPct)],
    ["Selic depois de 15% de IR", pct(selicMeta.valorPct * 0.85, 4)],
    ["juro real depois de 15% de IR", `${pct(juroRealLiquido(selicMeta.valorPct, ipca12m.valorPct))} ao ano`],
  ],
  "reserva-de-emergencia": [
    ["6 meses de R$ 2.000", "R$ 12.000"],
    ["12 meses de R$ 2.000", "R$ 24.000"],
    ["limite do FGC", `R$ ${(fgc.porInstituicaoReais / 1000).toFixed(0)} mil`],
  ],
  "juros-compostos-e-dividas": [
    ["R$ 1.000 a 1% por 12 meses", reais(jurosCompostos(100000, 1, 12))],
    ["R$ 1.000 a 1% por 120 meses", reais(jurosCompostos(100000, 1, 120))],
    ["dívida a 10% por 12 meses", reais(jurosCompostos(100000, 10, 12))],
    ["juros simples", "R$ 1.120,00"],
  ],
  "selic-cdi-sem-misterio": [
    ["Selic meta", pct(selicMeta.valorPct)],
    ["CDI", pct(cdi.valorPct)],
    ["100% do CDI", reais(rendimentoDeUmAno(100000, cdi.valorPct))],
    ["90% do CDI", reais(rendimentoDeUmAno(100000, cdi.valorPct * 0.9))],
    ["110% do CDI", reais(rendimentoDeUmAno(100000, cdi.valorPct * 1.1))],
  ],
  "tesouro-direto": [["IPCA + 6%", pct(inflacaoMaisJuro(ipca12m.valorPct, 6))]],
  "cdb-lci-lca-e-fgc": [
    ["CDB equivalente a 17,5%", `${cdbEquivalente(90, 17.5).toFixed(2).replace(".", ",")}% do CDI`],
    ["CDB equivalente a 15%", `${cdbEquivalente(90, 15).toFixed(2).replace(".", ",")}%`],
    ["sem garantia com R$ 300 mil", `R$ ${((300_000 - fgc.porInstituicaoReais) / 1000).toFixed(0)}.000`],
  ],
  "imposto-na-renda-fixa": [
    ["IR em 365 dias", reais(rendimentoLiquido(13650, 365).irCentavos)],
    ["líquido em 365 dias", reais(rendimentoLiquido(13650, 365).liquidoCentavos)],
    ["líquido antes de 180 dias", reais(rendimentoLiquido(13650, 150).liquidoCentavos)],
    ["líquido depois de 720 dias", reais(rendimentoLiquido(13650, 800).liquidoCentavos)],
  ],
  "dividend-yield": [
    ["DY da empresa fictícia", pct(dividendYieldPct(emCentavos(ATIVO_DE_EXEMPLO.proventos12m.porUnidade), emCentavos(ATIVO_DE_EXEMPLO.preco)))],
    ["proventos de 12 meses da empresa fictícia", reais(emCentavos(ATIVO_DE_EXEMPLO.proventos12m.porUnidade))],
    ["cada um dos quatro pagamentos", reais(emCentavos(ATIVO_DE_EXEMPLO.proventos12m.valores[0]))],
    ["preço da empresa fictícia", reais(emCentavos(ATIVO_DE_EXEMPLO.preco))],
    ["DY com o preço em queda", pct(dividendYieldPct(emCentavos(ATIVO_DE_EXEMPLO.proventos12m.porUnidade), 3000))],
  ],
  "roe-margem-e-endividamento": [
    ["ROE da empresa fictícia", pct(razaoPct(ATIVO_DE_EXEMPLO.lucroLiquido, ATIVO_DE_EXEMPLO.patrimonioLiquido))],
    ["lucro para cada R$ 100 de patrimônio", reais(Math.round(ATIVO_DE_EXEMPLO.roe * 100))],
    ["ROE com metade do patrimônio", `${razaoPct(20, 50)}%`],
    ["margem líquida", pct(razaoPct(15, 120), 1)],
    ["dívida sobre EBITDA", "2,0x"],
  ],
  "fiis-tijolo-ou-papel": [
    ["vacância", pct(razaoPct(1500, 20000), 1)],
    ["DY de FII sobre a cota de R$ 9,50", pct(razaoPct(110, 950), 1)],
    ["P/VP de FII", (950 / 1000).toFixed(2).replace(".", ",")],
  ],
  "preco-medio": [
    ["preço médio depois da primeira compra", "R$ 20,20"],
    ["preço médio depois da segunda compra", "R$ 25,20"],
    ["lucro da venda de 5 cotas a R$ 30", reais(5 * (3000 - 2520))],
    ["preço depois do desdobramento", reais(2520 / 2)],
  ],
  "etfs-uma-cota-varios-ativos": [["diferença para o índice", "0,2 ponto"]],
  "rebalancear-com-aportes": [
    ["peso das ações depois da alta", pct(razaoPct(1300, 2300), 1)],
    ["déficit de A", reais(100000)],
    ["fatia de A", reais(62500)],
    ["fatia de C", reais(37500)],
    ["custo de A", reais(69000)],
    ["custo de C", reais(30000)],
    ["sobra", reais(1000)],
  ],
};

describe("os números escritos nos artigos são os que a conta dá", () => {
  for (const [slug, numeros] of Object.entries(NUMEROS_DOS_ARTIGOS)) {
    it(slug, () => {
      const texto = artigo(slug);
      for (const [descricao, esperado] of numeros) expect(texto, `${slug}: ${descricao}`).toContain(esperado);
    });
  }

  it("as contas de base", () => {
    expect(aliquotaDeIrNaRendaFixa(180)).toBe(22.5);
    expect(aliquotaDeIrNaRendaFixa(181)).toBe(20);
    expect(aliquotaDeIrNaRendaFixa(361)).toBe(17.5);
    expect(aliquotaDeIrNaRendaFixa(721)).toBe(15);
    expect(rendimentoLiquido(13650, 365)).toEqual({ aliquotaPct: 17.5, irCentavos: 2389, liquidoCentavos: 11261 });
    expect(jurosCompostos(100000, 1, 12)).toBe(112683);
    expect(poderDeCompra(100000, 4.58)).toBe(95621);
    expect(cdbEquivalente(90, 17.5).toFixed(2)).toBe("109.09");
  });

  it("o FGC usado nos textos é o conferido no site do FGC", () => {
    expect(fgc).toMatchObject({ porInstituicaoReais: 250_000, tetoGlobalReais: 1_000_000, janelaAnos: 4 });
    expect(artigo("cdb-lci-lca-e-fgc")).toContain("R$ 1 milhão por CPF num período de 4 anos");
  });
});


describe("presets do GraficoArtigo", () => {
  it("simulação de juros compostos em 10, 20 e 30 anos com aportes de R$ 500", () => {
    const dezAnos = simularJurosCompostosAportes(emCentavos(500), 10, 10);
    expect(dezAnos).toHaveLength(11);
    expect(dezAnos[0]).toEqual({ ano: 0, rotulo: "Ano 0", investido: 0, juros: 0, total: 0 });
    const p10 = dezAnos[10]!;
    expect(p10.investido).toBe(60000);
    expect(p10.total).toBeGreaterThan(100000);
    expect(p10.juros).toBe(p10.total - p10.investido);

    const trintaAnos = simularJurosCompostosAportes(emCentavos(500), 10, 30);
    const p30 = trintaAnos[30]!;
    expect(p30.investido).toBe(180000);
    expect(p30.total).toBeGreaterThan(1000000); // Mais de 1 milhão
    expect(p30.juros).toBeGreaterThan(p30.investido * 4); // Juros superam em mais de 4x o investido
    expect(p30.juros / p30.total).toBeGreaterThan(0.8); // "mais de 80% do patrimônio final"

    const p20 = simularJurosCompostosAportes(emCentavos(500), 10, 20)[20]!;
    expect(p20.juros).toBeGreaterThan(p20.investido * 2); // "ultrapassam o dobro"
  });

  it("a taxa dos juros compostos está rotulada como hipotética, antes de imposto e inflação", () => {
    const p = PRESETS_GRAFICO_ARTIGO["juros-compostos"];
    expect(p.titulo).toContain("taxa hipotética");
    expect(p.descricao).toContain("antes de imposto e inflação");
  });

  it("todos os 5 presets estão catalogados e possuem dados válidos", () => {
    const chaves = ["juros-compostos", "pl-setorial", "renda-fixa-curva", "ir-aliquotas", "fiis-proventos"] as const;
    expect(Object.keys(PRESETS_GRAFICO_ARTIGO).sort()).toEqual([...chaves].sort());
    for (const c of chaves) {
      const p = PRESETS_GRAFICO_ARTIGO[c];
      expect(p).toBeDefined();
      expect(p.titulo.length).toBeGreaterThan(5);
      expect(p.cenarios.length).toBeGreaterThanOrEqual(2);
      for (const cen of p.cenarios) {
        expect(cen.dados.length).toBeGreaterThan(0);
        expect(cen.series.length).toBeGreaterThan(0);
      }
    }
  });

  it("os gráficos com números inventados dizem que são hipotéticos, em todos os cenários", () => {
    for (const c of ["pl-setorial", "renda-fixa-curva", "fiis-proventos"] as const) {
      const p = PRESETS_GRAFICO_ARTIGO[c];
      expect(p.titulo, c).toMatch(/hipot[eé]tic/);
      for (const cen of p.cenarios) expect(`${cen.rotulo} ${cen.descricao ?? ""}`, `${c}/${cen.id}`).toMatch(/hipot[eé]tic/i);
    }
  });

  it("nenhum gráfico hipotético usa mês real, ticker real ou 'média do setor'", () => {
    const textos = JSON.stringify([PRESETS_GRAFICO_ARTIGO["pl-setorial"], PRESETS_GRAFICO_ARTIGO["renda-fixa-curva"], PRESETS_GRAFICO_ARTIGO["fiis-proventos"]]);
    expect(textos).not.toMatch(/\b(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{2}\b/);
    expect(textos).not.toMatch(/\b[A-Z]{4}\d{1,2}\b/);
    expect(textos).not.toMatch(/m[eé]dia do setor|P\/L m[eé]dio|P\/VP m[eé]dio/i);
    expect(textos).not.toContain("Selic");
  });

  it("fiis-proventos: 12 meses rotulados de Mês 1 a Mês 12, sem generalização sobre tipos de fundo", () => {
    expect(PROVENTOS_HIPOTETICOS_DE_FII.map((m) => m.mes)).toEqual(Array.from({ length: 12 }, (_, i) => `Mês ${i + 1}`));
    const p = PRESETS_GRAFICO_ARTIGO["fiis-proventos"];
    expect(p.titulo).toContain("exemplo hipotético, não é de nenhum fundo");
    expect(JSON.stringify(p)).not.toContain("lineares");
    for (const cen of p.cenarios) expect(cen.dados).toHaveLength(12);
  });

  it("ir-aliquotas: o ETF de renda fixa segue o prazo médio da carteira (Lei 13.043/2014, art. 2º)", () => {
    expect(ALIQUOTAS_ETF_RENDA_FIXA).toEqual({ ate180: 25, ate720: 20, acima720: 15 });
    const etf = PRESETS_GRAFICO_ARTIGO["ir-aliquotas"].cenarios.find((c) => c.id === "etf-renda-fixa")!;
    expect(etf.dados.map((d) => d.aliquota)).toEqual([25, 20, 15]);
    expect(etf.descricao).toContain("prazo médio da carteira");
  });
});
