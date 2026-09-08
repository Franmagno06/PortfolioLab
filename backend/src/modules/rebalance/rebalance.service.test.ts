import { describe, expect, it } from "vitest";
import { calcularAporte, type CandidatoAporte } from "./rebalance.service.js";

// Testes UNITÁRIOS do algoritmo guloso — função pura, sem banco.
// Cobrem os cenários-limite exigidos no roadmap.

function ativo(
  ticker: string,
  precoAtual: number,
  valorAtual: number,
  alvoPct: number,
): CandidatoAporte {
  return { ticker, name: ticker, precoAtual, valorAtual, alvoPct };
}

describe("calcularAporte — algoritmo guloso de rebalanceamento", () => {
  it("aporte insuficiente para 1 unidade → nenhuma compra, dinheiro sobra", () => {
    const r = calcularAporte([ativo("CARO11", 500, 0, 100)], 100, 0);
    expect(r.compras).toHaveLength(0);
    expect(r.restante).toBe(100);
    expect(r.totalGasto).toBe(0);
  });

  it("carteira vazia → distribui o aporte proporcionalmente às metas", () => {
    const r = calcularAporte([ativo("A", 10, 0, 50), ativo("B", 20, 0, 50)], 100, 0);
    // déficits iguais (R$50 cada) → empate → menor preço compra primeiro
    expect(r.compras[0]).toMatchObject({ ticker: "A", quantidade: 5, total: 50 });
    expect(r.compras[1]).toMatchObject({ ticker: "B", quantidade: 2, total: 40 });
    expect(r.restante).toBe(10);
  });

  it("todos os ativos acima da meta → nenhuma compra", () => {
    // patrimônio 1000 + aporte 100 = 1100
    // A: meta 20% (R$220), possui R$600 → excesso
    // B: meta 30% (R$330), possui R$400 → excesso
    const r = calcularAporte([ativo("A", 10, 600, 20), ativo("B", 10, 400, 30)], 100, 1000);
    expect(r.compras).toHaveLength(0);
    expect(r.restante).toBe(100);
  });

  it("prioriza o ativo com MAIOR déficit", () => {
    // patrimônio 900 + 100 = 1000
    // A: meta 50% (R$500), possui R$300 → déficit R$200
    // B: meta 50% (R$500), possui R$600 → excesso (não recebe)
    const r = calcularAporte([ativo("A", 10, 300, 50), ativo("B", 10, 600, 50)], 100, 900);
    expect(r.compras).toHaveLength(1);
    expect(r.compras[0]).toMatchObject({ ticker: "A", quantidade: 10, total: 100 });
  });

  it("não compra além do déficit de cada ativo", () => {
    // aporte 100, carteira vazia: B (meta 70%) déficit 70, A (meta 30%) déficit 30
    const r = calcularAporte([ativo("A", 10, 0, 30), ativo("B", 10, 0, 70)], 100, 0);
    expect(r.compras[0]).toMatchObject({ ticker: "B", quantidade: 7 });
    expect(r.compras[1]).toMatchObject({ ticker: "A", quantidade: 3 });
    expect(r.restante).toBe(0);
  });

  it("nunca compra fração de unidade (floor)", () => {
    const r = calcularAporte([ativo("A", 33, 0, 100)], 100, 0);
    expect(r.compras[0]?.quantidade).toBe(3); // 3 × 33 = 99
    expect(r.restante).toBe(1);
  });

  it("empate total de déficit e preço → desempata por ticker (determinístico)", () => {
    const r = calcularAporte([ativo("ZZZ", 10, 0, 50), ativo("AAA", 10, 0, 50)], 40, 0);
    expect(r.compras[0]?.ticker).toBe("AAA");
  });

  it("alocação 'antes vs. depois' aproxima o ativo da meta", () => {
    // A: 0% da carteira, meta 50% · B: 100% da carteira, meta 50%
    // patrimônio 100 + aporte 100 → todo o aporte vai para A
    const r = calcularAporte([ativo("A", 10, 0, 50), ativo("B", 10, 100, 50)], 100, 100);
    const a = r.alocacao.find((x) => x.ticker === "A");
    expect(a?.atualPct).toBe(0);
    expect(a?.aposAportePct).toBe(50); // saiu de 0% e chegou exatamente na meta
  });
});

describe("achado 16 — ativo sem preço", () => {
  // REGRESSÃO: o guarda contra divisão por zero entrou na Onda 1. Este teste
  // existe para que ele não volte a sair, não como parte do ciclo TDD do achado.
  it("regressão: preço zero não derruba a simulação nem vira compra", () => {
    const r = calcularAporte([ativo("SEMPRECO", 0, 0, 100)], 1000, 0);

    expect(r.compras).toHaveLength(0);
    expect(r.restante).toBe(1000);
  });

  it("o ativo ignorado consta do resultado com o motivo", () => {
    const r = calcularAporte([ativo("SEMPRECO", 0, 0, 100)], 1000, 0);

    expect(r.ignorados).toEqual([
      { ticker: "SEMPRECO", motivo: "sem cotação disponível — preço zerado" },
    ]);
  });

  it("um ativo sem preço não impede os outros de receberem o aporte", () => {
    const r = calcularAporte([ativo("SEMPRECO", 0, 0, 50), ativo("BOM", 10, 0, 50)], 100, 0);

    expect(r.compras).toHaveLength(1);
    expect(r.compras[0]).toMatchObject({ ticker: "BOM", quantidade: 5 });
    expect(r.ignorados.map((i) => i.ticker)).toEqual(["SEMPRECO"]);
  });

  it("sem ativo problemático, a lista de ignorados vem vazia", () => {
    const r = calcularAporte([ativo("A", 10, 0, 100)], 100, 0);

    expect(r.ignorados).toEqual([]);
  });

  // Se 'ignorados' só contasse o preço zerado, um cliente que a lesse vazia
  // concluiria "todos os ativos foram considerados" — falso sempre que o
  // aporte não cobre uma unidade sequer.
  it("ativo caro demais para uma unidade também é reportado", () => {
    const r = calcularAporte([ativo("CARO11", 500, 0, 100)], 100, 0);

    expect(r.compras).toHaveLength(0);
    expect(r.ignorados).toEqual([
      { ticker: "CARO11", motivo: "1 unidade custa R$ 500,00 e o déficit do ativo é menor" },
    ]);
  });

  it("separa 'o dinheiro acabou' de 'o déficit não paga uma unidade'", () => {
    // A leva quase todo o aporte por ter o maior déficit. B fica de fora, mas
    // não por ser caro: R$ 300 caberiam nos R$ 1.000 iniciais. Dizer "aporte
    // insuficiente para 1 unidade" culparia o preço de B pelo que a ordem de
    // alocação causou.
    // Carteira de R$ 10.000 e aporte de R$ 100. Os dois têm déficit de
    // R$ 5.050, muito acima do aporte. A cota de A custa R$ 1 e a de B custa
    // R$ 80: o aporte inteiro cabe em A, e quando chega a vez de B não há
    // R$ 80 sobrando. B fica sem compra por falta de dinheiro, não por preço.
    const r = calcularAporte(
      [ativo("A", 1, 0, 50), ativo("B", 80, 0, 50)],
      100,
      10_000,
    );

    expect(r.compras.map((c) => c.ticker)).toEqual(["A"]);
    expect(r.ignorados).toEqual([
      { ticker: "B", motivo: "o aporte acabou antes de sobrar para este ativo" },
    ]);
  });

  it("o déficit menor que uma unidade é reportado como tal", () => {
    // Aqui sobra dinheiro de verdade: o que não cabe é o déficit de B, de
    // R$ 50, dentro de uma cota de R$ 500.
    const r = calcularAporte(
      [ativo("A", 1, 0, 95), ativo("CARO11", 500, 0, 5)],
      1000,
      0,
    );

    expect(r.restante).toBeGreaterThan(0);
    expect(r.ignorados).toEqual([
      { ticker: "CARO11", motivo: "1 unidade custa R$ 500,00 e o déficit do ativo é menor" },
    ]);
  });

  it("patrimônio final conta o que virou ativo, não o aporte inteiro", () => {
    // Aporte de R$ 1.000 numa cota de R$ 300: compra 3 e sobram R$ 100. O
    // patrimônio final é R$ 900 maior, não R$ 1.000 — o troco não vira ativo.
    const r = calcularAporte([ativo("A", 300, 0, 100)], 1000, 0);

    expect(r.totalGasto).toBe(900);
    expect(r.restante).toBe(100);
    expect(r.patrimonioFinal).toBe(900);
    expect(r.patrimonioProjetado).toBe(1000);
  });

  it("o percentual depois usa a mesma base que o patrimônio final", () => {
    // Sem isto, o alvo é medido numa régua e o resultado noutra: a diferença
    // é o troco, e ela cresce quando sobra muito.
    const r = calcularAporte([ativo("A", 300, 0, 100)], 1000, 0);
    const depois = r.alocacao.find((a) => a.ticker === "A");

    // 3 cotas de R$ 300 = R$ 900, sobre um patrimônio final de R$ 900
    expect(depois?.aposAportePct).toBe(100);
  });

  it("ativo acima da meta não é 'ignorado' — aparece na alocação", () => {
    // B possui R$600 com meta de 20%: não recebe aporte, mas isso é o
    // algoritmo funcionando, não uma anomalia a reportar.
    const r = calcularAporte([ativo("A", 10, 0, 80), ativo("B", 10, 600, 20)], 100, 1000);

    expect(r.ignorados.map((i) => i.ticker)).not.toContain("B");
    expect(r.alocacao.map((a) => a.ticker)).toContain("B");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Distribuição proporcional ao déficit, com segunda passada
//
// O algoritmo guloso anterior dava a cada ativo o mínimo entre o déficit e o
// dinheiro restante, na ordem do maior déficit. Quando o aporte é menor que a
// soma dos déficits — o caso normal — o primeiro da fila levava quase tudo.
// Medido na carteira de demonstração: BBAS3 ficava com 89% de um aporte de
// R$ 3.000, e metade dos ativos abaixo da meta não recebia nada.
// ─────────────────────────────────────────────────────────────────────────
describe("calcularAporte — distribuição proporcional", () => {
  it("reparte o aporte na proporção do déficit, em vez de encher o primeiro", () => {
    // Déficits de 3:1. O aporte de R$ 400 não cobre os R$ 800 somados, então
    // a proporção decide: R$ 300 para A e R$ 100 para B.
    const r = calcularAporte(
      [ativo("A", 1, 0, 60), ativo("B", 1, 0, 20)],
      400,
      600,
    );

    const gasto = (t: string) => r.compras.find((c) => c.ticker === t)?.total ?? 0;
    expect(gasto("A")).toBe(300);
    expect(gasto("B")).toBe(100);
  });

  it("nenhum ativo recebe mais do que o próprio déficit", () => {
    // B tem déficit pequeno; a fatia proporcional dele não pode ultrapassá-lo
    // só porque sobrou dinheiro.
    const r = calcularAporte(
      [ativo("A", 1, 0, 90), ativo("B", 1, 90, 10)],
      1000,
      100,
    );

    for (const c of r.compras) {
      expect(c.total).toBeLessThanOrEqual(c.deficit);
    }
  });

  it("a segunda passada aproveita o troco da primeira", () => {
    // Déficit de R$ 250 em cada, cota de R$ 100, aporte de R$ 300. A fatia
    // proporcional é R$ 150 por ativo, que compra 1 cota e deixa R$ 50 parado
    // em cada. Somados, os R$ 100 de troco compram mais uma cota — e cabem no
    // déficit de quem a recebe, sem empurrar o ativo acima da meta.
    const r = calcularAporte(
      [ativo("A", 100, 0, 50), ativo("B", 100, 0, 50)],
      300,
      200,
    );

    expect(r.totalGasto).toBe(300);
    expect(r.restante).toBe(0);
    expect(r.compras.reduce((s, c) => s + c.quantidade, 0)).toBe(3);
  });

  it("o troco fica em caixa quando gastá-lo passaria da meta", () => {
    // Déficit de R$ 150 em cada e cota de R$ 100: depois de uma cota para
    // cada, restam R$ 50 de déficit por ativo e R$ 100 no bolso. Comprar mais
    // uma cota jogaria um dos dois acima da meta, que é o contrário do que a
    // simulação existe para fazer. O dinheiro sobra, e a tela diz isso.
    const r = calcularAporte(
      [ativo("A", 100, 0, 50), ativo("B", 100, 0, 50)],
      300,
      0,
    );

    expect(r.totalGasto).toBe(200);
    expect(r.restante).toBe(100);
  });

  it("cobre o déficit inteiro quando o aporte dá para todos", () => {
    // Aporte maior que a soma dos déficits: cada ativo chega à meta e o que
    // sobra não tem onde ser aplicado.
    const r = calcularAporte(
      [ativo("A", 1, 0, 50), ativo("B", 1, 0, 50)],
      1000,
      0,
    );

    expect(r.totalGasto).toBe(1000);
    const gasto = (t: string) => r.compras.find((c) => c.ticker === t)?.total ?? 0;
    expect(gasto("A")).toBe(500);
    expect(gasto("B")).toBe(500);
  });

  it("não gasta mais do que o aporte", () => {
    const r = calcularAporte(
      [ativo("A", 7, 0, 40), ativo("B", 13, 0, 35), ativo("C", 3, 0, 25)],
      1000,
      5000,
    );

    expect(r.totalGasto).toBeLessThanOrEqual(1000);
    expect(r.totalGasto + r.restante).toBe(1000);
  });

  it("espalha o aporte por mais ativos do que o guloso espalhava", () => {
    // Reprodução reduzida da carteira de demonstração: um ativo com déficit
    // grande e vários menores. Antes, o primeiro consumia o aporte e três
    // ficavam sem nada.
    const r = calcularAporte(
      [
        ativo("GRANDE", 20, 0, 40),
        ativo("MEDIO1", 20, 0, 20),
        ativo("MEDIO2", 20, 0, 20),
        ativo("MEDIO3", 20, 0, 20),
      ],
      2000,
      8000,
    );

    expect(r.compras).toHaveLength(4);
    const doGrande = r.compras.find((c) => c.ticker === "GRANDE")?.total ?? 0;
    expect(doGrande).toBeLessThan(r.totalGasto * 0.6);
  });

  it("é determinístico: mesma carteira, mesma sugestão", () => {
    const carteira = () => [
      ativo("AAA3", 17.5, 120, 30),
      ativo("BBB4", 33.33, 80, 45),
      ativo("CCC11", 9.9, 200, 25),
    ];

    const um = calcularAporte(carteira(), 777, 1234.56);
    const dois = calcularAporte(carteira(), 777, 1234.56);

    expect(JSON.stringify(um)).toBe(JSON.stringify(dois));
  });
});
