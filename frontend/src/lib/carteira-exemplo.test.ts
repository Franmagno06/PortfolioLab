import { describe, expect, it } from "vitest";
import {
  alocacaoDepois,
  CARTEIRA_EXEMPLO,
  custoDasCompras,
  aplicarCompras,
  APORTE_DO_DESAFIO,
  CARTEIRA_DE_NOVEMBRO,
  COMPRAS_DE_OUTUBRO,
  desvioDasMetas,
  situacaoNoAporte,
  type AtivoExemplo,
} from "./carteira-exemplo";

const dupla: AtivoExemplo[] = [
  { ticker: "AAAA11", nome: "A", classe: "FII", preco: 10, quantidade: 100, meta: 50 },
  { ticker: "BBBB3", nome: "B", classe: "ACAO", preco: 10, quantidade: 300, meta: 50 },
];

describe("carteira de exemplo", () => {
  it("as metas fecham 100%", () => {
    expect(CARTEIRA_EXEMPLO.reduce((s, a) => s + a.meta, 0)).toBe(100);
  });

  it("começa desequilibrada, senão o desafio não tem graça", () => {
    expect(desvioDasMetas(CARTEIRA_EXEMPLO, {})).toBeGreaterThan(5);
  });
});

describe("custoDasCompras", () => {
  it("soma quantidade × preço só do que foi comprado", () => {
    expect(custoDasCompras(dupla, { AAAA11: 3 })).toBe(30);
    expect(custoDasCompras(dupla, {})).toBe(0);
  });
});

describe("alocacaoDepois", () => {
  it("recalcula os percentuais com as compras somadas à posição", () => {
    // 100+100 = 200 cotas × 10 contra 300 × 10 → 40% e 60%
    expect(alocacaoDepois(dupla, { AAAA11: 100 })).toEqual([
      { ticker: "AAAA11", pct: 40 },
      { ticker: "BBBB3", pct: 60 },
    ]);
  });
});

describe("desvioDasMetas", () => {
  it("conta cada ponto fora do lugar uma vez só", () => {
    // 25% e 75% contra metas de 50/50: 25 pontos estão no lugar errado
    expect(desvioDasMetas(dupla, {})).toBe(25);
  });

  it("zera quando a carteira bate as metas", () => {
    expect(desvioDasMetas(dupla, { AAAA11: 200 })).toBe(0);
  });

  it("comprar o que está abaixo da meta reduz o desvio; o que está acima, aumenta", () => {
    const antes = desvioDasMetas(dupla, {});
    expect(desvioDasMetas(dupla, { AAAA11: 10 })).toBeLessThan(antes);
    expect(desvioDasMetas(dupla, { BBBB3: 10 })).toBeGreaterThan(antes);
  });
});

// Os números impressos na folha do topo da página inicial. Os mesmos valores
// estão fixados no backend (rebalance.exemplo.test.ts), que roda o algoritmo.
describe("aporte de outubro e carteira de novembro", () => {
  const umaCasa = (v: number) => Math.round(v * 10) / 10;

  it("aplicarCompras soma as cotas compradas e mantém o resto", () => {
    const depois = aplicarCompras(CARTEIRA_EXEMPLO, { TAEE11: 16, HGLG11: 2 });
    const cotas = Object.fromEntries(depois.map((a) => [a.ticker, a.quantidade]));

    expect(cotas).toEqual({ MXRF11: 400, HGLG11: 12, BBAS3: 100, TAEE11: 36, BOVA11: 10, IVVB11: 2 });
  });

  it("aplicarCompras não altera a carteira de origem", () => {
    aplicarCompras(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO);
    expect(CARTEIRA_EXEMPLO.find((a) => a.ticker === "TAEE11")?.quantidade).toBe(20);
  });

  it("antes de outubro, a carteira está 20,8 pontos fora das metas", () => {
    expect(umaCasa(desvioDasMetas(CARTEIRA_EXEMPLO, {}))).toBe(20.8);
  });

  it("as compras de outubro levam a 15,1 pontos, o ponto de partida de novembro", () => {
    expect(umaCasa(desvioDasMetas(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO))).toBe(15.1);
    expect(umaCasa(desvioDasMetas(CARTEIRA_DE_NOVEMBRO, {}))).toBe(15.1);
  });

  it("sobram R$ 20,96 do aporte de outubro", () => {
    const sobra = APORTE_DO_DESAFIO - custoDasCompras(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO);
    expect(sobra).toBeCloseTo(20.96, 2);
  });
});

describe("situacaoNoAporte", () => {
  const situacao = (ticker: string) => situacaoNoAporte(CARTEIRA_EXEMPLO, COMPRAS_DE_OUTUBRO, ticker);

  it("TAEE11 recebe e é a mais longe da meta", () => {
    expect(situacao("TAEE11")).toMatchObject({ tipo: "mais-longe", meta: 15 });
  });

  it("HGLG11 recebe, abaixo da meta, sem ser a mais longe", () => {
    expect(situacao("HGLG11")).toMatchObject({ tipo: "abaixo", meta: 20 });
  });

  it("IVVB11 está abaixo da meta mas fica para o próximo aporte", () => {
    expect(situacao("IVVB11")).toEqual({ tipo: "ficou-para-depois", preco: 455.12 });
  });

  it("MXRF11 passou da meta e não recebe", () => {
    expect(situacao("MXRF11")).toMatchObject({ tipo: "acima", meta: 20 });
  });

  it("o percentual é o de antes das compras", () => {
    const taee = situacao("TAEE11");
    expect(taee && "atual" in taee ? Math.round(taee.atual * 10) / 10 : null).toBe(7.7);
  });

  it("ticker fora da carteira devolve null", () => {
    expect(situacao("PETR4")).toBeNull();
  });
});
