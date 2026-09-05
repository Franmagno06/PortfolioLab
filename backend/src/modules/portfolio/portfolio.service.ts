import { Prisma } from "@prisma/client";
import { quotesService } from "../quotes/quotes.service.js";
import { portfolioRepository } from "./portfolio.repository.js";

type TransacaoComAtivo = Awaited<
  ReturnType<typeof portfolioRepository.transacoesComAtivo>
>[number];

type TransacaoParaCalculo = {
  /** Autoincrement do banco: a ordem de cadastro. Desempata a mesma data. */
  seq: bigint;
  kind: "COMPRA" | "VENDA";
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  fee: Prisma.Decimal;
  executedAt: Date;
};

const ZERO = new Prisma.Decimal(0);

// converte Decimal para número com 2 casas — só na hora de responder ao cliente
function em2Casas(d: Prisma.Decimal): number {
  return d.toDecimalPlaces(2).toNumber();
}

/**
 * Calcula quantidade e preço médio de UM ativo pelo método do preço médio
 * ponderado (mesma regra da Receita Federal):
 *
 * - COMPRA: recalcula o PM → (qtd×PM + qtdCompra×preço + taxa) / (qtd + qtdCompra)
 * - VENDA: reduz a quantidade, o PM NÃO muda
 *
 * Devolve também a quantidadeMinima: o menor valor que a quantidade atinge ao
 * longo da sequência. Serve para recusar remoções que invalidem o histórico.
 *
 * A ordem das operações importa, por isso ordenamos por data — e por seq quando
 * a data empata. O desempate não é detalhe: uma data sem hora vira meia-noite
 * (executedAt: z.coerce.date()), então operações do mesmo dia empatam sempre. Sem
 * ele, quem decidia a ordem era a ordem física das linhas do Postgres, e a mesma
 * carteira respondia preços médios diferentes entre duas requisições.
 *
 * seq é o autoincrement da tabela: a ordem em que as operações foram cadastradas.
 * É a única informação cronológica que sobra quando a data não tem hora — e é a
 * mesma ordem que transactionsService.create assume ao validar uma venda nova,
 * de modo que o que a API aprova é o que a leitura calcula.
 *
 * Função pura (sem banco, sem HTTP) — fácil de testar unitariamente.
 */
export function calcularPosicao(transacoes: TransacaoParaCalculo[]) {
  const ordenadas = [...transacoes].sort((a, b) => {
    const porData = a.executedAt.getTime() - b.executedAt.getTime();
    if (porData !== 0) return porData;
    return a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0;
  });

  let quantidade = ZERO;
  let precoMedio = ZERO;
  // menor quantidade que a sequência atinge. Negativa denuncia histórico
  // inválido: uma venda sem compra que a cubra (ver transactionsService.remove)
  let quantidadeMinima = ZERO;

  for (const t of ordenadas) {
    if (t.kind === "COMPRA") {
      const custoAtual = quantidade.times(precoMedio);
      const custoCompra = t.quantity.times(t.unitPrice).plus(t.fee);
      quantidade = quantidade.plus(t.quantity);
      precoMedio = quantidade.isZero()
        ? ZERO
        : custoAtual.plus(custoCompra).div(quantidade);
    } else {
      quantidade = quantidade.minus(t.quantity);
      if (quantidade.isZero()) {
        precoMedio = ZERO;
      }
    }

    if (quantidade.lessThan(quantidadeMinima)) quantidadeMinima = quantidade;
  }

  return { quantidade, precoMedio, quantidadeMinima };
}

/** Posição em um ativo, ainda sem cotação — o preço entra depois. */
export type PosicaoDoAtivo = {
  asset: TransacaoComAtivo["asset"];
  quantidade: Prisma.Decimal;
  precoMedio: Prisma.Decimal;
};

export const portfolioService = {
  /**
   * Posição consolidada por ativo — sempre DERIVADA das transações — SEM tocar
   * em cotação.
   *
   * Separada de getCarteira porque quem já vai resolver os preços (a simulação
   * de aporte) precisa da posição sem disparar uma segunda resolução: era essa
   * segunda passada, concorrente com a leitura das metas, que fazia a mesma
   * resposta carregar dois preços do mesmo ativo.
   */
  async posicoesPorAtivo(userId: string): Promise<PosicaoDoAtivo[]> {
    const transacoes = await portfolioRepository.transacoesComAtivo(userId);

    // agrupa as transações por ativo
    const porAtivo = new Map<
      string,
      { asset: TransacaoComAtivo["asset"]; transacoes: TransacaoParaCalculo[] }
    >();
    for (const t of transacoes) {
      const grupo = porAtivo.get(t.assetId) ?? { asset: t.asset, transacoes: [] };
      grupo.transacoes.push(t);
      porAtivo.set(t.assetId, grupo);
    }

    const posicoes: PosicaoDoAtivo[] = [];
    for (const { asset, transacoes: doAtivo } of porAtivo.values()) {
      const { quantidade, precoMedio } = calcularPosicao(doAtivo);
      if (quantidade.lte(0)) continue; // posição zerada não aparece na carteira
      posicoes.push({ asset, quantidade, precoMedio });
    }

    return posicoes;
  },

  /**
   * Soma de TODAS as taxas pagas pelo usuário — compra e venda, inclusive de
   * ativos já totalmente vendidos (que não aparecem em posicoesPorAtivo,
   * porque a posição zerada some da carteira, mas a taxa foi paga do mesmo
   * jeito). Por isso não usa calcularPosicao nem o agrupamento por ativo: é
   * uma soma plana sobre o histórico inteiro.
   */
  async totalTaxasPagas(userId: string): Promise<Prisma.Decimal> {
    const transacoes = await portfolioRepository.transacoesComAtivo(userId);
    return transacoes.reduce((soma, t) => soma.plus(t.fee), ZERO);
  },

  // Posição consolidada com valores de mercado, para a tela de Carteira
  async getCarteira(userId: string) {
    const posicoes = await this.posicoesPorAtivo(userId);

    // Busca cotações atualizadas antes de calcular. Se a API estiver fora,
    // o mapa devolve o último preço conhecido e a carteira não quebra.
    const precosAtuais = await quotesService.resolverPrecos(posicoes.map((p) => p.asset));

    const ativos = [];
    for (const { asset, quantidade, precoMedio } of posicoes) {
      const precoAtual = precosAtuais.get(asset.ticker) ?? asset.currentPrice;
      const valorAplicado = quantidade.times(precoMedio);
      const valorAtual = quantidade.times(precoAtual);
      const lucro = valorAtual.minus(valorAplicado);
      const lucroPct = valorAplicado.isZero()
        ? ZERO
        : lucro.div(valorAplicado).times(100);

      ativos.push({
        ticker: asset.ticker,
        name: asset.name,
        type: asset.type,
        quantidade: quantidade.toNumber(),
        precoMedio: em2Casas(precoMedio),
        precoAtual: em2Casas(precoAtual),
        valorAplicado: em2Casas(valorAplicado),
        valorAtual: em2Casas(valorAtual),
        lucro: em2Casas(lucro),
        lucroPct: em2Casas(lucroPct),
      });
    }

    // ordena pelo maior valor atual (mais relevante primeiro)
    return ativos.sort((a, b) => b.valorAtual - a.valorAtual);
  },

  // Resumo do patrimônio: totais e alocação percentual por classe
  async getSummary(userId: string) {
    const [ativos, proventos, taxasPagas] = await Promise.all([
      this.getCarteira(userId),
      portfolioRepository.totalProventos(userId),
      this.totalTaxasPagas(userId),
    ]);

    const patrimonioTotal = ativos.reduce((soma, a) => soma + a.valorAtual, 0);
    const totalAplicado = ativos.reduce((soma, a) => soma + a.valorAplicado, 0);
    const lucroTotal = patrimonioTotal - totalAplicado;

    // agrupa o valor atual por classe de ativo (ACAO, FII, ETF, RENDA_FIXA)
    const valorPorClasse = new Map<string, number>();
    for (const a of ativos) {
      valorPorClasse.set(a.type, (valorPorClasse.get(a.type) ?? 0) + a.valorAtual);
    }

    const alocacaoPorClasse = [...valorPorClasse.entries()]
      .map(([classe, valor]) => ({
        classe,
        valor: Number(valor.toFixed(2)),
        percentual:
          patrimonioTotal === 0 ? 0 : Number(((valor / patrimonioTotal) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.valor - a.valor);

    return {
      patrimonioTotal: Number(patrimonioTotal.toFixed(2)),
      totalAplicado: Number(totalAplicado.toFixed(2)),
      lucroTotal: Number(lucroTotal.toFixed(2)),
      lucroPct:
        totalAplicado === 0 ? 0 : Number(((lucroTotal / totalAplicado) * 100).toFixed(2)),
      totalProventos: proventos ? em2Casas(proventos) : 0,
      totalTaxas: em2Casas(taxasPagas),
      quantidadeAtivos: ativos.length,
      alocacaoPorClasse,
    };
  },
};
