import { prisma } from "../../database/prisma.js";

export const indicatorsRepository = {
  // Só ações têm os indicadores fundamentalistas que esta tela mostra — FII,
  // ETF e renda fixa não têm P/L, P/VP, ROE ou margem líquida no sentido
  // corporativo do termo.
  ativosAcaoDoUsuario(userId: string) {
    return prisma.asset.findMany({
      where: {
        type: "ACAO",
        transactions: { some: { userId } },
      },
      include: { indicator: true },
      orderBy: { ticker: "asc" },
    });
  },

  findAllAcao() {
    return prisma.asset.findMany({ where: { type: "ACAO" } });
  },

  /**
   * `dividendYield` ausente (undefined) significa "não mexa no que está gravado": o
   * Prisma ignora campo undefined no update. É como o DY sobrevive a uma consulta de
   * proventos que falhou, sem virar null nem zero.
   */
  upsert(
    assetId: string,
    data: {
      pl: number | null;
      pvp: number | null;
      dividendYield?: number | null;
      roe: number | null;
      roa: number | null;
      margemLiquida: number | null;
      dividaEbitda: number | null;
      industria: string | null;
    },
  ) {
    return prisma.assetIndicator.upsert({
      where: { assetId },
      create: { assetId, ...data },
      update: data,
    });
  },
};
