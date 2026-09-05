import { Prisma } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import { calcularPosicao, type TransacaoParaCalculo } from "../portfolio/portfolio.service.js";
import { quotesService } from "../quotes/quotes.service.js";
import { buscarProventos, type ProventoDoProvedor } from "../quotes/quotes.provider.js";
import type { CreateDividendInput } from "./dividends.schemas.js";
import { dividendsRepository } from "./dividends.repository.js";
import { montarPagina, type PaginacaoInput } from "../../shared/paginacao.js";

export type ProventoRecebido = {
  dataEx: Date;
  valorPorCota: Prisma.Decimal;
  /** Quantidade que o usuário tinha na véspera da data-ex. */
  quantidade: Prisma.Decimal;
  total: Prisma.Decimal;
};

/**
 * Cruza os proventos anunciados de um ativo com o histórico de transações do
 * usuário naquele ativo.
 *
 * A regra da B3 é de posse, não de saldo atual: recebe quem tinha a posição no
 * fechamento do pregão ANTERIOR à data-ex. Então cada provento é calculado
 * sobre a quantidade que existia naquela data, não sobre a de hoje — quem
 * comprou depois não recebe, e quem já vendeu recebeu na época.
 *
 * A quantidade sai de calcularPosicao, a mesma função que a carteira e a
 * exclusão de transação usam: uma definição só de "quanto o usuário tinha".
 *
 * Função pura (sem banco, sem HTTP) — fácil de testar unitariamente.
 */
export function calcularProventosRecebidos(
  transacoes: TransacaoParaCalculo[],
  proventos: ProventoDoProvedor[],
): ProventoRecebido[] {
  return proventos
    .slice()
    .sort((a, b) => a.dataEx.getTime() - b.dataEx.getTime())
    .flatMap((p) => {
      // "<" e não "<=": comprar NA data-ex é comprar o ativo já sem o provento
      const ate = transacoes.filter((t) => t.executedAt.getTime() < p.dataEx.getTime());
      const { quantidade } = calcularPosicao(ate);

      if (quantidade.lessThanOrEqualTo(0)) return [];

      const valorPorCota = new Prisma.Decimal(p.valorPorCota);
      return [
        {
          dataEx: p.dataEx,
          valorPorCota,
          quantidade,
          total: quantidade.times(valorPorCota),
        },
      ];
    });
}

export const dividendsService = {
  async create(userId: string, input: CreateDividendInput) {
    // mesma regra de goals e transactions: o ticker é resolvido na B3
    const asset = await quotesService.buscarOuCadastrar(input.ticker);
    if (!asset) {
      throw new AppError(
        `Ativo ${input.ticker} não encontrado na B3. Confira o ticker (ex: PETR4, MXRF11).`,
        404,
      );
    }

    return dividendsRepository.create({
      userId,
      assetId: asset.id,
      amount: input.amount,
      paidAt: input.paidAt,
    });
  },

  /**
   * Importa os proventos anunciados dos ativos que o usuário já negociou e
   * calcula quanto ele recebeu de cada um.
   *
   * É POST, e não um efeito colateral do GET, de propósito: escrever no meio
   * de uma leitura foi o defeito que os achados 1 e 12 corrigiram. Quem quiser
   * proventos atualizados pede explicitamente.
   *
   * Um ativo cuja consulta falha é pulado, não derruba a sincronização inteira
   * — buscarProventos já devolve lista vazia em vez de lançar.
   */
  async sincronizar(userId: string) {
    const transacoes = await dividendsRepository.findTransacoesDoUsuario(userId);

    // agrupa por ativo: cada ticker é uma consulta ao provedor
    const porAtivo = new Map<string, { ticker: string; transacoes: typeof transacoes }>();
    for (const t of transacoes) {
      const atual = porAtivo.get(t.assetId);
      if (atual) {
        atual.transacoes.push(t);
      } else {
        porAtivo.set(t.assetId, { ticker: t.asset.ticker, transacoes: [t] });
      }
    }

    let gravados = 0;

    for (const [assetId, { ticker, transacoes: doAtivo }] of porAtivo) {
      // nada anterior à primeira operação pode ter sido recebido
      const primeira = doAtivo[0]?.executedAt;
      if (!primeira) continue;

      const anunciados = await buscarProventos(ticker, primeira);
      const recebidos = calcularProventosRecebidos(doAtivo, anunciados);

      for (const r of recebidos) {
        await dividendsRepository.upsertDoProvedor({
          userId,
          assetId,
          paidAt: r.dataEx,
          amount: r.total.toDecimalPlaces(2),
          unitAmount: r.valorPorCota,
        });
        gravados += 1;
      }
    }

    return { ativosConsultados: porAtivo.size, proventos: gravados };
  },

  async list(userId: string, { limite, cursor }: PaginacaoInput) {
    const linhas = await dividendsRepository.findManyByUser(userId, {
      take: limite + 1,
      ...(cursor ? { cursor } : {}),
    });
    return montarPagina(linhas, limite);
  },

  async remove(userId: string, id: string) {
    const provento = await dividendsRepository.findByIdAndUser(id, userId);
    if (!provento) {
      throw new AppError("Provento não encontrado", 404);
    }
    await dividendsRepository.delete(id);
  },
};
