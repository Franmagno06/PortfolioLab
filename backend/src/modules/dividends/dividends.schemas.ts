import { z } from "zod";
import { tickerSchema } from "../../shared/ticker.js";

export const createDividendSchema = z.object({
  ticker: tickerSchema,
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  paidAt: z.coerce.date(),
});

export type CreateDividendInput = z.infer<typeof createDividendSchema>;
