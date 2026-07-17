import { z } from "zod";

export const createTransactionSchema = z.object({
  // aceita ticker (mais amigável que id): o service resolve o ativo
  ticker: z
    .string()
    .min(1, "Ticker é obrigatório")
    .transform((s) => s.trim().toUpperCase()),
  kind: z.enum(["COMPRA", "VENDA"]),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  unitPrice: z.coerce.number().positive("Preço unitário deve ser maior que zero"),
  fee: z.coerce.number().min(0, "Taxa não pode ser negativa").default(0),
  executedAt: z.coerce.date(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
