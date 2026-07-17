import { AppError } from "../../shared/errors/AppError.js";
import { assetsRepository } from "../assets/assets.repository.js";
import type { CreateDividendInput } from "./dividends.schemas.js";
import { dividendsRepository } from "./dividends.repository.js";

export const dividendsService = {
  async create(userId: string, input: CreateDividendInput) {
    const asset = await assetsRepository.findByTicker(input.ticker);
    if (!asset) {
      throw new AppError(`Ativo ${input.ticker} não encontrado`, 404);
    }

    return dividendsRepository.create({
      userId,
      assetId: asset.id,
      amount: input.amount,
      paidAt: input.paidAt,
    });
  },

  list(userId: string) {
    return dividendsRepository.findManyByUser(userId);
  },

  async remove(userId: string, id: string) {
    const provento = await dividendsRepository.findByIdAndUser(id, userId);
    if (!provento) {
      throw new AppError("Provento não encontrado", 404);
    }
    await dividendsRepository.delete(id);
  },
};
