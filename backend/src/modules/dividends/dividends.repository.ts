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

  findByIdAndUser(id: string, userId: string) {
    return prisma.dividend.findFirst({ where: { id, userId } });
  },

  delete(id: string) {
    return prisma.dividend.delete({ where: { id } });
  },
};
