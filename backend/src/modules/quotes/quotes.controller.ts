import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { buscarCotacao } from "./quotes.provider.js";

export const quotesController = {
  /**
   * Consulta um ticker na B3 sem cadastrar nada.
   * O formulário de nova transação usa isto para mostrar nome e preço
   * antes de o usuário confirmar.
   */
  async lookup(req: Request, res: Response) {
    const ticker = String(req.params["ticker"] ?? "").trim();

    if (!/^[A-Za-z]{4}\d{1,2}$/.test(ticker)) {
      throw new AppError(
        "Ticker inválido. Use o formato da B3: 4 letras e 1 ou 2 números (ex: PETR4, MXRF11).",
        400,
      );
    }

    const cotacao = await buscarCotacao(ticker);
    if (!cotacao) {
      throw new AppError(
        `Ticker ${ticker.toUpperCase()} não encontrado na B3. Confira a grafia.`,
        404,
      );
    }

    res.json(cotacao);
  },
};
