import { AppError } from "../../shared/errors/AppError.js";
import { assetsRepository } from "../assets/assets.repository.js";
import type { UpsertGoalInput } from "./goals.schemas.js";
import { goalsRepository } from "./goals.repository.js";

export const goalsService = {
  async list(userId: string) {
    const metas = await goalsRepository.findManyByUser(userId);
    const somaTotal = metas.reduce((soma, m) => soma + m.targetWeight.toNumber(), 0);

    return {
      metas: metas.map((m) => ({
        ticker: m.asset.ticker,
        name: m.asset.name,
        type: m.asset.type,
        targetWeight: m.targetWeight.toNumber(),
      })),
      somaTotal: Number(somaTotal.toFixed(2)),
    };
  },

  async upsert(userId: string, input: UpsertGoalInput) {
    const asset = await assetsRepository.findByTicker(input.ticker);
    if (!asset) {
      throw new AppError(`Ativo ${input.ticker} não encontrado`, 404);
    }

    // Regra de negócio: a soma de TODAS as metas não pode passar de 100%
    const metas = await goalsRepository.findManyByUser(userId);
    const somaOutras = metas
      .filter((m) => m.assetId !== asset.id)
      .reduce((soma, m) => soma + m.targetWeight.toNumber(), 0);

    const novaSoma = somaOutras + input.targetWeight;
    if (novaSoma > 100) {
      throw new AppError(
        `A soma das metas passaria de 100% (ficaria em ${novaSoma.toFixed(2)}%)`,
        400,
      );
    }

    await goalsRepository.upsert(userId, asset.id, input.targetWeight);
    return this.list(userId);
  },

  async remove(userId: string, ticker: string) {
    const asset = await assetsRepository.findByTicker(ticker.toUpperCase());
    if (!asset) {
      throw new AppError(`Ativo ${ticker.toUpperCase()} não encontrado`, 404);
    }

    const resultado = await goalsRepository.deleteByUserAndAsset(userId, asset.id);
    if (resultado.count === 0) {
      throw new AppError("Meta não encontrada", 404);
    }
  },
};
