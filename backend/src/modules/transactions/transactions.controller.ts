import type { Request, Response } from "express";
import { createTransactionSchema } from "./transactions.schemas.js";
import { transactionsService } from "./transactions.service.js";

export const transactionsController = {
  async create(req: Request, res: Response) {
    const input = createTransactionSchema.parse(req.body);
    const transacao = await transactionsService.create(req.userId as string, input);
    res.status(201).json(transacao);
  },

  async list(req: Request, res: Response) {
    const transacoes = await transactionsService.list(req.userId as string);
    res.json(transacoes);
  },

  async remove(req: Request, res: Response) {
    await transactionsService.remove(req.userId as string, req.params["id"] as string);
    res.status(204).send();
  },
};
