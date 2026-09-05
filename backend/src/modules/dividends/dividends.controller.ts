import type { Request, Response } from "express";
import { createDividendSchema } from "./dividends.schemas.js";
import { dividendsService } from "./dividends.service.js";
import { paginacaoSchema } from "../../shared/paginacao.js";

export const dividendsController = {
  async create(req: Request, res: Response) {
    const input = createDividendSchema.parse(req.body);
    const provento = await dividendsService.create(req.userId as string, input);
    res.status(201).json(provento);
  },

  async sync(req: Request, res: Response) {
    res.json(await dividendsService.sincronizar(req.userId as string));
  },

  async list(req: Request, res: Response) {
    const pagina = paginacaoSchema.parse(req.query);
    res.json(await dividendsService.list(req.userId as string, pagina));
  },

  async remove(req: Request, res: Response) {
    await dividendsService.remove(req.userId as string, req.params["id"] as string);
    res.status(204).send();
  },
};
