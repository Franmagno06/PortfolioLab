import { z } from "zod";

/** Consulta das demonstrações de um ativo na CVM. Sem `periodo`, vale o mais recente publicado. */
export const consultaCvmSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,7}$/, "Ticker inválido"),
  // campo vazio conta como ausente; o formato é conferido no service, que sabe o tipo do ativo
  periodo: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(10, "Período inválido").optional(),
  ),
});

export type ConsultaCvmInput = z.infer<typeof consultaCvmSchema>;
