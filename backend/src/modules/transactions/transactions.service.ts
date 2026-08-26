import { Prisma } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import { calcularPosicao } from "../portfolio/portfolio.service.js";
import { quotesService } from "../quotes/quotes.service.js";
import type { CreateTransactionInput } from "./transactions.schemas.js";
import { transactionsRepository } from "./transactions.repository.js";

// Maior valor de um BIGINT no Postgres: nenhuma linha gravada pode ter seq
// maior que este, então a transação ainda-não-persistida ordena por último.
const SEQ_MAXIMO = 9223372036854775807n;

export const transactionsService = {
  async create(userId: string, input: CreateTransactionInput) {
    // Cadastra o ativo automaticamente se ainda não existir: assim o usuário
    // registra qualquer ação ou FII da B3, sem depender de lista pré-carregada
    const asset = await quotesService.buscarOuCadastrar(input.ticker);
    if (!asset) {
      throw new AppError(
        `Ativo ${input.ticker.toUpperCase()} não encontrado na B3. Confira o ticker (ex: PETR4, MXRF11).`,
        404,
      );
    }

    // Regra de negócio: não se pode vender mais do que se possui.
    // A quantidade sai de calcularPosicao, a mesma função que a carteira e o
    // remove() usam — uma definição só de "quanto o usuário tem deste ativo".
    if (input.kind === "VENDA") {
      const doAtivo = await transactionsRepository.findManyByUserAndAsset(userId, asset.id);
      const { quantidade } = calcularPosicao(doAtivo);
      if (quantidade.lessThan(input.quantity)) {
        throw new AppError(
          `Quantidade insuficiente para venda: você possui ${quantidade.toNumber()} de ${asset.ticker}`,
          400,
        );
      }

      // A posição de hoje pode bastar e a venda ainda assim ficar descoberta:
      // basta datá-la antes da compra que a cobre. Conferir só o total ignora a
      // ordem cronológica que o preço médio respeita — e o histórico entraria
      // negativo no meio da sequência, empurrando o PM para cima.
      const { quantidadeMinima } = calcularPosicao([
        ...doAtivo,
        {
          // Ainda não existe no banco, logo ainda não tem seq. Ela vai receber
          // o próximo autoincrement, que é maior que o de qualquer linha já
          // gravada — então validar com o máximo do BIGINT reproduz exatamente
          // a posição que ela terá depois de persistida. É por isso que o que a
          // API aprova aqui é o que calcularPosicao lê depois.
          seq: SEQ_MAXIMO,
          kind: input.kind,
          quantity: new Prisma.Decimal(input.quantity),
          unitPrice: new Prisma.Decimal(input.unitPrice),
          fee: new Prisma.Decimal(input.fee),
          executedAt: input.executedAt,
        },
      ]);

      if (quantidadeMinima.lessThan(0)) {
        const data = input.executedAt.toISOString().slice(0, 10);
        throw new AppError(
          `Em ${data} você ainda não possuía ${input.quantity} de ${asset.ticker}: a venda ficaria ` +
            "descoberta até a compra seguinte. Confira a data da operação.",
          400,
        );
      }
    }

    return transactionsRepository.create({
      userId,
      assetId: asset.id,
      kind: input.kind,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      fee: input.fee,
      executedAt: input.executedAt,
    });
  },

  list(userId: string) {
    return transactionsRepository.findManyByUser(userId);
  },

  async remove(userId: string, id: string) {
    // busca sempre filtrando por userId: um usuário nunca
    // enxerga (nem apaga) transação de outro
    const transacao = await transactionsRepository.findByIdAndUser(id, userId);
    if (!transacao) {
      throw new AppError("Transação não encontrada", 404);
    }

    // A regra "não se vende o que não se tem" era aplicada só na criação da
    // venda. Apagar a compra que a cobria deixava a posição negativa e
    // invisível: a carteira esconde quantidade <= 0, mas toda venda futura
    // daquele ativo passava a ser recusada. Por isso o histórico inteiro do
    // ativo é reavaliado antes de remover.
    const doAtivo = await transactionsRepository.findManyByUserAndAsset(
      userId,
      transacao.assetId,
    );
    const { quantidadeMinima } = calcularPosicao(doAtivo.filter((t) => t.id !== id));

    if (quantidadeMinima.lessThan(0)) {
      throw new AppError(
        `Não é possível apagar: a posição de ${transacao.asset.ticker} ficaria em ` +
          `${quantidadeMinima.toNumber()} porque existe venda posterior que depende ` +
          "desta transação. Apague a venda primeiro.",
        409,
      );
    }

    await transactionsRepository.delete(id);
  },
};
