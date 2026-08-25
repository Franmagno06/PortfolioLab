import type { AssetType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

export const quotesRepository = {
  findByTicker(ticker: string) {
    return prisma.asset.findUnique({ where: { ticker } });
  },

  create(data: { ticker: string; name: string; type: AssetType; currentPrice: number }) {
    return prisma.asset.create({ data: { ...data, priceUpdatedAt: new Date() } });
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
