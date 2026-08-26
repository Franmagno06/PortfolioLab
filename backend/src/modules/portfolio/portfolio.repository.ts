import { prisma } from "../../database/prisma.js";

export const portfolioRepository = {
  transacoesComAtivo(userId: string) {
    return prisma.transaction.findMany({
      where: { userId },
      include: { asset: true },
      // Sem ORDER BY o Postgres não promete ordem nenhuma, e calcularPosicao
      // depende dela. seq desempata o que executedAt não separa.
      orderBy: [{ executedAt: "asc" }, { seq: "asc" }],
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
