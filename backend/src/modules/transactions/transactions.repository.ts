import type { Prisma, TransactionKind } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { argumentosDeCursor } from "../../shared/paginacao.js";

// Tudo o que a transação expõe pela API. seq não entra: existe só para ordenar
// operações da mesma data dentro de calcularPosicao.
const CAMPOS_PUBLICOS = {
  id: true,
  userId: true,
  assetId: true,
  kind: true,
  quantity: true,
  unitPrice: true,
  fee: true,
  executedAt: true,
} as const;

type Cliente = Prisma.TransactionClient | typeof prisma;

// Leituras e escritas que a validação de saldo usa. Recebem o cliente de fora
// para rodar tanto direto quanto dentro de naTravaDoAtivo, na mesma transação.
function operacoesDoAtivo(db: Cliente) {
  return {
  create(data: {
    userId: string;
    assetId: string;
    kind: TransactionKind;
    quantity: number;
    unitPrice: number;
    fee: number;
    executedAt: Date;
  }) {
    // seq fica de fora do retorno: é ordenação interna, não dado do cliente —
    // e BigInt nem sobrevive ao JSON.stringify do Express.
    return db.transaction.create({ data, select: CAMPOS_PUBLICOS });
  },

  // Todas as transações do usuário em UM ativo, para recalcular a posição
  findManyByUserAndAsset(userId: string, assetId: string) {
    return db.transaction.findMany({
      where: { userId, assetId },
      select: {
        id: true,
        seq: true,
        kind: true,
        quantity: true,
        unitPrice: true,
        fee: true,
        executedAt: true,
      },
      // mesma ordem determinística de portfolio.repository: as duas alimentam
      // calcularPosicao, e ela precisa ver a sequência sempre igual
      orderBy: [{ executedAt: "asc" }, { seq: "asc" }],
    });
  },

  delete(id: string) {
    return db.transaction.delete({ where: { id } });
  },
  };
}

export const transactionsRepository = {
  ...operacoesDoAtivo(prisma),

  /**
   * Roda `fn` numa transação que segura uma trava do par usuário + ativo até o
   * fim. Sem ela, duas vendas simultâneas (duplo clique, duas abas) liam a
   * mesma posição, passavam as duas na validação e deixavam o saldo negativo.
   * pg_advisory_xact_lock solta sozinha no commit ou no rollback.
   */
  naTravaDoAtivo<T>(
    userId: string,
    assetId: string,
    fn: (ops: ReturnType<typeof operacoesDoAtivo>) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${userId}::text), hashtext(${assetId}::text))`;
      return fn(operacoesDoAtivo(tx));
    });
  },

  findManyByUser(userId: string, pagina: { take: number; cursor?: string }) {
    return prisma.transaction.findMany({
      where: { userId },
      select: {
        ...CAMPOS_PUBLICOS,
        asset: { select: { ticker: true, name: true, type: true } },
      },
      // o extrato mostra do mais recente para o mais antigo; dentro do mesmo dia,
      // o inverso exato da ordem em que o preço médio foi calculado
      orderBy: [{ executedAt: "desc" }, { seq: "desc" }],
      take: pagina.take,
      ...argumentosDeCursor(pagina.cursor),
    });
  },

  findByIdAndUser(id: string, userId: string) {
    return prisma.transaction.findFirst({
      where: { id, userId },
      include: { asset: { select: { ticker: true } } },
    });
  },
};
