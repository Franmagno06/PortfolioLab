import cookieParser from "cookie-parser";
import express from "express";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { errorHandler } from "./shared/middlewares/error-handler.js";

// app.ts monta a aplicação; server.ts dá o listen.
// Essa separação permite testar as rotas sem subir um servidor real.
export const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "portfoliolab-api" });
});

// Rotas dos módulos — sempre ANTES do errorHandler
app.use("/auth", authRoutes);

// Registrado por último: captura os erros de todas as rotas acima
app.use(errorHandler);
