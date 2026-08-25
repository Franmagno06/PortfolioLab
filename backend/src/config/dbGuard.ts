const HOSTS_LOCAIS = /^(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)$/;

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
