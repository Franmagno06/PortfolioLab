import { PrismaClient } from "@prisma/client";

// Instância única (singleton) compartilhada por toda a aplicação —
// criar um PrismaClient por request esgotaria o pool de conexões
export const prisma = new PrismaClient();
