import { prisma } from "../../database/prisma.js";

export const goalsRepository = {
  findManyByUser(userId: string) {
    return prisma.assetGoal.findMany({
      where: { userId },
      include: { asset: { select: { ticker: true, name: true, type: true, currentPrice: true } } },
      orderBy: { targetWeight: "desc" },
    });
  },

  // upsert: cria a meta se não existe, atualiza se já existe
  // (o @@unique([userId, assetId]) do schema é o que permite isso)
  upsert(userId: string, assetId: string, targetWeight: number) {
    return prisma.assetGoal.upsert({
      where: { userId_assetId: { userId, assetId } },
      create: { userId, assetId, targetWeight },
      update: { targetWeight },
    });
  },

  deleteByUserAndAsset(userId: string, assetId: string) {
    return prisma.assetGoal.deleteMany({ where: { userId, assetId } });
  },
};
