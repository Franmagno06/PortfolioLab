import { Router } from "express";
import { indicatorsController } from "./indicators.controller.js";

export const indicatorsRoutes = Router();

indicatorsRoutes.get("/", indicatorsController.list);
