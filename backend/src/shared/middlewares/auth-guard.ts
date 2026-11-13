import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";

// Adiciona o campo userId ao tipo Request do Express (declaration merging)
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      /** Token com a claim demo: true (conta de demonstração, somente leitura). */
      ehDemo?: boolean;
    }
  }
}

/** O cookie `token` da requisição, se houver. */
export function tokenDaRequisicao(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.["token"];
}

/** Dono e claim demo de um JWT válido (assinatura e validade); null se ausente, inválido ou vencido. */
export function lerToken(token: string | undefined): { userId: string; ehDemo: boolean } | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    return { userId: payload.sub, ehDemo: payload["demo"] === true };
  } catch {
    return null;
  }
}

// Protege rotas: sem cookie com JWT válido, a requisição nem chega ao controller
export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  const token = tokenDaRequisicao(req);
  if (!token) {
    throw new AppError("Não autenticado", 401);
  }

  const lido = lerToken(token);
  if (!lido) {
    throw new AppError("Sessão inválida ou expirada", 401);
  }

  req.userId = lido.userId;
  req.ehDemo = lido.ehDemo;
  next();
}
