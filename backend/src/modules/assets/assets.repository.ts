import { prisma } from "../../database/prisma.js";

export const assetsRepository = {
  findAll() {
    return prisma.asset.findMany({ orderBy: { ticker: "asc" } });
  },

  findByTicker(ticker: string) {
    return prisma.asset.findUnique({ where: { ticker } });
  },
};
