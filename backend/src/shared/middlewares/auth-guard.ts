import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";

// Adiciona o campo userId ao tipo Request do Express (declaration merging)
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Protege rotas: sem cookie com JWT válido, a requisição nem chega ao controller
export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  const token = (req.cookies as Record<string, string> | undefined)?.["token"];
  if (!token) {
    throw new AppError("Não autenticado", 401);
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("payload sem sub");
    }
    userId = payload.sub;
  } catch {
    throw new AppError("Sessão inválida ou expirada", 401);
  }

  req.userId = userId;
  next();
}
