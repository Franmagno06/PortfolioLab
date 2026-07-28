import "dotenv/config";
import { z } from "zod";

// Valida as variáveis de ambiente na inicialização:
// se algo obrigatório faltar, a aplicação nem sobe (fail fast)
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string().min(1).default("dev-secret"),
  // Módulo IA (Sprint 8) — opcional: sem a chave, as rotas /reports retornam 503
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
});

export const env = envSchema.parse(process.env);
