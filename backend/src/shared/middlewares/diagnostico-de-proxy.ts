import type { NextFunction, Request, Response } from "express";

/**
 * Quantos endereços chegam no X-Forwarded-For, para conferir o TRUST_PROXY em produção (ver
 * .env.example). Registra só a contagem, nunca os IPs, e uma vez por contagem diferente: pela Vercel
 * devem ser 3; chamando o *.onrender.com direto, 2.
 */
const MAX_FORMATOS = 6;

export function criarDiagnosticoDeProxy(trustProxy: number, registrar: (linha: string) => void = console.log) {
  const vistas = new Set<number>();
  return function diagnosticoDeProxy(req: Request, _res: Response, next: NextFunction): void {
    if (vistas.size < MAX_FORMATOS) {
      const cabecalho = req.headers["x-forwarded-for"];
      const texto = Array.isArray(cabecalho) ? cabecalho.join(",") : (cabecalho ?? "");
      const quantos = texto.split(",").filter((parte) => parte.trim()).length;
      if (!vistas.has(quantos)) {
        vistas.add(quantos);
        registrar(`[proxy] X-Forwarded-For com ${quantos} endereço(s); TRUST_PROXY=${trustProxy}`);
      }
    }
    next();
  };
}
