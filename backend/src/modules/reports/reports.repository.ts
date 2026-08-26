import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

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
  findManyByUser(userId: string) {
    return prisma.report.findMany({
      where: { userId },
      select: { id: true, fileName: true, analysis: true, createdAt: true },
      orderBy: { createdAt: "desc" },
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
