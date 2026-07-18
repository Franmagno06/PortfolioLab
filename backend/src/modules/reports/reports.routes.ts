import { Router } from "express";
import multer from "multer";
import { AppError } from "../../shared/errors/AppError.js";
import { reportsController } from "./reports.controller.js";

// Upload em memória: o PDF só existe durante a requisição
// (extraímos o texto e guardamos apenas ele no banco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new AppError("Apenas arquivos PDF são aceitos", 400));
    }
  },
});

export const reportsRoutes = Router();

reportsRoutes.post("/", upload.single("file"), reportsController.create);
reportsRoutes.get("/", reportsController.list);
reportsRoutes.post("/:id/ask", reportsController.ask);
reportsRoutes.delete("/:id", reportsController.remove);
