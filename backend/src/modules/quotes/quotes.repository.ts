import type { AssetType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

export const quotesRepository = {
  findByTicker(ticker: string) {
    return prisma.asset.findUnique({ where: { ticker } });
  },

  create(data: {
    ticker: string;
    name: string;
    type: AssetType;
    currentPrice: number;
    cnpj: string | null;
  }) {
    // upsert sem update: duas contas cadastrando o mesmo ticker novo ao mesmo
    // tempo davam P2002 (ticker é único) e um 500. Assim a segunda recebe a
    // linha que a primeira gravou.
    return prisma.asset.upsert({
      where: { ticker: data.ticker },
      create: { ...data, priceUpdatedAt: new Date() },
      update: {},
    });
  },

  /** Completa o CNPJ de ativo cadastrado antes da tabela existir. updateMany pelo mesmo motivo de updatePrice. */
  updateCnpj(ticker: string, cnpj: string) {
    return prisma.asset.updateMany({ where: { ticker, cnpj: null }, data: { cnpj } });
  },

  /**
   * Grava a cotação recém-buscada.
   *
   * updateMany, e não update, de propósito: a mesma linha é atualizada por
   * requisições concorrentes de usuários diferentes (a tabela assets é global),
   * e o update lança P2025 se a linha não estiver mais lá — o que derrubaria
   * um GET de carteira por causa de uma escrita oportunista.
   */
  updatePrice(ticker: string, preco: number, em: Date) {
    return prisma.asset.updateMany({
      where: { ticker },
      data: { currentPrice: preco, priceUpdatedAt: em },
    });
  },
};
