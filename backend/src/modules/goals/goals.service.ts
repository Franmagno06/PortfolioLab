import { AppError } from "../../shared/errors/AppError.js";
import { assetsRepository } from "../assets/assets.repository.js";
import { quotesService } from "../quotes/quotes.service.js";
import type { BatchGoalsInput, UpsertGoalInput } from "./goals.schemas.js";
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
    // Mesma porta de entrada das transações: o ativo é cadastrado a partir da
    // cotação real se ainda não existir. Sem isto, uma conta nova não conseguia
    // definir a meta do ativo que ainda não comprou — justamente o de maior
    // déficit, e o caso que dá sentido ao rebalanceamento por aporte.
    const asset = await quotesService.buscarOuCadastrar(input.ticker);
    if (!asset) {
      throw new AppError(
        `Ativo ${input.ticker} não encontrado na B3. Confira o ticker (ex: PETR4, MXRF11).`,
        404,
      );
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

  async batchUpsert(userId: string, input: BatchGoalsInput) {
    const somaTotal = input.metas.reduce((soma, m) => soma + m.targetWeight, 0);
    if (somaTotal > 100) {
      throw new AppError(
        `A soma das metas passaria de 100% (ficaria em ${somaTotal.toFixed(2)}%)`,
        400,
      );
    }

    // Resolve todos os tickers ANTES da transação: buscarOuCadastrar pode
    // bater na B3, e isso não deve acontecer com uma transação de banco aberta.
    const resolvidas = await Promise.all(
      input.metas.map(async (meta) => {
        const asset = await quotesService.buscarOuCadastrar(meta.ticker);
        if (!asset) {
          throw new AppError(
            `Ativo ${meta.ticker} não encontrado na B3. Confira o ticker (ex: PETR4, MXRF11).`,
            404,
          );
        }
        return { assetId: asset.id, targetWeight: meta.targetWeight };
      }),
    );

    await goalsRepository.replaceAll(userId, resolvidas);
    return this.list(userId);
  },

  async remove(userId: string, ticker: string) {
    // Aqui continua sendo consulta pura: apagar meta não pode cadastrar ativo
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
