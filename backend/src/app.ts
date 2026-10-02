import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { verificarConexao } from "./database/prisma.js";
import { assetsRoutes } from "./modules/assets/assets.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dividendsRoutes } from "./modules/dividends/dividends.routes.js";
import { goalsRoutes } from "./modules/goals/goals.routes.js";
import { indicatorsRoutes } from "./modules/indicators/indicators.routes.js";
import { newsRoutes } from "./modules/news/news.routes.js";
import { quotesRoutes } from "./modules/quotes/quotes.routes.js";
import { portfolioRoutes } from "./modules/portfolio/portfolio.routes.js";
import { rebalanceRoutes } from "./modules/rebalance/rebalance.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { transactionsRoutes } from "./modules/transactions/transactions.routes.js";
import { authGuard } from "./shared/middlewares/auth-guard.js";
import { errorHandler } from "./shared/middlewares/error-handler.js";
import { limitadorGlobal } from "./shared/middlewares/rate-limit.js";

// app.ts monta a aplicação; server.ts dá o listen.
// Essa separação permite testar as rotas sem subir um servidor real.
export const app = express();

// Achado 8: atrás do Render/Vercel, sem isto todos os IPs viram o do proxy e o
// limite que deveria ser por visitante passa a valer para a aplicação inteira
// de uma vez. O 1 é a quantidade de proxies confiáveis à frente da API.
app.set("trust proxy", 1);

// Cabeçalhos de segurança. Esta API só responde JSON, então o CSP que importa
// é o do Next, que serve o HTML (frontend/src/proxy.ts) — aqui ele é desligado
// para não mandar uma política longa e inútil em cada resposta. O que sobra é o
// que vale para JSON: nosniff, Referrer-Policy, HSTS e a remoção do
// X-Powered-By, que anunciava "Express" para qualquer scanner.
app.use(
  helmet({
    contentSecurityPolicy: false,
    // A API e o frontend são origens diferentes em produção (Render e Vercel);
    // o padrão same-origin faria o navegador recusar as respostas.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Teto global folgado. Antes do express.json() de propósito, pelo mesmo motivo
// que o limitador de /reports vem antes do multer: recusar sem gastar o parse.
app.use(limitadorGlobal);

app.use(express.json());
app.use(cookieParser());

// Achado 24: responder "ok" sem consultar o banco escondia o Supabase
// hibernado — quem descobria era o usuário, no login. Um SELECT 1 custa quase
// nada e transforma a hibernação em 503 no health check, onde ela é visível.
app.get("/health", async (_req, res) => {
  try {
    await verificarConexao();
    res.json({ status: "ok", service: "portfoliolab-api", database: "ok" });
  } catch {
    res
      .status(503)
      .json({ status: "degraded", service: "portfoliolab-api", database: "erro" });
  }
});

// Rotas dos módulos — sempre ANTES do errorHandler
app.use("/auth", authRoutes);

// Rotas protegidas: o authGuard aplicado no mount vale para todas as subrotas
app.use("/assets", authGuard, assetsRoutes);
app.use("/transactions", authGuard, transactionsRoutes);
app.use("/dividends", authGuard, dividendsRoutes);
app.use("/goals", authGuard, goalsRoutes);
app.use("/indicators", authGuard, indicatorsRoutes);
app.use("/news", authGuard, newsRoutes);
app.use("/quotes", authGuard, quotesRoutes);
app.use("/portfolio", authGuard, portfolioRoutes);
app.use("/rebalance", authGuard, rebalanceRoutes);
app.use("/reports", authGuard, reportsRoutes);

// Registrado por último: captura os erros de todas as rotas acima
app.use(errorHandler);
