import { Router } from "express";
import { goalsController } from "./goals.controller.js";

export const goalsRoutes = Router();

goalsRoutes.get("/", goalsController.list);
goalsRoutes.put("/", goalsController.upsert);
goalsRoutes.put("/batch", goalsController.batchUpsert);
goalsRoutes.delete("/:ticker", goalsController.remove);
