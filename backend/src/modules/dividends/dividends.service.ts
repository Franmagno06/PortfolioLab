import { Prisma } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import { diaEmSaoPaulo } from "../indices/indices.calculos.js";
import { calcularPosicao, type TransacaoParaCalculo } from "../portfolio/portfolio.service.js";
import { quotesService } from "../quotes/quotes.service.js";
import { buscarProventosOuNulo, type ProventoDoProvedor } from "../quotes/quotes.provider.js";
import type { CreateDividendInput } from "./dividends.schemas.js";
import { dividendsRepository } from "./dividends.repository.js";
import { montarPagina, type PaginacaoInput } from "../../shared/paginacao.js";

export type ProventoRecebido = {
  /**
   * Data-ex, no instante exato que a fonte devolveu (é o que vai para `paidAt`
   * no banco, onde faz parte da chave única). Se a fonte mudar o instante de
   * uma data-ex, a sincronização apaga a linha antiga e grava a nova. Para
   * comparar, use diaCivil().
   */
  dataEx: Date;
  valorPorCota: Prisma.Decimal;
  /** Quantidade que o usuário tinha no fim do dia anterior à data-ex. */
  quantidade: Prisma.Decimal;
  /** Valor BRUTO: quantidade × valor por cota informado pela fonte, antes de qualquer imposto. */
  total: Prisma.Decimal;
};

/**
 * O dia de calendário ("AAAA-MM-DD") de uma data de transação ou de uma data-ex.
 *
 * Os dois lados chegam com hora, e a hora não significa nada: o que conta é o dia.
 * - Transação: o campo de data da tela manda "AAAA-MM-DD", que vira meia-noite UTC
 *   daquele dia (mesma leitura de transactions.service ao montar a mensagem de venda
 *   descoberta).
 * - Data-ex do Yahoo (`events=div` da API de gráfico): o instante é a ABERTURA do pregão
 *   do dia da data-ex, em São Paulo. Em 12/11/2026 todos os eventos lidos (PETR4, ITUB4,
 *   BBAS3, MXRF11, HGLG11, 2025-2026) vinham às 13:00 UTC (10h de Brasília) e, na Quarta de
 *   Cinzas (05/03/2025, pregão a partir das 13h), às 16:00 UTC. PETR4 17/04/2025 13:00 UTC
 *   bate com o "ex-direitos a partir de 17/04/2025" do comunicado da Petrobras.
 *
 * Por isso o dia é lido em UTC nos dois lados. Entre 03:00 e 20:59 UTC o dia UTC e o de
 * Brasília coincidem, o que cobre tudo o que foi observado; ler em UTC também acerta se a
 * fonte um dia mandar meia-noite UTC (onde o dia de São Paulo daria a véspera) ou
 * meia-noite de São Paulo (03:00 UTC). Só erraria com um instante entre 21h e meia-noite
 * de Brasília, que não é horário de pregão.
 *
 * Comparar `getTime()` direto era o defeito: meia-noite UTC da compra feita NA data-ex
 * fica antes das 13:00 UTC do mesmo dia, e quem comprou na data-ex recebia o provento.
 */
export function diaCivil(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

/**
 * Cruza os proventos anunciados de um ativo com o histórico de transações do
 * usuário naquele ativo.
 *
 * A regra da B3 é de posse, não de saldo atual: tem direito quem tem o ativo no
 * fim do pregão ANTERIOR à data-ex (a "data-com"); a partir da data-ex o ativo
 * é negociado sem o direito. Logo, por dia de calendário:
 * - compra no dia anterior à data-ex (ou antes): recebe;
 * - compra NA data-ex (ou depois): não recebe — comprou o ativo já "ex";
 * - venda no dia anterior à data-ex (ou antes): não recebe — não tinha mais no fim do dia;
 * - venda NA data-ex (ou depois): recebe — ainda era dono no fim do dia anterior.
 * Tudo isso é "transação com dia < dia da data-ex entra na posição". (A liquidação D+2
 * não muda a conta: o direito segue a data do negócio, que é a data que a pessoa digita.)
 *
 * Provento com data-ex depois de `hoje` (dia de São Paulo) é descartado: ainda não
 * aconteceu, e somá-lo como "recebido" seria contar dinheiro que pode não vir. Os de
 * data-ex já passada entram mesmo que o PAGAMENTO ainda não tenha caído: o Yahoo não
 * informa a data de pagamento (ver buscarProventosOuNulo).
 *
 * A quantidade sai de calcularPosicao, a mesma função que a carteira e a
 * exclusão de transação usam: uma definição só de "quanto o usuário tinha".
 *
 * Função pura (sem banco, sem HTTP) — fácil de testar unitariamente.
 */
export function calcularProventosRecebidos(
  transacoes: TransacaoParaCalculo[],
  proventos: ProventoDoProvedor[],
  hoje: Date = new Date(),
): ProventoRecebido[] {
  const diaDeHoje = diaEmSaoPaulo(hoje);
  return proventos
    .slice()
    .sort((a, b) => a.dataEx.getTime() - b.dataEx.getTime())
    .flatMap((p) => {
      const diaDaDataEx = diaCivil(p.dataEx);
      if (diaDaDataEx > diaDeHoje) return []; // data-ex futura: ainda não houve direito

      // "<" e não "<=", por DIA: comprar NA data-ex é comprar o ativo já sem o provento
      const ate = transacoes.filter((t) => diaCivil(t.executedAt) < diaDaDataEx);
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
   * — buscarProventosOuNulo devolve null em vez de lançar, e aí nada daquele
   * ativo é gravado NEM apagado.
   *
   * Quando a consulta dá certo, as linhas do PROVEDOR daquele ativo que não estão
   * mais entre as devidas são apagadas. É o que corrige o que a regra antiga gravou
   * (compra feita na própria data-ex contava como posse) e o que deixa de ser devido
   * quando a pessoa corrige uma transação. Lançamentos MANUAIS nunca são tocados.
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

      const anunciados = await buscarProventosOuNulo(ticker, primeira);
      if (anunciados === null) continue; // fonte fora: não grava nem apaga nada deste ativo
      // Lista vazia não é prova de que o ativo "não pagou nada": a mesma lista sai de uma resposta
      // degradada (ticker renomeado ou incorporado, evento sem valor descartado). As linhas do
      // PROVEDOR só existem porque a fonte já listou algum evento, então apagar tudo por causa de
      // uma lista vazia perderia dado válido. Não há nada a reconciliar: o ativo é pulado.
      if (anunciados.length === 0) continue;
      const recebidos = calcularProventosRecebidos(doAtivo, anunciados);

      await dividendsRepository.removerDoProvedorForaDe(
        userId,
        assetId,
        recebidos.map((r) => r.dataEx),
      );

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

    // Ativo que ficou sem NENHUMA transação (a pessoa apagou o lançamento errado) não entra no laço
    // acima, e os proventos que a sincronização gravou para ele deixaram de ser devidos: sem esta
    // limpeza ficariam para sempre no total e no gráfico. Só origem PROVEDOR; manuais ficam.
    await dividendsRepository.removerDoProvedorDeAtivosForaDe(userId, [...porAtivo.keys()]);

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
