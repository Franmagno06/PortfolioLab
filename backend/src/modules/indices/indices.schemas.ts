import { z } from "zod";

/** Resposta do SGS: lista de { data: "dd/MM/aaaa", valor: "0.82" }; linha com valor não numérico é descartada. */
export const respostaSgsSchema = z
  .array(z.object({ data: z.string(), valor: z.string() }))
  .transform((linhas) =>
    linhas
      .map((l) => ({ data: l.data, valor: Number(l.valor) }))
      .filter((l) => !Number.isNaN(l.valor)),
  );
