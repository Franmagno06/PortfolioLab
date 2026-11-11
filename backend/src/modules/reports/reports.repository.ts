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
    analysis: Prisma.InputJsonValue;
  }) {
    return prisma.report.create({ data });
  },

  /** O relatório da CVM que a conta já guardou para este ativo e período, se houver. */
  findCvmByUserAssetPeriod(userId: string, assetId: string, period: string) {
    return prisma.report.findFirst({
      where: { userId, assetId, period, source: "CVM" },
      select: { id: true, fileName: true, createdAt: true, analysis: true },
      orderBy: { createdAt: "desc" },
    });
  },

  updateAnalysis(id: string, analysis: Prisma.InputJsonValue) {
    return prisma.report.update({ where: { id }, data: { analysis }, select: { id: true } });
  },

  // lista sem o extractedText: relatórios antigos, de PDF enviado, guardam centenas de KB de texto
  findManyByUser(userId: string, pagina: { take: number; cursor?: string }) {
    return prisma.report.findMany({
      where: { userId },
      select: {
        id: true,
        fileName: true,
        analysis: true,
        source: true,
        period: true,
        asset: { select: { ticker: true, name: true, type: true } },
        createdAt: true,
      },
      // o id desempata relatórios criados no mesmo instante, pelo mesmo motivo
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
    return prisma.report.findFirst({ where: { id, userId }, select: { id: true } });
  },

  delete(id: string) {
    return prisma.report.delete({ where: { id } });
  },

  findCvmSummary(assetId: string, period: string) {
    return prisma.cvmSummary.findUnique({ where: { assetId_period: { assetId, period } } });
  },

  /**
   * upsert, e não create: dois usuários consultando o mesmo trimestre ao mesmo tempo passam os dois
   * pelo cache vazio, e o segundo não pode falhar por violar a unique. O `update` grava a análise
   * nova por cima: só se chega aqui quando a guardada não existe ou é de uma versão anterior das
   * regras (ver ehAnaliseAtual).
   */
  saveCvmSummary(assetId: string, period: string, analysis: Prisma.InputJsonValue) {
    return prisma.cvmSummary.upsert({
      where: { assetId_period: { assetId, period } },
      create: { assetId, period, analysis },
      update: { analysis },
    });
  },
};
