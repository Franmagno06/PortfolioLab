import { z } from "zod";

export const askSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(1, "Pergunta muito curta")
      .max(2000, "Pergunta muito longa")
      .optional(),
    termo: z
      .string()
      .trim()
      .min(1, "Termo muito curto")
      .max(2000, "Termo muito longo")
      .optional(),
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
  })
  .refine((data) => Boolean(data.question || data.termo), {
    message: "Informe a pergunta ou o termo de busca",
    path: ["question"],
  })
  .transform((data) => ({
    question: (data.question ?? data.termo) as string,
    termo: (data.termo ?? data.question) as string,
    history: data.history,
  }));

export type AskInput = {
  question?: string;
  termo?: string;
  history?: {
    role: "user" | "assistant";
    content: string;
  }[];
};

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
  periodo: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().optional(),
  ),
});

export type UploadInput = z.infer<typeof uploadSchema>;

// Consulta direta de relatórios CVM sem upload de PDF
export const consultaCvmSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,7}$/, "Ticker inválido"),
  periodo: z
    .string()
    .trim()
    .optional(),
});

export type ConsultaCvmInput = z.infer<typeof consultaCvmSchema>;
