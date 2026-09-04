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
      env: { DATABASE_URL: DATABASE_URL_LOCAL, NODE_ENV: "development" },
      reuseExistingServer: !process.env.CI,
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
