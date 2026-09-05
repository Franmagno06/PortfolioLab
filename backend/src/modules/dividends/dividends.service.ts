import { AppError } from "../../shared/errors/AppError.js";
import { quotesService } from "../quotes/quotes.service.js";
import type { CreateDividendInput } from "./dividends.schemas.js";
import { dividendsRepository } from "./dividends.repository.js";
import { montarPagina, type PaginacaoInput } from "../../shared/paginacao.js";

export const dividendsService = {
  async create(userId: string, input: CreateDividendInput) {
    // mesma regra de goals e transactions: o ticker é resolvido na B3
    const asset = await quotesService.buscarOuCadastrar(input.ticker);
    if (!asset) {
      throw new AppError(
        `Ativo ${input.ticker} não encontrado na B3. Confira o ticker (ex: PETR4, MXRF11).`,
        404,
      );
    }

    return dividendsRepository.create({
      userId,
      assetId: asset.id,
      amount: input.amount,
      paidAt: input.paidAt,
    });
  },

  async list(userId: string, { limite, cursor }: PaginacaoInput) {
    const linhas = await dividendsRepository.findManyByUser(userId, {
      take: limite + 1,
      ...(cursor ? { cursor } : {}),
    });
    return montarPagina(linhas, limite);
  },

  async remove(userId: string, id: string) {
    const provento = await dividendsRepository.findByIdAndUser(id, userId);
    if (!provento) {
      throw new AppError("Provento não encontrado", 404);
    }
    await dividendsRepository.delete(id);
  },
};
