import { defineConfig } from "@playwright/test";

// E2E das páginas de ativos e da aba Aprender, isolado do resto: o Next lê uma API de mentira (e2e/ativos/stub-api.mjs),
// então o teste não depende do backend, do Docker, do Yahoo nem da CVM, e os números são sempre os
// mesmos. Tudo em portas próprias (3100 e 3399), para rodar ao lado do `npm run dev` e do backend da
// pessoa, sem tocar neles: o segundo `next dev` usa a pasta .next-e2e e o tsconfig.e2e.json.
//
// O que isto NÃO prova é que o backend de verdade devolve o formato que o stub imita. Isso é coberto
// por src/lib/ativos-tipos.test.ts (nomes dos campos); se mudar um campo lá, atualize o stub.
const PORTA_DO_SITE = 3100;
const PORTA_DA_API = 3399;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/{ativos,aprender}*.spec.ts",
  fullyParallel: false,
  // Um worker só: o stub tem um modo global (POST /__modo) que um teste liga e desliga.
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORTA_DO_SITE}`,
  },
  webServer: [
    {
      command: "node e2e/ativos/stub-api.mjs",
      url: `http://localhost:${PORTA_DA_API}/health`,
      env: { STUB_PORT: String(PORTA_DA_API) },
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: `npx next dev -p ${PORTA_DO_SITE}`,
      url: `http://localhost:${PORTA_DO_SITE}`,
      env: {
        API_URL: `http://localhost:${PORTA_DA_API}`,
        NEXT_DIST_DIR: ".next-e2e",
        ATIVOS_REVALIDAR_S: "0",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
