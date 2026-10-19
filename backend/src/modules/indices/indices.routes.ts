import { Router } from "express";
import { limitadorAtivos } from "../../shared/middlewares/rate-limit.js";
import { indicesController } from "./indices.controller.js";

export const indicesRoutes = Router();

// Pública, sem authGuard. Usa o limitador das páginas abertas, não o global.
indicesRoutes.use(limitadorAtivos);

indicesRoutes.get("/dados", indicesController.dados);
