import { Router } from "express";
import { quotesController } from "./quotes.controller.js";

export const quotesRoutes = Router();

quotesRoutes.get("/:ticker", quotesController.lookup);
