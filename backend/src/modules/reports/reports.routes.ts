import { Router } from "express";
import { limitadorRelatorios } from "../../shared/middlewares/rate-limit.js";
import { reportsController } from "./reports.controller.js";

export const reportsRoutes = Router();

// A consulta baixa e interpreta arquivos grandes da CVM: tem limite por usuário (limitadorRelatorios).
// POST / e POST /cvm são a mesma rota; /cvm é o caminho antigo, do tempo em que POST / recebia PDF.
reportsRoutes.post("/", limitadorRelatorios, reportsController.consultar);
reportsRoutes.post("/cvm", limitadorRelatorios, reportsController.consultar);
reportsRoutes.get("/", reportsController.list);
reportsRoutes.delete("/:id", reportsController.remove);
