import { PrismaClient } from "@prisma/client";

// Instância única (singleton) compartilhada por toda a aplicação —
// criar um PrismaClient por request esgotaria o pool de conexões
export const prisma = new PrismaClient();

// Achado 24: um SELECT 1 é a consulta mais barata que prova que a conexão está
// viva. O /health usa isto para detectar o Supabase hibernado antes do usuário.
export async function verificarConexao(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

// Fecha o pool no desligamento. Sem isto, o Render mata o processo com conexões
// abertas e o Postgres só as recolhe quando o timeout dele estoura.
export async function desconectarBanco(): Promise<void> {
  await prisma.$disconnect();
}
