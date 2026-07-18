import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { askSchema } from "./reports.schemas.js";
import { reportsService } from "./reports.service.js";

export const reportsController = {
  async create(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError("Envie o PDF no campo 'file' (multipart/form-data)", 400);
    }
    const resultado = await reportsService.analisar(req.userId as string, req.file);
    res.status(201).json(resultado);
  },

  async list(req: Request, res: Response) {
    res.json(await reportsService.list(req.userId as string));
  },

  async ask(req: Request, res: Response) {
    const input = askSchema.parse(req.body);
    const resultado = await reportsService.ask(
      req.userId as string,
      req.params["id"] as string,
      input,
    );
    res.json(resultado);
  },

  async remove(req: Request, res: Response) {
    await reportsService.remove(req.userId as string, req.params["id"] as string);
    res.status(204).send();
  },
};
