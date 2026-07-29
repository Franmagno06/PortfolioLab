import type { Request, Response } from "express";
import { newsService } from "./news.service.js";

export const newsController = {
  async list(req: Request, res: Response) {
    res.json(await newsService.listar(req.userId as string));
  },
};
