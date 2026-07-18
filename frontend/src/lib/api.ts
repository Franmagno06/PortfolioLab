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

// Upload de arquivos (multipart/form-data): o navegador define o
// Content-Type sozinho — por isso NÃO usamos o header JSON aqui
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (!res.ok) {
    throw new ApiError(body?.error ?? "Erro inesperado, tente novamente", res.status);
  }
  return body as T;
}

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
    throw new ApiError(body?.error ?? "Erro inesperado, tente novamente", res.status);
  }

  return body as T;
}
