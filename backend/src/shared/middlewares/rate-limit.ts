import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";

// Achado 8: teto de requisições em três camadas.
//
// O limitador entrega o 429 pelo mesmo caminho de todo erro esperado do
// projeto — um AppError encaminhado ao errorHandler —, então o corpo sai no
// formato { error } como o resto da API, sem um segundo formato de erro.
//
// Sob NODE_ENV=test o limite é desligado no app compartilhado: a suíte faz 25
// chamadas de auth do mesmo 127.0.0.1, em arquivos paralelos, e um contador
// global tornaria os testes dependentes da ordem de execução. O limitador em si
// é testado isolado em rate-limit.test.ts, num app descartável.
type OpcoesLimitador = {
  janelaMs: number;
  max: number;
  mensagem: string;
  /** Por chave: sem isto o teto seria por IP, e um NAT puniria a rede inteira. */
  porUsuario?: boolean;
  pular?: () => boolean;
};

export function criarLimitador({
  janelaMs,
  max,
  mensagem,
  porUsuario,
  pular,
}: OpcoesLimitador) {
  return rateLimit({
    windowMs: janelaMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(pular ? { skip: pular } : {}),
    // ipKeyGenerator normaliza o IPv6 para o /64 do assinante: sem ele, quem
    // tem um /64 inteiro trocaria de endereço a cada requisição e escaparia do
    // limite. A v8 recusa keyGenerator custom que toque req.ip sem passar por ele.
    ...(porUsuario
      ? {
          keyGenerator: (req: { userId?: string; ip?: string }) =>
            req.userId ?? ipKeyGenerator(req.ip ?? ""),
        }
      : {}),
    handler: (_req, _res, next) => {
      next(new AppError(mensagem, 429));
    },
  });
}

/** Desliga o limitador na suíte — ver comentário no topo. */
const noTeste = () => env.NODE_ENV === "test";

/**
 * Camada 1 — força bruta em credenciais. Rígida e por IP: um punhado de
 * tentativas por janela é mais do que qualquer pessoa legítima precisa.
 */
export const limitadorAuth = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 10,
  mensagem: "Muitas tentativas de autenticação. Tente novamente em alguns minutos.",
  pular: noTeste,
});

/**
 * Camada 2 — as rotas que custam dinheiro real de API (Gemini). Mais apertada
 * que a global e contada por usuário autenticado, não por IP.
 */
export const limitadorRelatorios = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  max: 20,
  mensagem: "Limite de análises por hora atingido. Tente novamente mais tarde.",
  porUsuario: true,
  pular: noTeste,
});

/** Camada 3 — teto global folgado, só para conter abuso grosseiro. */
export const limitadorGlobal = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 500,
  mensagem: "Muitas requisições. Aguarde um momento.",
  pular: noTeste,
});
