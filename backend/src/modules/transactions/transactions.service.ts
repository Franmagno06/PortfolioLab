import { AppError } from "../../shared/errors/AppError.js";
import { quotesService } from "../quotes/quotes.service.js";
import type { CreateTransactionInput } from "./transactions.schemas.js";
import { transactionsRepository } from "./transactions.repository.js";

export const transactionsService = {
  async create(userId: string, input: CreateTransactionInput) {
    // Cadastra o ativo automaticamente se ainda não existir: assim o usuário
    // registra qualquer ação ou FII da B3, sem depender de lista pré-carregada
    const asset = await quotesService.buscarOuCadastrar(input.ticker);
    if (!asset) {
      throw new AppError(
        `Ativo ${input.ticker.toUpperCase()} não encontrado na B3. Confira o ticker (ex: PETR4, MXRF11).`,
        404,
      );
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
