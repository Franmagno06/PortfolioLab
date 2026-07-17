import type { Request, Response } from "express";
import { portfolioService } from "./portfolio.service.js";

export const portfolioController = {
  async carteira(req: Request, res: Response) {
    const ativos = await portfolioService.getCarteira(req.userId as string);
    res.json(ativos);
  },

  async summary(req: Request, res: Response) {
    const resumo = await portfolioService.getSummary(req.userId as string);
    res.json(resumo);
  },
};
