import { AppError } from "../../shared/errors/AppError.js";
import { calcularPosicao } from "../portfolio/portfolio.service.js";
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

    // Regra de negócio: não se pode vender mais do que se possui.
    // A quantidade sai de calcularPosicao, a mesma função que a carteira e o
    // remove() usam — uma definição só de "quanto o usuário tem deste ativo".
    if (input.kind === "VENDA") {
      const doAtivo = await transactionsRepository.findManyByUserAndAsset(userId, asset.id);
      const { quantidade } = calcularPosicao(doAtivo);
      if (quantidade.lessThan(input.quantity)) {
        throw new AppError(
          `Quantidade insuficiente para venda: você possui ${quantidade.toNumber()} de ${asset.ticker}`,
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

    // A regra "não se vende o que não se tem" era aplicada só na criação da
    // venda. Apagar a compra que a cobria deixava a posição negativa e
    // invisível: a carteira esconde quantidade <= 0, mas toda venda futura
    // daquele ativo passava a ser recusada. Por isso o histórico inteiro do
    // ativo é reavaliado antes de remover.
    const doAtivo = await transactionsRepository.findManyByUserAndAsset(
      userId,
      transacao.assetId,
    );
    const { quantidadeMinima } = calcularPosicao(doAtivo.filter((t) => t.id !== id));

    if (quantidadeMinima.lessThan(0)) {
      throw new AppError(
        `Não é possível apagar: a posição de ${transacao.asset.ticker} ficaria em ` +
          `${quantidadeMinima.toNumber()} porque existe venda posterior que depende ` +
          "desta transação. Apague a venda primeiro.",
        409,
      );
    }

    await transactionsRepository.delete(id);
  },
};
