import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { argumentosDeCursor } from "../../shared/paginacao.js";

export const dividendsRepository = {
  create(data: { userId: string; assetId: string; amount: number; paidAt: Date }) {
    return prisma.dividend.create({ data });
  },

  findManyByUser(userId: string, pagina: { take: number; cursor?: string }) {
    return prisma.dividend.findMany({
      where: { userId },
      include: { asset: { select: { ticker: true, name: true } } },
      // o id desempata proventos pagos no mesmo dia: sem ordem total o cursor
      // pode pular ou repetir linha entre duas páginas
      orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      take: pagina.take,
      ...argumentosDeCursor(pagina.cursor),
    });
  },

  /**
   * Todas as transações do usuário, com o ticker do ativo, para a
   * sincronização cruzar posição e data-ex. Traz seq porque calcularPosicao
   * usa esse campo para desempatar operações da mesma data.
   */
  findTransacoesDoUsuario(userId: string) {
    return prisma.transaction.findMany({
      where: { userId },
      select: {
        seq: true,
        kind: true,
        quantity: true,
        unitPrice: true,
        fee: true,
        executedAt: true,
        assetId: true,
        asset: { select: { ticker: true } },
      },
      orderBy: [{ executedAt: "asc" }, { seq: "asc" }],
    });
  },

  /**
   * Grava um provento vindo do provedor. O @@unique(userId, assetId, paidAt,
   * source) é o que torna a sincronização idempotente: rodar de novo atualiza
   * a linha em vez de duplicar. Proventos MANUAIS ficam noutra origem e nunca
   * são tocados por aqui.
   */
  upsertDoProvedor(data: {
    userId: string;
    assetId: string;
    paidAt: Date;
    amount: Prisma.Decimal;
    unitAmount: Prisma.Decimal;
  }) {
    const { userId, assetId, paidAt, amount, unitAmount } = data;
    return prisma.dividend.upsert({
      where: {
        userId_assetId_paidAt_source: { userId, assetId, paidAt, source: "PROVEDOR" },
      },
      create: { userId, assetId, paidAt, amount, unitAmount, source: "PROVEDOR" },
      update: { amount, unitAmount },
    });
  },

  /**
   * Apaga os proventos do PROVEDOR de um ativo do usuário cujo `paidAt` não está em
   * `manter`. Só origem PROVEDOR: o que a pessoa lançou à mão nunca sai por aqui.
   */
  removerDoProvedorForaDe(userId: string, assetId: string, manter: Date[]) {
    return prisma.dividend.deleteMany({
      where: { userId, assetId, source: "PROVEDOR", paidAt: { notIn: manter } },
    });
  },

  /**
   * Apaga os proventos do PROVEDOR do usuário de todos os ativos que NÃO estão em `assetIds`
   * (os que ainda têm transação). Só origem PROVEDOR: lançamento manual nunca sai por aqui.
   */
  removerDoProvedorDeAtivosForaDe(userId: string, assetIds: string[]) {
    return prisma.dividend.deleteMany({
      where: { userId, source: "PROVEDOR", assetId: { notIn: assetIds } },
    });
  },

  findByIdAndUser(id: string, userId: string) {
    return prisma.dividend.findFirst({ where: { id, userId } });
  },

  delete(id: string) {
    return prisma.dividend.delete({ where: { id } });
  },
};
