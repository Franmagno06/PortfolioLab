import cookieParser from "cookie-parser";
import express from "express";
import { assetsRoutes } from "./modules/assets/assets.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dividendsRoutes } from "./modules/dividends/dividends.routes.js";
import { goalsRoutes } from "./modules/goals/goals.routes.js";
import { newsRoutes } from "./modules/news/news.routes.js";
import { quotesRoutes } from "./modules/quotes/quotes.routes.js";
import { portfolioRoutes } from "./modules/portfolio/portfolio.routes.js";
import { rebalanceRoutes } from "./modules/rebalance/rebalance.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { transactionsRoutes } from "./modules/transactions/transactions.routes.js";
import { authGuard } from "./shared/middlewares/auth-guard.js";
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

// Rotas protegidas: o authGuard aplicado no mount vale para todas as subrotas
app.use("/assets", authGuard, assetsRoutes);
app.use("/transactions", authGuard, transactionsRoutes);
app.use("/dividends", authGuard, dividendsRoutes);
app.use("/goals", authGuard, goalsRoutes);
app.use("/news", authGuard, newsRoutes);
app.use("/quotes", authGuard, quotesRoutes);
app.use("/portfolio", authGuard, portfolioRoutes);
app.use("/rebalance", authGuard, rebalanceRoutes);
app.use("/reports", authGuard, reportsRoutes);

// Registrado por último: captura os erros de todas as rotas acima
app.use(errorHandler);
