import { Prisma, type TransactionKind } from "@prisma/client";
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
    return prisma.transaction.findFirst({ where: { id, userId } });
  },

  delete(id: string) {
    return prisma.transaction.delete({ where: { id } });
  },

  // Quantidade atual do usuário em um ativo: soma das compras - soma das vendas
  async quantidadeAtual(userId: string, assetId: string): Promise<Prisma.Decimal> {
    const grupos = await prisma.transaction.groupBy({
      by: ["kind"],
      where: { userId, assetId },
      _sum: { quantity: true },
    });

    const zero = new Prisma.Decimal(0);
    const compras = grupos.find((g) => g.kind === "COMPRA")?._sum.quantity ?? zero;
    const vendas = grupos.find((g) => g.kind === "VENDA")?._sum.quantity ?? zero;
    return new Prisma.Decimal(compras).minus(vendas);
  },
};
