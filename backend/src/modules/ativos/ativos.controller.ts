import type { Request, Response } from "express";
import { tickerDaRotaSchema } from "./ativos.schemas.js";
import { ativosService } from "./ativos.service.js";

// Dado público, que muda devagar: o navegador e o Next podem guardar por um minuto.
function publico(res: Response) {
  res.set("Cache-Control", "public, max-age=60");
}

// Fronteira HTTP ↔ domínio: valida o formato do ticker e formata a resposta. Ticker válido que não é do
// catálogo é 404, decidido pelo service antes de qualquer chamada a fonte externa.
export const ativosController = {
  async listarAcoes(_req: Request, res: Response) {
    const acoes = await ativosService.listarAcoes();
    publico(res);
    res.json(acoes);
  },

  async listarFiis(_req: Request, res: Response) {
    const fiis = await ativosService.listarFiis();
    publico(res);
    res.json(fiis);
  },

  async listarEtfs(_req: Request, res: Response) {
    const etfs = await ativosService.listarEtfs();
    publico(res);
    res.json(etfs);
  },

  async fichaDoEtf(req: Request, res: Response) {
    const { ticker } = tickerDaRotaSchema.parse(req.params);
    const ficha = await ativosService.fichaDoEtf(ticker);
    publico(res);
    res.json(ficha);
  },

  async fichaDaAcao(req: Request, res: Response) {
    const { ticker } = tickerDaRotaSchema.parse(req.params);
    const ficha = await ativosService.fichaDaAcao(ticker);
    publico(res);
    res.json(ficha);
  },

  async fichaDoFii(req: Request, res: Response) {
    const { ticker } = tickerDaRotaSchema.parse(req.params);
    const ficha = await ativosService.fichaDoFii(ticker);
    publico(res);
    res.json(ficha);
  },
};
