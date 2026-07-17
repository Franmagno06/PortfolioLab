import { Router } from "express";
import { transactionsController } from "./transactions.controller.js";

export const transactionsRoutes = Router();

transactionsRoutes.post("/", transactionsController.create);
transactionsRoutes.get("/", transactionsController.list);
transactionsRoutes.delete("/:id", transactionsController.remove);
