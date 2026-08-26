import { Router } from "express";
import multer from "multer";
import { AppError } from "../../shared/errors/AppError.js";
import { limitadorRelatorios } from "../../shared/middlewares/rate-limit.js";
import { reportsController } from "./reports.controller.js";

// Upload em memória: o PDF só existe durante a requisição
// (extraímos o texto e guardamos apenas ele no banco)
const upload = multer({
  storage: multer.memoryStorage(),
  // 25 MB: releases trimestrais de bancos costumam passar de 5 MB
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new AppError("Apenas arquivos PDF são aceitos", 400));
    }
  },
});

export const reportsRoutes = Router();

// Achado 8: as duas rotas que gastam cota paga do Gemini. O limite vem antes
// do multer em POST / — não faz sentido receber 25 MB para depois recusar.
reportsRoutes.post("/", limitadorRelatorios, upload.single("file"), reportsController.create);
reportsRoutes.get("/", reportsController.list);
reportsRoutes.post("/:id/ask", limitadorRelatorios, reportsController.ask);
reportsRoutes.delete("/:id", reportsController.remove);
