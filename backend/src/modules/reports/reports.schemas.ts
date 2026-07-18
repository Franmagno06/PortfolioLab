import { z } from "zod";

export const askSchema = z.object({
  question: z.string().min(3, "Pergunta muito curta").max(2000, "Pergunta muito longa"),
  // histórico do chat mantido pelo cliente (a API do Claude é stateless)
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(20, "Histórico muito longo")
    .default([]),
});

export type AskInput = z.infer<typeof askSchema>;
