import { Router } from "express";
import { authGuard } from "../../shared/middlewares/auth-guard.js";
import { limitadorAuth } from "../../shared/middlewares/rate-limit.js";
import { authController } from "./auth.controller.js";

export const authRoutes = Router();

// Achado 8: só as duas rotas que aceitam credenciais levam o limite rígido.
// /logout e /me não são alvo de força bruta e ficam com o teto global.
authRoutes.post("/register", limitadorAuth, authController.register);
authRoutes.post("/login", limitadorAuth, authController.login);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", authGuard, authController.me);
