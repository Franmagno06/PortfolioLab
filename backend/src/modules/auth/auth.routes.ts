import { Router } from "express";
import { authGuard } from "../../shared/middlewares/auth-guard.js";
import { authController } from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", authGuard, authController.me);
