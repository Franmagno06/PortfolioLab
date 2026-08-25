import type { TransactionKind } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

export const transactionsRepository = {
  create(data: {
    userId: string;
    assetId: string;
    kind: TransactionKind;
    quantity: number;
    unitPrice: number;
    fee: number;
    executedAt: Date;
  }) {
    return prisma.transaction.create({ data });
  },

  findManyByUser(userId: string) {
    return prisma.transaction.findMany({
      where: { userId },
      include: { asset: { select: { ticker: true, name: true, type: true } } },
      orderBy: { executedAt: "desc" },
    });
  },

  findByIdAndUser(id: string, userId: string) {
    return prisma.transaction.findFirst({
      where: { id, userId },
      include: { asset: { select: { ticker: true } } },
    });
  },

  // Todas as transações do usuário em UM ativo, para recalcular a posição
  findManyByUserAndAsset(userId: string, assetId: string) {
    return prisma.transaction.findMany({
      where: { userId, assetId },
      select: {
        id: true,
        kind: true,
        quantity: true,
        unitPrice: true,
        fee: true,
        executedAt: true,
      },
    });
  },

  delete(id: string) {
    return prisma.transaction.delete({ where: { id } });
  },
};
