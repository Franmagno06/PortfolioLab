import type { Request, Response } from "express";
import { indicesService } from "./indices.service.js";

export const indicesController = {
  async dados(_req: Request, res: Response) {
    const dados = await indicesService.montarDados();
    // Dado público que muda devagar: o navegador e o Next podem guardar por um minuto.
    res.set("Cache-Control", "public, max-age=60");
    res.json(dados);
  },
};
