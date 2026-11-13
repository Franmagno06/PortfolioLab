import type { NextFunction, Request, Response } from "express";
import { CABECALHO_DO_SEGREDO } from "./ip-do-visitante.js";

/**
 * Quantos endereços chegam no X-Forwarded-For, para conferir o TRUST_PROXY em produção (ver
 * .env.example). Registra só a contagem e se o segredo do proxy veio (nunca os IPs nem o segredo), uma
 * vez por formato: pela Vercel devem ser 3, com o segredo; chamando o *.onrender.com direto, 2, sem.
 * Vai antes de `ip-do-visitante.ts`, que apaga o cabeçalho do segredo.
 */
const MAX_FORMATOS = 6;

export function criarDiagnosticoDeProxy(trustProxy: number, registrar: (linha: string) => void = console.log) {
  const vistas = new Set<string>();
  return function diagnosticoDeProxy(req: Request, _res: Response, next: NextFunction): void {
    if (vistas.size < MAX_FORMATOS) {
      const cabecalho = req.headers["x-forwarded-for"];
      const texto = Array.isArray(cabecalho) ? cabecalho.join(",") : (cabecalho ?? "");
      const quantos = texto.split(",").filter((parte) => parte.trim()).length;
      const comSegredo = req.headers[CABECALHO_DO_SEGREDO] !== undefined;
      const formato = `${quantos}:${comSegredo}`;
      if (!vistas.has(formato)) {
        vistas.add(formato);
        registrar(
          `[proxy] X-Forwarded-For com ${quantos} endereço(s), ${comSegredo ? "com" : "sem"} o segredo do proxy; TRUST_PROXY=${trustProxy}`,
        );
      }
    }
    next();
  };
}
