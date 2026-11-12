// Quem está vendo o site público: visitante sem sessão, a conta de demonstração ou uma conta de
// verdade. Serve ao botão "Ver a demonstração", que não pode trocar a sessão de quem já entrou na
// própria carteira (o login da demo sobrescreveria o cookie dela).
//
// A consulta é o GET /auth/me por `apiPublica`, e não por `api()`: um 401 aqui é a resposta normal
// de quem não entrou, e `api()` o trataria como sessão morta, mandando o visitante para o login.

import { ApiError, apiPublica } from "./api";

export type Sessao = "visitante" | "demo" | "conta";

/** "desconhecida": a consulta falhou (rede, 5xx). Não se sabe se há sessão, então nada de login por cima. */
export type ResultadoDaConsulta = Sessao | "desconhecida";

// Última resposta conhecida nesta aba. Sobrevive à navegação do cliente (voltar da carteira para a
// página inicial pelo menu), e assim o botão já nasce com o rótulo certo, sem piscar. Num
// carregamento completo começa vazia, igual ao HTML do servidor, que não sabe da sessão.
let ultima: Sessao | null = null;
let emVoo: Promise<ResultadoDaConsulta> | null = null;

export function ultimaSessaoConhecida(): Sessao | null {
  return ultima;
}

/**
 * Depois de um login ou do logout: guarda o que se sabe (ou null, e a próxima consulta decide) e
 * descarta a consulta em voo, que perguntou antes da troca de sessão.
 */
export function lembrarSessao(sessao: Sessao | null): void {
  ultima = sessao;
  emVoo = null;
}

/** Uma consulta por vez: os botões da página (são três na inicial) dividem a mesma. */
export function consultarSessao(): Promise<ResultadoDaConsulta> {
  if (emVoo) return emVoo;
  const consulta: Promise<ResultadoDaConsulta> = apiPublica<{ demo?: boolean }>("/auth/me", { cache: "no-store" })
    .then((eu): Sessao => (eu?.demo === true ? "demo" : "conta"))
    .catch((erro: unknown): ResultadoDaConsulta => (erro instanceof ApiError && erro.status === 401 ? "visitante" : "desconhecida"))
    .then((resultado) => {
      // descartada por lembrarSessao no meio do caminho: a resposta é de antes da troca de sessão
      if (emVoo === consulta) {
        emVoo = null;
        if (resultado !== "desconhecida") ultima = resultado;
      }
      return resultado;
    });
  emVoo = consulta;
  return consulta;
}
