import type { Request, Response } from "express";
import { createDividendSchema } from "./dividends.schemas.js";
import { dividendsService } from "./dividends.service.js";

export const dividendsController = {
  async create(req: Request, res: Response) {
    const input = createDividendSchema.parse(req.body);
    const provento = await dividendsService.create(req.userId as string, input);
    res.status(201).json(provento);
  },

  async list(req: Request, res: Response) {
    const proventos = await dividendsService.list(req.userId as string);
    res.json(proventos);
  },

  async remove(req: Request, res: Response) {
    await dividendsService.remove(req.userId as string, req.params["id"] as string);
    res.status(204).send();
  },
};
