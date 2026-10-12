import { Router } from "express";
import { limitadorAtivos } from "../../shared/middlewares/rate-limit.js";
import { ativosController } from "./ativos.controller.js";

export const ativosRoutes = Router();

// Públicas, sem authGuard: são as páginas abertas do site. O limitador é só delas.
ativosRoutes.use(limitadorAtivos);

ativosRoutes.get("/acoes", ativosController.listarAcoes);
ativosRoutes.get("/acoes/:ticker", ativosController.fichaDaAcao);
ativosRoutes.get("/fiis", ativosController.listarFiis);
ativosRoutes.get("/fiis/:ticker", ativosController.fichaDoFii);
ativosRoutes.get("/etfs", ativosController.listarEtfs);
ativosRoutes.get("/etfs/:ticker", ativosController.fichaDoEtf);
