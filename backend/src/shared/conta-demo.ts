// A conta de demonstração é compartilhada: o botão "Ver a demonstração" da
// página inicial loga QUALQUER visitante nela. Por isso ela é somente leitura
// (ver shared/middlewares/somente-leitura-na-demo.ts). O seed-demo.ts importa o
// e-mail daqui, para os dois nunca divergirem.
export const EMAIL_DA_DEMO = "carteira@portfoliolab.dev";

export const MENSAGEM_DA_DEMO =
  "A conta de demonstração é só para olhar. Crie uma conta grátis para registrar as suas operações.";

/**
 * Compara sem caixa e sem espaços nas pontas. O Postgres guarda o e-mail como
 * foi digitado e a unicidade dele diferencia maiúsculas, então "Carteira@..."
 * seria outra conta; o cadastro recusa essas variações (auth.service.ts) e,
 * se alguma já existisse, ela também seria tratada como a demo.
 */
export function ehEmailDaDemo(email: string): boolean {
  return email.trim().toLowerCase() === EMAIL_DA_DEMO;
}
