import { z } from "zod";

export const createDividendSchema = z.object({
  ticker: z
    .string()
    .min(1, "Ticker é obrigatório")
    .transform((s) => s.trim().toUpperCase()),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  paidAt: z.coerce.date(),
});

export type CreateDividendInput = z.infer<typeof createDividendSchema>;
