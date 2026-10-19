// Gera e2e/ativos/indices-dados.json, a resposta de GET /indices/dados que a API de mentira do E2E
// devolve, a partir de DADOS_DE_EXEMPLO (src/lib/indices-exemplo.ts). Rode depois de mudar o exemplo:
//   cd frontend && npx tsx scripts/gerar-fixture-indices.ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DADOS_DE_EXEMPLO } from "../src/lib/indices-exemplo";

const destino = fileURLToPath(new URL("../e2e/ativos/indices-dados.json", import.meta.url));
writeFileSync(destino, `${JSON.stringify(DADOS_DE_EXEMPLO)}\n`);
console.log(`Fixture gravada em ${destino}`);
