import "dotenv/config";
import { z } from "zod";

// Valida as variáveis de ambiente na inicialização:
// se algo obrigatório faltar, a aplicação nem sobe (fail fast)
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string().min(1).default("dev-secret"),
});

export const env = envSchema.parse(process.env);
