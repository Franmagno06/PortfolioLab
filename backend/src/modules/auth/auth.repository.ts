import { prisma } from "../../database/prisma.js";

// Única camada que fala com o Prisma — consultas puras, sem regra de negócio
export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: { name: string; email: string; passwordHash: string }) {
    return prisma.user.create({ data });
  },
};
