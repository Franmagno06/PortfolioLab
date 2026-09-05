import { Router } from "express";
import { dividendsController } from "./dividends.controller.js";

export const dividendsRoutes = Router();

dividendsRoutes.post("/", dividendsController.create);
dividendsRoutes.get("/", dividendsController.list);
dividendsRoutes.post("/sync", dividendsController.sync);
dividendsRoutes.delete("/:id", dividendsController.remove);
