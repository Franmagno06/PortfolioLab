const HOSTS_LOCAIS = /^(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)$/;

export function bancoEhLocal(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    return HOSTS_LOCAIS.test(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * Descreve o destino da DATABASE_URL sem a senha, para o log de inicialização
 * e para os scripts dizerem onde vão escrever. Com dois bancos no projeto
 * (Docker e Supabase), saber qual está em uso não pode depender de memória.
 */
export function descreverBanco(databaseUrl: string | undefined): string {
  if (!databaseUrl) return "nenhum (DATABASE_URL vazia)";
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return "URL inválida";
  }
  const endereco = `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  if (bancoEhLocal(databaseUrl)) return `LOCAL (Docker) — ${endereco}`;
  // supabase.com (pooler) e supabase.co (conexão direta)
  if (/\.supabase\.(com|co)$/.test(url.hostname)) return `SUPABASE (produção) — ${endereco}`;
  return `REMOTO — ${endereco}`;
}

export function assertDatabaseUrlIsLocal(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL não definida. Aponte-a para o Postgres local antes de rodar testes ou seed. " +
        "Veja a skill rodar-testes-seguro.",
    );
  }

  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(`DATABASE_URL não é uma URL válida: ${databaseUrl}`);
  }

  if (!HOSTS_LOCAIS.test(host)) {
    throw new Error(
      `Operação abortada: DATABASE_URL aponta para "${host}", que não é um banco local. ` +
        "Isto escreveria no banco de produção. Suba o container com `docker compose up -d` e " +
        "exporte DATABASE_URL=postgresql://portfoliolab:portfoliolab@localhost:5432/portfoliolab. " +
        "Veja a skill rodar-testes-seguro.",
    );
  }
}
