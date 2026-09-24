import { z } from "zod";

export const askSchema = z.object({
  question: z.string().min(3, "Pergunta muito curta").max(2000, "Pergunta muito longa"),
  // histórico do chat mantido pelo cliente (a API do Gemini é stateless)
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

// Campos de texto do multipart que acompanham o PDF. O ticker é opcional:
// sem ele o relatório vai direto para a leitura do PDF inteiro. Campo vazio
// (o <select> "não informar") conta como ausente.
export const uploadSchema = z.object({
  ticker: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4,7}$/, "Ticker inválido")
      .optional(),
  ),
});

export type UploadInput = z.infer<typeof uploadSchema>;
