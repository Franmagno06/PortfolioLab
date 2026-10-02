import { Router } from "express";
import { rebalanceController } from "./rebalance.controller.js";

export const rebalanceRoutes = Router();

rebalanceRoutes.post("/simulate", rebalanceController.simulate);

// Pública: a página inicial usa sem login. Montada no app.ts ANTES do
// authGuard de /rebalance, com limitador próprio.
export const rebalanceExemploRoutes = Router();

rebalanceExemploRoutes.post("/", rebalanceController.exemplo);
