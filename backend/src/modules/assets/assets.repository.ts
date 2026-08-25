import { prisma } from "../../database/prisma.js";

export const assetsRepository = {
  // A tabela assets é global — cresce toda vez que qualquer usuário registra um
  // ticker novo. O catálogo de UM usuário são os ativos em que ele tem algum
  // vínculo: transação, meta ou provento.
  findAllByUser(userId: string) {
    return prisma.asset.findMany({
      where: {
        OR: [
          { transactions: { some: { userId } } },
          { goals: { some: { userId } } },
          { dividends: { some: { userId } } },
        ],
      },
      orderBy: { ticker: "asc" },
    });
  },

  findByTicker(ticker: string) {
    return prisma.asset.findUnique({ where: { ticker } });
  },
};
