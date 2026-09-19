import type { Request, Response } from "express";
import { indicatorsService } from "./indicators.service.js";

export const indicatorsController = {
  async list(req: Request, res: Response) {
    const indicadores = await indicatorsService.getIndicadoresDaCarteira(req.userId as string);
    res.json(indicadores);
  },
};
