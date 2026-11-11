import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // e2e/ é do Playwright — o glob padrão do Vitest casaria *.spec.ts e
    // tentaria rodar o percurso ponta a ponta como teste unitário.
    exclude: [...configDefaults.exclude, "e2e/**"],
    // O padrão de 5 s estoura no primeiro teste de vários arquivos quando a máquina está carregada
    // (51 arquivos subindo jsdom em paralelo): os mesmos testes passam sozinhos. 20 s tira o falso
    // vermelho sem esconder teste travado de verdade.
    testTimeout: 20_000,
  },
});
