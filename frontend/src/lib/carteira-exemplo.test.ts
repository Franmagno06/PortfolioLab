import { describe, expect, it } from "vitest";
import {
  alocacaoDepois,
  CARTEIRA_EXEMPLO,
  custoDasCompras,
  desvioDasMetas,
  pesoPorClasse,
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

describe("pesoPorClasse", () => {
  it("agrupa atual e meta por classe, somando 100% cada", () => {
    const pesos = pesoPorClasse(CARTEIRA_EXEMPLO);
    expect(pesos.reduce((s, p) => s + p.atual, 0)).toBeCloseTo(100, 6);
    expect(pesos.reduce((s, p) => s + p.meta, 0)).toBe(100);
  });
});
