import { z } from "zod";

export const upsertGoalSchema = z.object({
  ticker: z
    .string()
    .min(1, "Ticker é obrigatório")
    .transform((s) => s.trim().toUpperCase()),
  targetWeight: z.coerce
    .number()
    .positive("Meta deve ser maior que zero")
    .max(100, "Meta não pode passar de 100%"),
});

export type UpsertGoalInput = z.infer<typeof upsertGoalSchema>;

export const batchGoalsSchema = z.object({
  metas: z
    .array(
      z.object({
        ticker: z
          .string()
          .min(1, "Ticker é obrigatório")
          .transform((s) => s.trim().toUpperCase()),
        targetWeight: z.coerce
          .number()
          .positive("Meta deve ser maior que zero")
          .max(100, "Meta não pode passar de 100%"),
      }),
    )
    .min(1, "Informe ao menos uma meta")
    .refine((metas) => new Set(metas.map((m) => m.ticker)).size === metas.length, {
      message: "Cada ticker só pode aparecer uma vez no lote",
    }),
});

export type BatchGoalsInput = z.infer<typeof batchGoalsSchema>;
