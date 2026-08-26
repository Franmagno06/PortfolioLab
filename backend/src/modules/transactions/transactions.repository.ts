import type { TransactionKind } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

// Tudo o que a transação expõe pela API. seq não entra: existe só para ordenar
// operações da mesma data dentro de calcularPosicao.
const CAMPOS_PUBLICOS = {
  id: true,
  userId: true,
  assetId: true,
  kind: true,
  quantity: true,
  unitPrice: true,
  fee: true,
  executedAt: true,
} as const;

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
    // seq fica de fora do retorno: é ordenação interna, não dado do cliente —
    // e BigInt nem sobrevive ao JSON.stringify do Express.
    return prisma.transaction.create({ data, select: CAMPOS_PUBLICOS });
  },

  findManyByUser(userId: string) {
    return prisma.transaction.findMany({
      where: { userId },
      select: {
        ...CAMPOS_PUBLICOS,
        asset: { select: { ticker: true, name: true, type: true } },
      },
      // o extrato mostra do mais recente para o mais antigo; dentro do mesmo dia,
      // o inverso exato da ordem em que o preço médio foi calculado
      orderBy: [{ executedAt: "desc" }, { seq: "desc" }],
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
        seq: true,
        kind: true,
        quantity: true,
        unitPrice: true,
        fee: true,
        executedAt: true,
      },
      // mesma ordem determinística de portfolio.repository: as duas alimentam
      // calcularPosicao, e ela precisa ver a sequência sempre igual
      orderBy: [{ executedAt: "asc" }, { seq: "asc" }],
    });
  },

  delete(id: string) {
    return prisma.transaction.delete({ where: { id } });
  },
};
