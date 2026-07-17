import { Router } from "express";
import { assetsController } from "./assets.controller.js";

export const assetsRoutes = Router();

assetsRoutes.get("/", assetsController.list);
assetsRoutes.get("/:ticker", assetsController.getByTicker);
