import { defineConfig } from "@playwright/test";

// Sobe o backend com o banco LOCAL — nunca o de produção, mesmo que
// backend/.env aponte para o Supabase: uma variável já presente em
// process.env vence o dotenv/config de config/env.ts. Mesma defesa do
// backend/.env.test (skill rodar-testes-seguro). Pré-requisito manual:
// `docker compose up -d` em backend/ e o schema já aplicado
// (`npx prisma db push` ou `migrate deploy` contra esse Postgres local).
const DATABASE_URL_LOCAL = "postgresql://portfoliolab:portfoliolab@localhost:5432/portfoliolab";

export default defineConfig({
  testDir: "./e2e",
  // As páginas de ativos e de aprender têm config própria (playwright.ativos.config.ts): leem uma API de mentira,
  // e por isso não dependem do backend, do Docker nem de Yahoo e CVM estarem no ar.
  testIgnore: "**/{ativos,aprender}*.spec.ts",
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "../backend",
      url: "http://localhost:3333/health",
      // NODE_ENV=test, como na suíte do Vitest: desliga o limitador de
      // autenticação (10 tentativas a cada 15 min por IP), que a suíte inteira,
      // entrando do mesmo 127.0.0.1, estourava — o login voltava 429 e os
      // testes da área logada falhavam sem sessão. O limitador tem teste
      // próprio, isolado (rate-limit.test.ts). NODE_ENV só muda isso e, em
      // produção, o cookie seguro e a checagem do JWT_SECRET.
      env: { DATABASE_URL: DATABASE_URL_LOCAL, NODE_ENV: "test" },
      // Nunca reusar: um backend já no ar carregou backend/.env, que aponta
      // para o Supabase de produção — o override de DATABASE_URL acima só
      // vale para um processo que ESTE config sobe.
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
