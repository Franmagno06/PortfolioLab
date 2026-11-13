import { z } from "zod";
import { tickerSchema } from "../../shared/ticker.js";

// Tetos das colunas (quantity Decimal(18,8), unit_price Decimal(12,2), fee
// Decimal(8,2)). Acima deles o Postgres recusa a gravação, e o erro virava 500.
const QUANTIDADE_MAXIMA = 9_999_999_999;
const PRECO_MAXIMO = 9_999_999_999.99;
const TAXA_MAXIMA = 999_999.99;

export const createTransactionSchema = z.object({
  // aceita ticker (mais amigável que id): o service resolve o ativo
  ticker: tickerSchema,
  kind: z.enum(["COMPRA", "VENDA"]),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero")
    .max(QUANTIDADE_MAXIMA, "Quantidade acima do máximo aceito"),
  unitPrice: z.coerce.number().positive("Preço unitário deve ser maior que zero")
    .max(PRECO_MAXIMO, "Preço unitário acima do máximo aceito"),
  fee: z.coerce.number().min(0, "Taxa não pode ser negativa")
    .max(TAXA_MAXIMA, "Taxa acima do máximo aceito")
    .default(0),
  executedAt: z.coerce.date(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
