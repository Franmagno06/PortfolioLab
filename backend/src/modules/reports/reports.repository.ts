import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { argumentosDeCursor } from "../../shared/paginacao.js";

export const reportsRepository = {
  create(data: {
    userId: string;
    fileName: string;
    extractedText: string;
    analysis: Prisma.InputJsonValue;
  }) {
    return prisma.report.create({ data });
  },

  // lista sem o extractedText (pode ter centenas de KB por relatório)
  findManyByUser(userId: string, pagina: { take: number; cursor?: string }) {
    return prisma.report.findMany({
      where: { userId },
      select: { id: true, fileName: true, analysis: true, createdAt: true },
      // o id desempata relatórios enviados no mesmo instante, pelo mesmo motivo
      // que em dividends: o cursor exige ordem total
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pagina.take,
      ...argumentosDeCursor(pagina.cursor),
    });
  },

  countByUser(userId: string) {
    return prisma.report.count({ where: { userId } });
  },

  findByIdAndUser(id: string, userId: string) {
    return prisma.report.findFirst({ where: { id, userId } });
  },

  delete(id: string) {
    return prisma.report.delete({ where: { id } });
  },
};
