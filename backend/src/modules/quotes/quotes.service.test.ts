import { AssetType } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../database/prisma.js";
import { quotesService } from "./quotes.service.js";

// A B3 fica sob controle: `fonte.preco = null` simula o provedor fora do ar.
const fonte = vi.hoisted(() => ({ preco: 32 as number | null }));

vi.mock("./quotes.provider.js", () => {
  const cotacaoDe = (ticker: string) =>
    fonte.preco === null
      ? null
      : { ticker: ticker.toUpperCase(), nome: "Ativo de Teste S.A.", preco: fonte.preco, tipo: "ACAO" };

  return {
    buscarCotacao: async (ticker: string) => cotacaoDe(ticker),
    buscarCotacoes: async (tickers: string[]) => {
      const mapa = new Map();
      for (const t of tickers) {
        const c = cotacaoDe(t);
        if (c) mapa.set(c.ticker, c);
      }
      return mapa;
    },
    classificar: () => "ACAO",
  };
});

const VELHO = "TXQT1"; // cotação vencida: precisa buscar
const FRESCO = "TXQT2"; // cotação recente: não busca
const FIXA = "TXQT3"; // renda fixa: nunca é cotada em bolsa

const HA_DUAS_HORAS = new Date(Date.now() - 2 * 60 * 60 * 1000);

async function semearAtivos() {
  await prisma.asset.deleteMany({ where: { ticker: { in: [VELHO, FRESCO, FIXA] } } });
  await prisma.asset.createMany({
    data: [
      { ticker: VELHO, name: "Velho S.A.", type: AssetType.ACAO, currentPrice: 38.2, priceUpdatedAt: HA_DUAS_HORAS },
      { ticker: FRESCO, name: "Fresco S.A.", type: AssetType.ACAO, currentPrice: 50, priceUpdatedAt: new Date() },
      { ticker: FIXA, name: "Tesouro Teste", type: AssetType.RENDA_FIXA, currentPrice: 100, priceUpdatedAt: null },
    ],
  });
  return prisma.asset.findMany({ where: { ticker: { in: [VELHO, FRESCO, FIXA] } } });
}

beforeEach(async () => {
  fonte.preco = 32;
});

afterAll(async () => {
  await prisma.asset.deleteMany({ where: { ticker: { in: [VELHO, FRESCO, FIXA] } } });
  await prisma.$disconnect();
});

// Achado 1: a simulação usava dois preços do mesmo ativo. A resolução passa a
// ser feita num lugar só, e todo mundo consome o mesmo mapa.
describe("quotesService.resolverPrecos", () => {
  it("troca pelo preço vivo o ativo com cotação vencida", async () => {
    const ativos = await semearAtivos();
    const precos = await quotesService.resolverPrecos(ativos);

    expect(precos.get(VELHO)?.toNumber()).toBe(32);
  });

  it("grava no banco o preço que devolveu", async () => {
    const ativos = await semearAtivos();
    await quotesService.resolverPrecos(ativos);

    const gravado = await prisma.asset.findUniqueOrThrow({ where: { ticker: VELHO } });
    expect(gravado.currentPrice.toNumber()).toBe(32);
    expect(gravado.priceUpdatedAt?.getTime()).toBeGreaterThan(HA_DUAS_HORAS.getTime());
  });

  it("mantém o preço do banco quando a cotação ainda está fresca", async () => {
    const ativos = await semearAtivos();
    const precos = await quotesService.resolverPrecos(ativos);

    expect(precos.get(FRESCO)?.toNumber()).toBe(50);
  });

  it("não cota renda fixa — não é negociada em bolsa", async () => {
    const ativos = await semearAtivos();
    const precos = await quotesService.resolverPrecos(ativos);

    expect(precos.get(FIXA)?.toNumber()).toBe(100);
    const gravado = await prisma.asset.findUniqueOrThrow({ where: { ticker: FIXA } });
    expect(gravado.priceUpdatedAt).toBeNull();
  });

  it("provedor fora do ar → mantém o último preço conhecido, sem quebrar", async () => {
    const ativos = await semearAtivos();
    fonte.preco = null;

    const precos = await quotesService.resolverPrecos(ativos);

    expect(precos.get(VELHO)?.toNumber()).toBe(38.2);
    const gravado = await prisma.asset.findUniqueOrThrow({ where: { ticker: VELHO } });
    expect(gravado.currentPrice.toNumber()).toBe(38.2);
  });

  it("devolve um preço por ticker mesmo recebendo o mesmo ativo duas vezes", async () => {
    const ativos = await semearAtivos();
    const precos = await quotesService.resolverPrecos([...ativos, ...ativos]);

    expect(precos.size).toBe(3);
  });

  it("lista vazia não consulta nada", async () => {
    const precos = await quotesService.resolverPrecos([]);
    expect(precos.size).toBe(0);
  });
});
