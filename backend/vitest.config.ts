import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// O .env.test aponta para o Postgres do docker-compose. Carregado aqui, e não em
// setupFiles, porque o Vitest precisa das variáveis antes de os módulos de teste
// (e o dotenv/config de config/env.ts) carregarem.
const { parsed } = config({ path: ".env.test" });

export default defineConfig({
  test: {
    globalSetup: ["./vitest.globalSetup.ts"],
    env: parsed ?? {},
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
