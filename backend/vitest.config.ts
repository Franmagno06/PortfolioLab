import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Os testes de integração falam com o Supabase (rede) — timeouts folgados
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
