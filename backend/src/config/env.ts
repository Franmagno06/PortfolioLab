import "dotenv/config";
import { z } from "zod";

// Valida as variáveis de ambiente na inicialização:
// se algo obrigatório faltar, a aplicação nem sobe (fail fast)
const JWT_SECRET_PADRAO = "dev-secret";
const JWT_SECRET_MIN_PRODUCAO = 32;

// Um deploy real raramente digita "dev-secret": ele copia o .env.example e
// esquece de trocar a linha. Um placeholder longo o bastante passaria pela
// regra de tamanho, então os conhecidos são recusados pelo nome.
const JWT_SECRETS_PROIBIDOS = new Set([
  JWT_SECRET_PADRAO,
  "troque-este-segredo-antes-do-sprint-2",
  "change-me",
  "changeme",
  "secret",
]);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
    PORT: z.coerce.number().default(3333),
    JWT_SECRET: z.string().min(1).default(JWT_SECRET_PADRAO),
    // Módulo IA (Sprint 8) — opcional: sem a chave, as rotas /reports retornam 503
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
  })
  // Achado 6: o .default() acima evita atrito no desenvolvimento, mas em produção
  // um segredo fraco assina os tokens de todo mundo. Aqui a promessa de fail fast
  // do topo do arquivo passa a valer de verdade.
  .superRefine((valores, ctx) => {
    if (valores.NODE_ENV !== "production") return;

    const fraco =
      JWT_SECRETS_PROIBIDOS.has(valores.JWT_SECRET.trim().toLowerCase()) ||
      valores.JWT_SECRET.length < JWT_SECRET_MIN_PRODUCAO;

    if (fraco) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message:
          `JWT_SECRET precisa ter ao menos ${JWT_SECRET_MIN_PRODUCAO} caracteres em produção ` +
          `e não pode ser o padrão de desenvolvimento. Gere um com: openssl rand -base64 32`,
      });
    }
  });

export const env = envSchema.parse(process.env);
