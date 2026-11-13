import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { CODIGO_DE_NEGOCIACAO_B3 } from "../../shared/ticker.js";
import { buscarCotacao } from "./quotes.provider.js";

export const quotesController = {
  /**
   * Consulta um ticker na B3 sem cadastrar nada.
   * O formulário de nova transação usa isto para mostrar nome e preço
   * antes de o usuário confirmar.
   */
  async lookup(req: Request, res: Response) {
    const ticker = String(req.params["ticker"] ?? "").trim().toUpperCase();

    // A antiga, "4 letras e 1 ou 2 números", recusava B3SA3, que tem dígito
    // no radical. Esta aceita, e ainda barra "PETR" antes de chamar o Yahoo.
    if (!CODIGO_DE_NEGOCIACAO_B3.test(ticker)) {
      throw new AppError(
        "Ticker inválido. Use o código de negociação da B3, como PETR4, B3SA3 ou MXRF11.",
        400,
      );
    }

    const cotacao = await buscarCotacao(ticker);
    if (!cotacao) {
      throw new AppError(
        `Ticker ${ticker} não encontrado na B3. Confira a grafia.`,
        404,
      );
    }

    res.json(cotacao);
  },
};
