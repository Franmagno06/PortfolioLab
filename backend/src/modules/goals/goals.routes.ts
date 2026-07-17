import { Router } from "express";
import { goalsController } from "./goals.controller.js";

export const goalsRoutes = Router();

goalsRoutes.get("/", goalsController.list);
goalsRoutes.put("/", goalsController.upsert);
goalsRoutes.delete("/:ticker", goalsController.remove);
