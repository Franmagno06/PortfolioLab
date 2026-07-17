// Teste rápido de conexão com o banco: node scripts/test-connection.mjs
// (rodar de dentro da pasta backend/, onde está o .env)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const ativos = await prisma.asset.count();
  const demo = await prisma.user.findFirst({ select: { email: true } });
  const carteira = await prisma.asset.findMany({
    select: { ticker: true, currentPrice: true },
    orderBy: { ticker: "asc" },
  });

  console.log("✅ CONEXÃO OK!");
  console.log(`Ativos no banco: ${ativos}`);
  console.log(`Usuário demo: ${demo?.email}`);
  console.log(carteira.map((a) => `${a.ticker} (R$ ${a.currentPrice})`).join(", "));
} catch (err) {
  console.error("❌ Falha na conexão:");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
