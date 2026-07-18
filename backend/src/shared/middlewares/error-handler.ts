import type { NextFunction, Request, Response } from "express";
import multer from "multer";
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

  // Erros de upload (multer) — ex: arquivo maior que o limite
  if (err instanceof multer.MulterError) {
    const mensagem =
      err.code === "LIMIT_FILE_SIZE" ? "O arquivo excede o limite de 10 MB" : err.message;
    res.status(400).json({ error: mensagem });
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
