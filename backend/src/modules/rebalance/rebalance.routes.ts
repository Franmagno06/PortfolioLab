import { Router } from "express";
import { rebalanceController } from "./rebalance.controller.js";

export const rebalanceRoutes = Router();

rebalanceRoutes.post("/simulate", rebalanceController.simulate);
