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
