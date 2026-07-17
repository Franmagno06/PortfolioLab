import { z } from "zod";

// DTOs de entrada — validados na borda (controller).
// Dado inválido nunca chega ao service.

export const registerSchema = z.object({
  name: z.string().min(2, "Nome precisa de pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha precisa de pelo menos 6 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
