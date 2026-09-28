// Cliente HTTP único do frontend: todas as chamadas à API passam por aqui.
// O prefixo /api é reescrito pelo Next para o backend (ver next.config.ts).

type ApiErrorBody = { error?: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Rotas em que um 401 é resposta normal, não sessão morta: errar a senha no
 * login devolve 401 e a mensagem precisa aparecer na tela, não virar
 * redirecionamento.
 */
const SEM_REDIRECIONAR = ["/auth/login", "/auth/register"];

/**
 * Sessão caiu: apaga o cookie e manda para o login.
 *
 * Existe por causa de um travamento real. O proxy do Next só sabe se o cookie
 * `token` EXISTE — validar a assinatura exigiria o segredo do JWT no
 * frontend, que não deve estar lá. Então, com um cookie expirado, o proxy
 * considerava o usuário logado e o mandava para /dashboard; lá toda chamada
 * devolvia 401, e ir para /login era inútil porque o proxy redirecionava de
 * volta. Sem saída, a não ser apagar o cookie na mão no DevTools.
 *
 * O logout do backend é o que de fato remove o cookie: ele é httpOnly, então
 * o JavaScript não o alcança. `replace` e não `push` para o histórico não
 * guardar a página morta, e navegação de página inteira (não o router do
 * Next) para o proxy reavaliar já sem o cookie.
 */
async function encerrarSessao(): Promise<void> {
  if (typeof window === "undefined") return;
  // Best-effort: se o backend estiver fora, o marcador na URL ainda garante
  // que a tela de login é alcançável.
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.replace("/login?expirada=1");
}

// Upload de arquivos (multipart/form-data): o navegador define o
// Content-Type sozinho — por isso NÃO usamos o header JSON aqui
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (!res.ok) {
    if (res.status === 401) await encerrarSessao();
    throw new ApiError(body?.error ?? "Erro inesperado, tente novamente", res.status);
  }
  return body as T;
}

// As listas paginadas do backend (transactions, dividends, reports) devolvem
// este envelope em vez de um array. proximoCursor null significa última página.
export type Pagina<T> = { itens: T[]; proximoCursor: string | null };

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;

  if (!res.ok) {
    if (res.status === 401 && !SEM_REDIRECIONAR.includes(path)) {
      await encerrarSessao();
    }
    throw new ApiError(body?.error ?? "Erro inesperado, tente novamente", res.status);
  }

  return body as T;
}
