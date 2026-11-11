import type { Request, Response } from "express";
import { consultaCvmSchema } from "./reports.schemas.js";
import { reportsService } from "./reports.service.js";
import { paginacaoSchema } from "../../shared/paginacao.js";

export const reportsController = {
  /** 201 quando o relatório foi guardado agora; 200 quando a conta já o tinha. */
  async consultar(req: Request, res: Response) {
    const input = consultaCvmSchema.parse(req.body ?? {});
    const { relatorio, novo } = await reportsService.consultar(req.userId as string, input);
    res.status(novo ? 201 : 200).json(relatorio);
  },

  async list(req: Request, res: Response) {
    const pagina = paginacaoSchema.parse(req.query);
    res.json(await reportsService.list(req.userId as string, pagina));
  },

  async remove(req: Request, res: Response) {
    await reportsService.remove(req.userId as string, req.params["id"] as string);
    res.status(204).send();
  },
};
