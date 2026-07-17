import { Router } from "express";
import { portfolioController } from "./portfolio.controller.js";

export const portfolioRoutes = Router();

portfolioRoutes.get("/", portfolioController.carteira);
portfolioRoutes.get("/summary", portfolioController.summary);
