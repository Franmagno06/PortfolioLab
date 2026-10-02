import { z } from "zod";

export const simulateSchema = z.object({
  amount: z.coerce.number().positive("O valor do aporte deve ser maior que zero"),
});

export type SimulateInput = z.infer<typeof simulateSchema>;

// Carteira de exemplo da página inicial: rota pública, sem banco. Quem chama
// manda a carteira inteira, então os tetos aqui são a única defesa contra uma
// requisição que peça uma conta gigante.
export const exemploSchema = z
  .object({
    amount: z.coerce
      .number()
      .positive("O valor do aporte deve ser maior que zero")
      .max(1_000_000, "Valor alto demais para o exemplo"),
    ativos: z
      .array(
        z.object({
          ticker: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,7}$/, "Ticker inválido"),
          nome: z.string().trim().min(1).max(80),
          // Centavos, no máximo: com 3 casas, quantidade × preço passaria do
          // centavo e o em2Casas arredondaria no meio da conta.
          preco: z.coerce.number().positive().max(100_000).multipleOf(0.01, "Preço com no máximo 2 casas"),
          quantidade: z.coerce.number().int().min(0).max(1_000_000),
          meta: z.coerce.number().min(0).max(100),
        }),
      )
      .min(1)
      .max(12, "O exemplo aceita no máximo 12 ativos"),
  })
  .refine((v) => v.ativos.reduce((soma, a) => soma + a.meta, 0) <= 100, {
    message: "As metas somam mais de 100%",
    path: ["ativos"],
  });

export type ExemploInput = z.infer<typeof exemploSchema>;
