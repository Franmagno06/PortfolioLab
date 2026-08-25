import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { assetsRepository } from "./assets.repository.js";

// Módulo só de leitura: sem regra de negócio, o controller
// fala direto com o repository (não criamos um service vazio)
export const assetsController = {
  async list(req: Request, res: Response) {
    const ativos = await assetsRepository.findAllByUser(req.userId as string);
    res.json(ativos);
  },

  async getByTicker(req: Request, res: Response) {
    const ticker = (req.params["ticker"] as string).toUpperCase();
    const ativo = await assetsRepository.findByTicker(ticker);
    if (!ativo) {
      throw new AppError(`Ativo ${ticker} não encontrado`, 404);
    }
    res.json(ativo);
  },
};
