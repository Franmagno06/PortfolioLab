import { Router } from "express";
import { authGuard } from "../../shared/middlewares/auth-guard.js";
import {
  limitadorAuth,
  limitadorCadastrosDoSite,
  limitadorFalhasPorConta,
  limitadorFalhasPorContaEIp,
  limitadorLoginDaDemo,
  limitadorLoginsDoSite,
} from "../../shared/middlewares/rate-limit.js";
import { authController } from "./auth.controller.js";

export const authRoutes = Router();

// Achado 8: só as duas rotas que aceitam credenciais levam o limite rígido.
// /logout e /me não são alvo de força bruta e ficam com o teto global.
authRoutes.post("/register", limitadorAuth, limitadorCadastrosDoSite, authController.register);
// O login: por IP (menos a demo), o da demo à parte, as falhas por conta e IP e só por conta, e o teto do
// site inteiro (ver rate-limit.ts).
authRoutes.post(
  "/login",
  limitadorAuth,
  limitadorLoginDaDemo,
  limitadorFalhasPorContaEIp,
  limitadorFalhasPorConta,
  limitadorLoginsDoSite,
  authController.login,
);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", authGuard, authController.me);
