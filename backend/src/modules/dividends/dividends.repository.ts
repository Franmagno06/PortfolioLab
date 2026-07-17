import { prisma } from "../../database/prisma.js";

export const dividendsRepository = {
  create(data: { userId: string; assetId: string; amount: number; paidAt: Date }) {
    return prisma.dividend.create({ data });
  },

  findManyByUser(userId: string) {
    return prisma.dividend.findMany({
      where: { userId },
      include: { asset: { select: { ticker: true, name: true } } },
      orderBy: { paidAt: "desc" },
    });
  },

  findByIdAndUser(id: string, userId: string) {
    return prisma.dividend.findFirst({ where: { id, userId } });
  },

  delete(id: string) {
    return prisma.dividend.delete({ where: { id } });
  },
};
