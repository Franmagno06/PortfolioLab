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
  },
});
