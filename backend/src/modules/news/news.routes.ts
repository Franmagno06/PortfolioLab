import { Router } from "express";
import { newsController } from "./news.controller.js";

export const newsRoutes = Router();

newsRoutes.get("/", newsController.list);
