import type { Request, Response } from "express";
import { upsertGoalSchema } from "./goals.schemas.js";
import { goalsService } from "./goals.service.js";

export const goalsController = {
  async list(req: Request, res: Response) {
    res.json(await goalsService.list(req.userId as string));
  },

  async upsert(req: Request, res: Response) {
    const input = upsertGoalSchema.parse(req.body);
    res.json(await goalsService.upsert(req.userId as string, input));
  },

  async remove(req: Request, res: Response) {
    await goalsService.remove(req.userId as string, req.params["ticker"] as string);
    res.status(204).send();
  },
};
