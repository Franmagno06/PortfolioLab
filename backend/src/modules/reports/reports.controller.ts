import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { askSchema, consultaCvmSchema, uploadSchema } from "./reports.schemas.js";
import { reportsService } from "./reports.service.js";
import { paginacaoSchema } from "../../shared/paginacao.js";

export const reportsController = {
  async create(req: Request, res: Response) {
    if (!req.file) {
      if (req.body && req.body.ticker) {
        const input = consultaCvmSchema.parse(req.body);
        const resultado = await reportsService.analisarDiretoCvm(req.userId as string, input);
        return res.status(201).json(resultado);
      }
      throw new AppError("Envie o PDF no campo 'file' (multipart/form-data)", 400);
    }
    const input = uploadSchema.parse(req.body ?? {});
    const resultado = await reportsService.analisar(req.userId as string, req.file, input);
    res.status(201).json(resultado);
  },

  async consultarCvm(req: Request, res: Response) {
    const input = consultaCvmSchema.parse(req.body);
    const resultado = await reportsService.analisarDiretoCvm(req.userId as string, input);
    res.status(201).json(resultado);
  },

  async list(req: Request, res: Response) {
    const pagina = paginacaoSchema.parse(req.query);
    res.json(await reportsService.list(req.userId as string, pagina));
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
