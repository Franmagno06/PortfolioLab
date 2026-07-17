import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";

// Middleware central de erros — registrado por ÚLTIMO no app.ts.
// No Express 5, erros lançados em rotas async chegam aqui automaticamente,
// então os controllers não precisam de try/catch.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Falha esperada de regra de negócio → status vindo do próprio erro
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Dados de entrada inválidos (validação Zod)
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Dados inválidos",
      issues: err.flatten().fieldErrors,
    });
    return;
  }

  // Qualquer outra coisa é bug: loga o detalhe, responde genérico
  // (nunca vazar stack trace para o cliente)
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
}
