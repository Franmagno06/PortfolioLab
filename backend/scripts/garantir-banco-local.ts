import "dotenv/config";
import { assertDatabaseUrlIsLocal, descreverBanco } from "../src/config/dbGuard.js";

// Primeiro passo do `npm run db:local`. Sem ele, um .env ainda apontando para o
// Supabase faria o `prisma migrate deploy` seguinte rodar em produção.
try {
  assertDatabaseUrlIsLocal(process.env.DATABASE_URL);
} catch (erro) {
  console.error(`\n✋ ${(erro as Error).message}\n`);
  console.error(
    "O backend/.env é o banco do dia a dia e deve apontar para o Docker. A URL do " +
      "Supabase mora em backend/.env.supabase (veja o README, seção \"Dois bancos\").\n",
  );
  process.exit(1);
}

console.log(`Banco de destino: ${descreverBanco(process.env.DATABASE_URL)}`);
