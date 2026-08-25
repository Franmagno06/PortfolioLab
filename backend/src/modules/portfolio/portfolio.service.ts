import { Prisma } from "@prisma/client";
import { quotesService } from "../quotes/quotes.service.js";
import { portfolioRepository } from "./portfolio.repository.js";

type TransacaoComAtivo = Awaited<
  ReturnType<typeof portfolioRepository.transacoesComAtivo>
>[number];

type TransacaoParaCalculo = {
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
 * A ordem das operações importa, por isso ordenamos por data.
 * Função pura (sem banco, sem HTTP) — fácil de testar unitariamente.
 */
export function calcularPosicao(transacoes: TransacaoParaCalculo[]) {
  const ordenadas = [...transacoes].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );

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

export const portfolioService = {
  // Posição consolidada por ativo — sempre DERIVADA das transações
  async getCarteira(userId: string) {
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

    // Busca cotações atualizadas antes de calcular. Se a API estiver fora,
    // o mapa devolve o último preço conhecido e a carteira não quebra.
    const precosAtuais = await quotesService.atualizarSeNecessario(
      [...porAtivo.values()].map((g) => g.asset),
    );

    const ativos = [];
    for (const { asset, transacoes: doAtivo } of porAtivo.values()) {
      const { quantidade, precoMedio } = calcularPosicao(doAtivo);
      if (quantidade.lte(0)) continue; // posição zerada não aparece na carteira

      const precoAtual = new Prisma.Decimal(
        precosAtuais.get(asset.ticker) ?? asset.currentPrice,
      );
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
    const [ativos, proventos] = await Promise.all([
      this.getCarteira(userId),
      portfolioRepository.totalProventos(userId),
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
      quantidadeAtivos: ativos.length,
      alocacaoPorClasse,
    };
  },
};
