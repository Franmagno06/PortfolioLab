import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      /**
       * O IP que os limitadores usam. Igual ao `req.ip` do Express quando a requisição prova ter vindo
       * pela Vercel; senão, o último endereço que um proxy do Render escreveu (o cliente não o forja).
       */
      ipDoVisitante?: string;
    }
  }
}

/** O cabeçalho que o proxy.ts do site põe nas chamadas /api/*. Tem de bater com o do frontend. */
export const CABECALHO_DO_SEGREDO = "x-portfoliolab-proxy";

type Opcoes = {
  /** Saltos confiáveis pelo caminho da Vercel (TRUST_PROXY). */
  saltos: number;
  /** SEGREDO_DO_PROXY. Sem ele, todo pedido vale `saltos` (desenvolvimento, ou produção ainda sem o segredo). */
  segredo?: string | undefined;
};

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Acha o IP do visitante contando saltos do X-Forwarded-For de trás para frente, como o "trust proxy"
 * do Express, mas com a contagem decidida por requisição:
 *
 * - com o segredo certo, a requisição veio pela Vercel (visitante → Vercel → Cloudflare → Render), e
 *   a Vercel sobrescreve o X-Forwarded-For com o IP de quem a chamou: `saltos` endereços confiáveis;
 * - sem ele (alguém chamando o *.onrender.com direto, ou a renderização do Next lendo a API no
 *   servidor), falta o salto da Vercel: um a menos. O endereço que sobra foi escrito pela Cloudflare
 *   com o IP de quem se conectou a ela, e os endereços que o cliente pôs antes dele são ignorados.
 *
 * O cabeçalho do segredo é apagado depois de conferido: não segue para log nem para outro código.
 */
export function criarIpDoVisitante({ saltos, segredo }: Opcoes) {
  return function ipDoVisitante(req: Request, _res: Response, next: NextFunction): void {
    const recebido = req.headers[CABECALHO_DO_SEGREDO];
    delete req.headers[CABECALHO_DO_SEGREDO];
    const pelaVercel = segredo === undefined || (typeof recebido === "string" && iguais(recebido, segredo));
    const confiaveis = pelaVercel ? saltos : Math.max(0, saltos - 1);

    const xff = req.headers["x-forwarded-for"];
    const cadeia = (Array.isArray(xff) ? xff.join(",") : (xff ?? ""))
      .split(",")
      .map((parte) => parte.trim())
      .filter(Boolean);
    // [socket, último do X-Forwarded-For, penúltimo, ...]: o índice N é o N-ésimo salto para trás
    const enderecos = [req.socket.remoteAddress ?? "", ...cadeia.reverse()];
    req.ipDoVisitante = enderecos[Math.min(confiaveis, enderecos.length - 1)] ?? "";
    next();
  };
}
