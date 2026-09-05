import { z } from "zod";

// Achado 23: as listas cresciam sem teto. Uma conta com anos de extrato puxava
// tudo numa resposta só — memória do servidor e tráfego proporcionais ao
// histórico, não à tela.
export const LIMITE_PADRAO = 50;
export const LIMITE_MAXIMO = 100;

export const paginacaoSchema = z.object({
  limite: z.coerce
    .number()
    .int("Limite deve ser inteiro")
    .min(1, "Limite mínimo é 1")
    .max(LIMITE_MAXIMO, `Limite máximo é ${LIMITE_MAXIMO}`)
    .default(LIMITE_PADRAO),
  // O cursor é o id do último item da página anterior. Opaco para o cliente:
  // ele devolve o que recebeu, sem interpretar.
  cursor: z.string().uuid("Cursor inválido").optional(),
});

export type PaginacaoInput = z.infer<typeof paginacaoSchema>;

export type Pagina<T> = { itens: T[]; proximoCursor: string | null };

// O repository busca limite + 1 linhas. A linha extra não vai para o cliente:
// serve só para saber se existe página seguinte, sem um count() a mais.
export function montarPagina<T extends { id: string }>(
  linhas: T[],
  limite: number,
): Pagina<T> {
  const temMais = linhas.length > limite;
  const itens = temMais ? linhas.slice(0, limite) : linhas;
  const ultimo = itens[itens.length - 1];
  return { itens, proximoCursor: temMais && ultimo ? ultimo.id : null };
}

// Traduz o cursor para os argumentos que o Prisma espera. skip: 1 pula o
// próprio item do cursor, que já foi entregue na página anterior.
export function argumentosDeCursor(
  cursor: string | undefined,
): { cursor?: { id: string }; skip?: number } {
  // O tipo de retorno é anotado de propósito. Sem ele o TypeScript infere uma
  // união de dois formatos, e espalhar essa união dentro do argumento do Prisma
  // não compila.
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}
