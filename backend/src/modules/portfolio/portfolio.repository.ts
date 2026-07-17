import { prisma } from "../../database/prisma.js";

export const portfolioRepository = {
  transacoesComAtivo(userId: string) {
    return prisma.transaction.findMany({
      where: { userId },
      include: { asset: true },
    });
  },

  async totalProventos(userId: string) {
    const resultado = await prisma.dividend.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return resultado._sum.amount;
  },
};
