import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";
import { authService } from "./auth.service.js";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

// As MESMAS opções precisam ser usadas ao gravar e ao apagar o cookie:
// o navegador só remove um cookie quando os atributos batem. Sem isso, o
// logout falharia silenciosamente em produção (onde `secure` é true).
const OPCOES_COOKIE = {
  httpOnly: true, // o JavaScript da página não lê este cookie (defesa contra XSS)
  secure: env.NODE_ENV === "production", // em produção só viaja por HTTPS
  sameSite: "strict",
} as const;

// Fronteira HTTP ↔ domínio: valida entrada, chama o service, formata a resposta.
// Se o schema.parse falhar, o ZodError vai direto para o errorHandler (400).
export const authController = {
  async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);
    res.status(201).json(user);
  },

  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const { token, user } = await authService.login(input);

    res.cookie("token", token, { ...OPCOES_COOKIE, maxAge: SETE_DIAS_MS });
    res.json({ user });
  },

  async logout(_req: Request, res: Response) {
    res.clearCookie("token", OPCOES_COOKIE);
    res.status(204).send();
  },

  // Rota protegida: req.userId foi injetado pelo authGuard
  async me(req: Request, res: Response) {
    const profile = await authService.getProfile(req.userId as string);
    res.json(profile);
  },
};
