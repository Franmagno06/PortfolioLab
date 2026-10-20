import type { NextFunction, Request, Response } from "express";
import { authService } from "../../modules/auth/auth.service.js";
import { MENSAGEM_DA_DEMO } from "../conta-demo.js";
import { AppError } from "../errors/AppError.js";

const METODOS_DE_LEITURA = new Set(["GET", "HEAD", "OPTIONS"]);

// Escritas que a demo pode fazer: método + caminho completo (prefixo do mount
// incluído). POST /dividends/sync só copia proventos do Yahoo para a carteira.
const ESCRITAS_LIBERADAS = new Set(["POST /dividends/sync"]);

/**
 * Caminho completo comparável com a lista acima. O middleware é montado no
 * app.ts por prefixo (`app.use("/dividends", ...)`), então o `req.path` é
 * relativo ao mount e o prefixo está em `req.baseUrl`. `req.path` já vem sem
 * query string. Caixa e UMA barra no fim são ignoradas, porque o roteador do
 * Express (case-insensitive, não estrito) também as ignora ao casar /sync.
 * Nada mais é normalizado: "/sync/../x", "/sync//" e "/syncX" não são o
 * caminho liberado e ficam bloqueados — na dúvida, recusa.
 */
function caminhoCompleto(req: Request): string {
  const caminho = `${req.baseUrl}${req.path}`.toLowerCase();
  return caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
}

/**
 * A conta de demonstração é compartilhada (qualquer visitante entra nela pela
 * página inicial), então é somente leitura: pode olhar tudo, mas não cria nem
 * apaga transação, provento manual, meta ou relatório, nem pergunta à IA.
 * Vai depois do authGuard, nos mounts protegidos do app.ts.
 *
 * Quem é a demo: o caminho rápido é a claim `demo: true` do JWT. Mas tokens
 * emitidos antes dela existir valem por até 7 dias e não a têm; por isso, em
 * escrita sem a claim, o e-mail da conta é conferido no banco (uma busca por
 * chave primária, só em escrita — leitura nunca consulta).
 */
export async function somenteLeituraNaDemo(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (METODOS_DE_LEITURA.has(req.method)) {
    next();
    return;
  }
  if (ESCRITAS_LIBERADAS.has(`${req.method} ${caminhoCompleto(req)}`)) {
    next();
    return;
  }

  const ehDemo = req.ehDemo === true || (await authService.ehContaDemo(req.userId as string));
  if (ehDemo) {
    throw new AppError(MENSAGEM_DA_DEMO, 403);
  }
  next();
}
