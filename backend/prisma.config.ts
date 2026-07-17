import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuração do Prisma CLI (substitui a chave "prisma" do package.json,
// que está deprecada e será removida no Prisma 7)
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
