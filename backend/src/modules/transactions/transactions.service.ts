import { AppError } from "../../shared/errors/AppError.js";
import { assetsRepository } from "../assets/assets.repository.js";
import type { CreateTransactionInput } from "./transactions.schemas.js";
import { transactionsRepository } from "./transactions.repository.js";

export const transactionsService = {
  async create(userId: string, input: CreateTransactionInput) {
    const asset = await assetsRepository.findByTicker(input.ticker);
    if (!asset) {
      throw new AppError(`Ativo ${input.ticker} não encontrado`, 404);
    }

    // Regra de negócio: não se pode vender mais do que se possui
    if (input.kind === "VENDA") {
      const posicao = await transactionsRepository.quantidadeAtual(userId, asset.id);
      if (posicao.lessThan(input.quantity)) {
        throw new AppError(
          `Quantidade insuficiente para venda: você possui ${posicao.toNumber()} de ${asset.ticker}`,
          400,
        );
      }
    }

    return transactionsRepository.create({
      userId,
      assetId: asset.id,
      kind: input.kind,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      fee: input.fee,
      executedAt: input.executedAt,
    });
  },

  list(userId: string) {
    return transactionsRepository.findManyByUser(userId);
  },

  async remove(userId: string, id: string) {
    // busca sempre filtrando por userId: um usuário nunca
    // enxerga (nem apaga) transação de outro
    const transacao = await transactionsRepository.findByIdAndUser(id, userId);
    if (!transacao) {
      throw new AppError("Transação não encontrada", 404);
    }
    await transactionsRepository.delete(id);
  },
};
