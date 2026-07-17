import { z } from "zod";

export const simulateSchema = z.object({
  amount: z.coerce.number().positive("O valor do aporte deve ser maior que zero"),
});

export type SimulateInput = z.infer<typeof simulateSchema>;
