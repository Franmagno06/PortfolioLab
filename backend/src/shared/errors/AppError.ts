// Erro de domínio: representa falhas ESPERADAS da regra de negócio
// (e-mail duplicado, ativo não encontrado, saldo insuficiente...).
// Carrega o status HTTP que o errorHandler deve devolver.
// Qualquer erro que NÃO seja AppError é tratado como 500 (bug inesperado).
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}
