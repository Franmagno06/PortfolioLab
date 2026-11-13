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
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    // Segredo que o proxy.ts do site (Vercel) põe em toda chamada /api/* antes de reescrever para a
    // API. Prova que a requisição passou pela Vercel, que sobrescreve o X-Forwarded-For: só então os
    // TRUST_PROXY saltos valem. Sem ele, quem chama o Render direto forjaria o IP (ver .env.example).
    // Vazio = desligado (desenvolvimento).
    SEGREDO_DO_PROXY: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().min(32, "SEGREDO_DO_PROXY precisa ter ao menos 32 caracteres").optional(),
    ),
    // Liga o aquecimento do catálogo de Ativos ao subir (só tem efeito em produção). "false" o desliga:
    // no Render gratuito (0,1 CPU, 512 MB) interpretar os zips da CVM dos 30 ativos de uma vez não cabe.
    AQUECER_CATALOGO: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
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
