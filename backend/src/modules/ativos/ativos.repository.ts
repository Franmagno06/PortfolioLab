import type { AssetType, Prisma, SnapshotType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

// Só este arquivo fala com o Prisma. As páginas de Ativos leem dado público e global
// (assets e a tabela de cache), nunca dado de um usuário.

export const ativosRepository = {
  /** Os ativos que já estão no banco, com o indicador em cache (ações). */
  findAssetsWithIndicator(tickers: string[]) {
    return prisma.asset.findMany({
      where: { ticker: { in: tickers } },
      include: { indicator: true },
    });
  },

  findAssetWithIndicator(ticker: string) {
    return prisma.asset.findUnique({ where: { ticker }, include: { indicator: true } });
  },

  /**
   * Cadastra o ativo se ainda não existir. upsert com update vazio: duas visitas simultâneas
   * à mesma ficha, ambas sem o ativo no banco, não disputam a unique de ticker.
   */
  ensureAsset(data: { ticker: string; name: string; type: AssetType; currentPrice: number; cnpj: string | null }) {
    return prisma.asset.upsert({
      where: { ticker: data.ticker },
      create: { ...data, priceUpdatedAt: new Date() },
      update: {},
      include: { indicator: true },
    });
  },

  /**
   * Grava a cotação recém-buscada. updateMany, e não update, pelo mesmo motivo de
   * quotesRepository.updatePrice: a linha é disputada por requisições concorrentes e o
   * update lançaria P2025 se ela sumisse, derrubando uma leitura por causa de uma escrita
   * oportunista.
   */
  updatePrice(ticker: string, price: number, at: Date) {
    return prisma.asset.updateMany({ where: { ticker }, data: { currentPrice: price, priceUpdatedAt: at } });
  },

  findSnapshot(assetId: string, type: SnapshotType) {
    return prisma.assetSnapshot.findUnique({ where: { assetId_type: { assetId, type } } });
  },

  findSnapshotsByType(assetIds: string[], type: SnapshotType) {
    return prisma.assetSnapshot.findMany({ where: { assetId: { in: assetIds }, type } });
  },

  saveSnapshot(assetId: string, type: SnapshotType, data: Prisma.InputJsonValue, updatedAt: Date) {
    return prisma.assetSnapshot.upsert({
      where: { assetId_type: { assetId, type } },
      create: { assetId, type, data, updatedAt },
      update: { data, updatedAt },
    });
  },
};
