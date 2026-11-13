import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../../config/env.js";
import { ehEmailDaDemo } from "../conta-demo.js";
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
  /** Chave própria (sem IP), como o e-mail do login. Tem precedência sobre `porUsuario`. */
  chave?: (req: Request) => string;
  /** Só respostas de erro (status >= 400) gastam o teto: login certo não conta. */
  contarSoFalhas?: boolean;
  pular?: (req: Request) => boolean;
};

export function criarLimitador({
  janelaMs,
  max,
  mensagem,
  porUsuario,
  chave,
  contarSoFalhas,
  pular,
}: OpcoesLimitador) {
  return rateLimit({
    windowMs: janelaMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(pular ? { skip: (req: Request) => pular(req) } : {}),
    ...(contarSoFalhas ? { skipSuccessfulRequests: true } : {}),
    // ipKeyGenerator normaliza o IPv6 para o /64 do assinante: sem ele, quem
    // tem um /64 inteiro trocaria de endereço a cada requisição e escaparia do
    // limite. A v8 recusa keyGenerator custom que toque req.ip sem passar por ele.
    keyGenerator: chave
      ? (req: Request) => chave(req)
      : porUsuario
        ? (req: Request) => req.userId ?? ipDe(req)
        : ipDe,
    handler: (_req, _res, next) => {
      next(new AppError(mensagem, 429));
    },
  });
}

/**
 * O IP que conta: o de `ip-do-visitante.ts`, que só confia nos saltos da Vercel quando a requisição
 * traz o segredo dela (sem o middleware, como nos apps descartáveis dos testes, o `req.ip` do Express).
 */
export function ipDe(req: Request): string {
  return ipKeyGenerator(req.ipDoVisitante ?? req.ip ?? "");
}

/** Desliga o limitador na suíte — ver comentário no topo. */
const noTeste = () => env.NODE_ENV === "test";

/**
 * POST /auth/login da conta de demonstração (senha pública, README). Só o login: um cadastro com o
 * e-mail da demo continua no teto rígido.
 */
export function ehLoginDaDemo(req: Request): boolean {
  if (req.method !== "POST" || req.path !== "/login") return false;
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && ehEmailDaDemo(email);
}

/** E-mail do corpo, normalizado: a mesma conta com outra caixa ou espaços cai no mesmo contador. */
export function chaveDaConta(req: Request): string {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? `conta:${email.trim().toLowerCase()}` : "conta:?";
}

/** A conta e o IP de quem tenta: errar a senha de alguém trava só a própria rede, não a dona da conta. */
export function chaveDaContaEIp(req: Request): string {
  return `${chaveDaConta(req)}|${ipDe(req)}`;
}

const MENSAGEM_AUTH = "Muitas tentativas de autenticação. Tente novamente em alguns minutos.";

/**
 * Camada 1 — força bruta em credenciais. Rígida e por IP: um punhado de
 * tentativas por janela é mais do que qualquer pessoa legítima precisa.
 *
 * O login da conta demo fica de fora e tem o teto dele (`limitadorLoginDaDemo`): a senha dela é
 * pública, não há o que adivinhar, e cada clique em "Ver a demonstração" é um login. Contado aqui,
 * dez visitantes atrás do mesmo IP (uma rede de escritório, ou todos, se o IP real não chegar)
 * travariam o login de todo mundo por 15 minutos.
 */
export const limitadorAuth = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 10,
  mensagem: MENSAGEM_AUTH,
  pular: (req) => noTeste() || ehLoginDaDemo(req),
});

/**
 * Camada 1b — o login da demo, à parte e por IP. Folgado (cada visita à demonstração é um login),
 * mas limitado: cada login custa um bcrypt, que no Render gratuito (0,1 CPU) é caro.
 */
export const limitadorLoginDaDemo = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 60,
  mensagem: "Muitas entradas na demonstração a partir da sua rede. Tente de novo em alguns minutos.",
  pular: (req) => noTeste() || !ehLoginDaDemo(req),
});

/**
 * Camada 1c — falhas de login por conta E IP. Errar a senha de uma conta trava aquela conta só para
 * a rede que errou: quem tenta adivinhar a senha da Ana não tranca a Ana do lado de fora. Só falha
 * conta (status >= 400); quem acerta não gasta nada.
 */
export const limitadorFalhasPorContaEIp = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 10,
  mensagem: MENSAGEM_AUTH,
  chave: chaveDaContaEIp,
  contarSoFalhas: true,
  pular: (req) => noTeste() || ehLoginDaDemo(req),
});

/**
 * Camada 1d — falhas de login só por conta, bem mais folgado. Pega a força bruta distribuída (muitos
 * IPs, ou IP forjado por quem chama o Render sem passar pela Vercel) contra uma conta só. Folgado de
 * propósito: travar a dona da conta exige cem senhas erradas em 15 minutos, e não dez.
 */
export const limitadorFalhasPorConta = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 100,
  mensagem: MENSAGEM_AUTH,
  chave: chaveDaConta,
  contarSoFalhas: true,
  pular: (req) => noTeste() || ehLoginDaDemo(req),
});

/**
 * Camada 1e — teto do site inteiro, sem IP, para login e cadastro: cada um custa um bcrypt (custo 12,
 * perto de um segundo de CPU no Render gratuito). Não depende do IP, então nem forjar o IP nem usar
 * mil endereços passa dele. O preço: uma enxurrada de tentativas atrasa o login de todos por alguns
 * minutos, em vez de derrubar a API inteira por CPU.
 */
const TODOS = () => "todos";
export const limitadorLoginsDoSite = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 300,
  mensagem: "Muitas entradas no site agora. Tente de novo em alguns minutos.",
  chave: TODOS,
  pular: noTeste,
});
export const limitadorCadastrosDoSite = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  max: 30,
  mensagem: "Muitos cadastros no site agora. Tente de novo mais tarde.",
  chave: TODOS,
  pular: noTeste,
});

/**
 * Camada 2 — a consulta de relatórios, que baixa e interpreta arquivos grandes da CVM (rede e CPU do
 * servidor). Mais apertada que a global e contada por usuário autenticado, não por IP.
 */
export const limitadorRelatorios = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  max: 20,
  mensagem: "Limite de consultas de relatórios por hora atingido. Tente novamente mais tarde.",
  porUsuario: true,
  pular: noTeste,
});

/**
 * Camada 2b — POST /dividends/sync: cada chamada busca no Yahoo os proventos de todos os ativos da
 * carteira (até alguns segundos por ativo). Por usuário, com folga para quem sincroniza de novo depois
 * de lançar uma compra, mas sem deixar uma conta martelar o Yahoo e fazê-lo bloquear o IP do servidor.
 */
export const limitadorSyncDeProventos = criarLimitador({
  janelaMs: 10 * 60 * 1000,
  max: 3,
  mensagem: "Você já sincronizou os proventos há pouco. Espere alguns minutos e tente de novo.",
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

/**
 * Camada 4 — o desafio do aporte da página inicial. Rota pública: qualquer
 * visitante chama, sem login. Por IP, com folga para quem joga várias rodadas
 * (cada "comparar" é uma chamada), mas sem virar calculadora grátis para robô.
 */
export const limitadorExemplo = criarLimitador({
  janelaMs: 60 * 1000,
  max: 30,
  mensagem: "Muitas simulações seguidas. Aguarde um minuto e tente de novo.",
  pular: noTeste,
});

/**
 * Camada 5 — as páginas públicas de Ativos. Rota aberta, mas só chega a Yahoo, CVM e feeds de
 * notícia com ticker do catálogo, e com cache: este teto contém abuso, não o uso normal.
 * Folgado de propósito: o Next renderiza essas páginas no servidor, então todas as visitas
 * chegam aqui do mesmo IP (o do frontend), e um teto apertado valeria para o site inteiro.
 */
export const limitadorAtivos = criarLimitador({
  janelaMs: 60 * 1000,
  max: 300,
  mensagem: "Muitas consultas aos ativos. Aguarde um minuto e tente de novo.",
  pular: noTeste,
});
