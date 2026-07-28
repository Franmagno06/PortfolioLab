// Diagnóstico do login: roda cada etapa isoladamente para achar onde falha.
// Uso: node scripts/debug-login.mjs
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

try {
  console.log("1) Buscando usuário demo...");
  const user = await prisma.user.findUnique({ where: { email: "demo@portfoliolab.dev" } });
  console.log("   encontrado:", !!user, user ? `(${user.name})` : "");

  if (user) {
    console.log("2) Comparando senha com bcrypt...");
    const ok = await bcrypt.compare("123456", user.passwordHash);
    console.log("   senha confere:", ok);

    console.log("3) Assinando JWT...");
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET ?? "dev-secret", {
      expiresIn: "7d",
    });
    console.log("   token gerado, tamanho:", token.length);
  }
  console.log("\nTUDO OK — o problema não está nestas 3 etapas.");
} catch (err) {
  console.error("\n❌ FALHOU AQUI:");
  console.error(err);
} finally {
  await prisma.$disconnect();
}
