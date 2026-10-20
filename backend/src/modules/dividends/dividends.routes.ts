import { Router } from "express";
import { limitadorSyncDeProventos } from "../../shared/middlewares/rate-limit.js";
import { dividendsController } from "./dividends.controller.js";

export const dividendsRoutes = Router();

dividendsRoutes.post("/", dividendsController.create);
dividendsRoutes.get("/", dividendsController.list);
dividendsRoutes.post("/sync", limitadorSyncDeProventos, dividendsController.sync);
dividendsRoutes.delete("/:id", dividendsController.remove);
