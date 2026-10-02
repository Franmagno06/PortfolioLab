import type { Prisma, ReportSource } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { argumentosDeCursor } from "../../shared/paginacao.js";

export const reportsRepository = {
  create(data: {
    userId: string;
    fileName: string;
    source: ReportSource;
    assetId: string | null;
    period: string | null;
    extractedText: string | null;
    contentHash?: string | null;
    analysis: Prisma.InputJsonValue;
  }) {
    return prisma.report.create({ data });
  },

  /**
   * Relatório já analisado a partir do mesmo arquivo, de qualquer conta. Só
   * os de origem PDF: é o texto extraído que alimenta o chat, e os da CVM não
   * o guardam (e têm cache próprio, por ativo e período).
   */
  findPdfByContentHash(contentHash: string) {
    return prisma.report.findFirst({
      where: { contentHash, source: "PDF", extractedText: { not: null } },
      select: { extractedText: true, analysis: true },
      orderBy: { createdAt: "desc" },
    });
  },

  // lista sem o extractedText (pode ter centenas de KB por relatório)
  findManyByUser(userId: string, pagina: { take: number; cursor?: string }) {
    return prisma.report.findMany({
      where: { userId },
      select: {
        id: true,
        fileName: true,
        analysis: true,
        source: true,
        period: true,
        asset: { select: { ticker: true } },
        createdAt: true,
      },
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

  findCvmSummary(assetId: string, period: string) {
    return prisma.cvmSummary.findUnique({ where: { assetId_period: { assetId, period } } });
  },

  /**
   * upsert, e não create: dois usuários enviando o release do mesmo trimestre
   * ao mesmo tempo passam os dois pelo cache vazio. O segundo não pode falhar
   * por violar a unique — a análise dele é tão boa quanto a do primeiro.
   */
  saveCvmSummary(assetId: string, period: string, analysis: Prisma.InputJsonValue) {
    return prisma.cvmSummary.upsert({
      where: { assetId_period: { assetId, period } },
      create: { assetId, period, analysis },
      update: {},
    });
  },
};
