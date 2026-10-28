import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dataCurta } from "../format";
import { ATIVO_DE_EXEMPLO, juroReal } from "../site-dados";
import {
  aliquotaDeIrNaRendaFixa,
  aporteDeExemplo,
  cdbEquivalente,
  DADOS_PUBLICOS,
  depoisDaCompra,
  depoisDaVenda,
  dividendYieldPct,
  emCentavos,
  inflacaoMaisJuro,
  jurosCompostos,
  poderDeCompra,
  razaoPct,
  rendimentoDeUmAno,
  rendimentoLiquido,
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

describe("os números do ativo de exemplo (TAEE11, 20/10/2026)", () => {
  it("P/L = preço ÷ lucro por ação", () => {
    expect(ATIVO_DE_EXEMPLO.preco / 4.75).toBeCloseTo(9.66, 2);
    expect(ATIVO_DE_EXEMPLO.lucroPorAcao).toBe(4.75);
    expect(ATIVO_DE_EXEMPLO.pl).toBe(9.66);
  });

  it("P/VP = preço ÷ patrimônio por ação", () => {
    expect(ATIVO_DE_EXEMPLO.preco / 23.4).toBeCloseTo(1.96, 2);
    expect(ATIVO_DE_EXEMPLO.valorPatrimonialPorAcao).toBe(23.4);
    expect(ATIVO_DE_EXEMPLO.pvp).toBe(1.96);
  });

  it("DY = proventos de 12 meses ÷ preço: R$ 3,0065 ÷ R$ 45,87 = 6,55%", () => {
    // os proventos vêm com 4 casas (0,6002 + 0,559 + 0,9089 + 0,9384): arredondar para R$ 3,01 daria 6,56%
    const dy = dividendYieldPct(300.65, emCentavos(45.87));
    expect(dy.toFixed(2)).toBe("6.55");
    expect(ATIVO_DE_EXEMPLO.proventos12m.porUnidade).toBe(3.0065);
    expect(ATIVO_DE_EXEMPLO.dy12m).toBe(6.55);
  });

  it("o artigo P/L e P/VP escreve os mesmos números que a conta dá", () => {
    const texto = artigo("pl-e-pvp");
    for (const trecho of ["R$ 45,87", "≈ R$ 4,75", "≈ R$ 23,40", "9,66", "1,96"]) expect(texto, trecho).toContain(trecho);
  });

  it("os artigos que citam a TAEE11 usam a data do exemplo, e não a antiga", () => {
    for (const slug of ["pl-e-pvp", "dividend-yield", "roe-margem-e-endividamento"]) {
      const texto = artigo(slug);
      expect(texto, slug).toContain(`TAEE11, fechamento de ${dataCurta(ATIVO_DE_EXEMPLO.fechamentoIso)}`);
      expect(texto, slug).not.toContain("02/10/2026");
    }
  });
});

describe("aporte de exemplo: R$ 200 numa carteira vazia, metas 60% e 40%", () => {
  const { compras, sobraCentavos } = aporteDeExemplo(
    [
      { ticker: "MXRF11", metaPct: 60, precoCentavos: emCentavos(10.85), posicaoCentavos: 0 },
      { ticker: "BOVA11", metaPct: 40, precoCentavos: emCentavos(110), posicaoCentavos: 0 },
    ],
    emCentavos(200),
  );

  it("MXRF11: déficit de R$ 120, 11 cotas, custo de R$ 119,35", () => {
    expect(compras[0]).toMatchObject({ ticker: "MXRF11", deficitCentavos: 12000, cotas: 11, custoCentavos: 11935 });
  });

  it("BOVA11: déficit de R$ 80 e nenhuma cota, porque uma custa mais que o déficit", () => {
    expect(compras[1]).toMatchObject({ ticker: "BOVA11", deficitCentavos: 8000, cotas: 0, custoCentavos: 0 });
  });

  it("sobram R$ 80,65 para o próximo aporte", () => {
    expect(sobraCentavos).toBe(8065);
  });

  it("ativo acima da meta não recebe aporte", () => {
    const r = aporteDeExemplo(
      [
        { ticker: "AAAA3", metaPct: 50, precoCentavos: 1000, posicaoCentavos: 9000 },
        { ticker: "BBBB3", metaPct: 50, precoCentavos: 1000, posicaoCentavos: 0 },
      ],
      1000,
    );
    expect(r.compras.find((c) => c.ticker === "AAAA3")?.cotas).toBe(0);
  });
});

describe("juro real (Fisher) com os dados públicos conferidos no Banco Central", () => {
  it("(1 + 13,75%) ÷ (1 + 4,58%) − 1 = 8,77% ao ano", () => {
    const real = juroReal(DADOS_PUBLICOS.selicMeta.valorPct, DADOS_PUBLICOS.ipca12m.valorPct);
    expect(real.toFixed(2)).toBe("8.77");
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
    ["DY da TAEE11", pct(dividendYieldPct(300.65, 4587))],
    ["proventos de 12 meses da TAEE11", "R$ 3,0065"],
    ["preço da TAEE11", "R$ 45,87"],
    ["DY com o preço em queda", pct(dividendYieldPct(300.65, 3000))],
  ],
  "roe-margem-e-endividamento": [
    ["ROE da TAEE11", pct(ATIVO_DE_EXEMPLO.roe)],
    ["lucro para cada R$ 100 de patrimônio", reais(Math.round(ATIVO_DE_EXEMPLO.roe * 100))],
    ["ROE com metade do patrimônio", `${razaoPct(20, 50)}%`],
    ["margem líquida", pct(razaoPct(15, 120), 1)],
    ["dívida sobre EBITDA", "2,0x"],
  ],
  "fiis-tijolo-ou-papel": [
    ["vacância", pct(razaoPct(1500, 20000), 1)],
    ["DY de FII", pct(razaoPct(1.1, 10), 1)],
    ["P/VP de FII", "0,95"],
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
    ["custo das 11 cotas", "R$ 119,35"],
    ["sobra", "R$ 80,65"],
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
