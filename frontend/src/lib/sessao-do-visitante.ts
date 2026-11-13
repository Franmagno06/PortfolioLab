// Quem está vendo o site público: visitante sem sessão, a conta de demonstração ou uma conta de
// verdade. Serve ao botão "Ver a demonstração", que não pode trocar a sessão de quem já entrou na
// própria carteira (o login da demo sobrescreveria o cookie dela).
//
// A consulta é o GET /auth/sessao por `apiPublica`, e não por `api()`. A rota é pública e responde
// 200 também para visitante ({ sessao: "visitante" }): o cabeçalho pergunta em toda página do site, e
// um 401 por visita seria um erro no console de todo visitante. Só falha de rede ou 5xx é "desconhecida".

import { ApiError, apiPublica } from "./api";

export type Sessao = "visitante" | "demo" | "conta";

/** "desconhecida": a consulta falhou (rede, 5xx). Não se sabe se há sessão, então nada de login por cima. */
export type ResultadoDaConsulta = Sessao | "desconhecida";

// Última resposta conhecida nesta aba. Sobrevive à navegação do cliente (voltar da carteira para a
// página inicial pelo menu), e assim o botão já nasce com o rótulo certo, sem piscar. Num
// carregamento completo começa vazia, igual ao HTML do servidor, que não sabe da sessão.
let ultima: Sessao | null = null;
let emVoo: Promise<ResultadoDaConsulta> | null = null;

// Quem mostra a sessão na tela (o cabeçalho do site) fica sabendo quando ela muda: um login pela
// demo ou o "Sair" trocam o que o cabeçalho, já montado, precisa mostrar.
const ouvintes = new Set<() => void>();

function mudar(sessao: Sessao | null): void {
  if (ultima === sessao) return;
  ultima = sessao;
  ouvintes.forEach((avisar) => avisar());
}

const SESSOES: readonly unknown[] = ["visitante", "demo", "conta"] satisfies Sessao[];
const ehSessao = (valor: unknown): valor is Sessao => SESSOES.includes(valor);

export function ultimaSessaoConhecida(): Sessao | null {
  return ultima;
}

/** Para `useSyncExternalStore`: devolve a função que para de observar. */
export function observarSessao(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

/**
 * Depois de um login ou do logout: guarda o que se sabe (ou null, e a próxima consulta decide) e
 * descarta a consulta em voo, que perguntou antes da troca de sessão.
 */
export function lembrarSessao(sessao: Sessao | null): void {
  emVoo = null;
  mudar(sessao);
}

/** Uma consulta por vez: os botões da página (são três na inicial) dividem a mesma. */
export function consultarSessao(): Promise<ResultadoDaConsulta> {
  if (emVoo) return emVoo;
  const consulta: Promise<ResultadoDaConsulta> = apiPublica<{ sessao?: unknown }>("/auth/sessao", { cache: "no-store" })
    .then((r): ResultadoDaConsulta => (ehSessao(r?.sessao) ? r.sessao : "desconhecida"))
    // 401 não vem desta rota; se vier (um proxy no meio, uma API antiga), é visitante, nunca login
    .catch((erro: unknown): ResultadoDaConsulta => (erro instanceof ApiError && erro.status === 401 ? "visitante" : "desconhecida"))
    .then((resultado) => {
      // descartada por lembrarSessao no meio do caminho: a resposta é de antes da troca de sessão
      if (emVoo === consulta) {
        emVoo = null;
        if (resultado !== "desconhecida") mudar(resultado);
      }
      return resultado;
    });
  emVoo = consulta;
  return consulta;
}
