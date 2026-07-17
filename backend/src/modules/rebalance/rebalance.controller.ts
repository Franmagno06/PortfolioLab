import type { Request, Response } from "express";
import { simulateSchema } from "./rebalance.schemas.js";
import { rebalanceService } from "./rebalance.service.js";

export const rebalanceController = {
  async simulate(req: Request, res: Response) {
    const input = simulateSchema.parse(req.body);
    const resultado = await rebalanceService.simulate(req.userId as string, input.amount);
    res.json(resultado);
  },
};
