import { Prisma } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import { goalsRepository } from "../goals/goals.repository.js";
import { portfolioService } from "../portfolio/portfolio.service.js";

export type CandidatoAporte = {
  ticker: string;
  name: string;
  precoAtual: number; // preço de 1 unidade do ativo
  valorAtual: number; // posição atual do usuário em R$
  alvoPct: number; // meta de alocação em %
};

function em2Casas(d: Prisma.Decimal): number {
  return d.toDecimalPlaces(2).toNumber();
}

/**
 * ALGORITMO GULOSO DE REBALANCEAMENTO POR APORTE
 *
 * Ideia: em vez de vender o que passou da meta (gera imposto e custos),
 * o aporte novo vai para os ativos MAIS ABAIXO da meta.
 *
 * Passos:
 *  1. patrimônio final = patrimônio atual + aporte
 *  2. déficit de cada ativo (R$) = (meta% × patrimônio final) − posição atual
 *  3. ordena por maior déficit  ................................. O(n log n)
 *     (empate: menor preço primeiro — mais granularidade — depois ticker)
 *  4. percorre a lista comprando unidades INTEIRAS, limitado pelo
 *     déficit do ativo e pelo dinheiro restante  ................ O(n)
 *
 * Complexidade total: O(n log n), dominada pela ordenação.
 * É "guloso" porque em cada passo faz a escolha localmente ótima
 * (atacar o maior déficit) sem reconsiderar decisões anteriores.
 *
 * Função pura: recebe dados, devolve resultado — testável sem banco.
 */
export function calcularAporte(
  candidatos: CandidatoAporte[],
  valorAporte: number,
  patrimonioAtual: number,
) {
  const patrimonioFinal = new Prisma.Decimal(patrimonioAtual).plus(valorAporte);

  // Passo 2: déficit em R$ de cada ativo
  const comDeficit = candidatos.map((c) => ({
    ...c,
    deficit: patrimonioFinal.times(c.alvoPct).div(100).minus(c.valorAtual),
  }));

  // Passo 3: maior déficit primeiro; desempate determinístico
  comDeficit.sort((a, b) => {
    const porDeficit = b.deficit.comparedTo(a.deficit);
    if (porDeficit !== 0) return porDeficit;
    if (a.precoAtual !== b.precoAtual) return a.precoAtual - b.precoAtual;
    return a.ticker.localeCompare(b.ticker);
  });

  // Passo 4: alocação gulosa em unidades inteiras
  let restante = new Prisma.Decimal(valorAporte);
  const compras: {
    ticker: string;
    name: string;
    deficit: number;
    quantidade: number;
    precoUnitario: number;
    total: number;
  }[] = [];

  const gastoPorTicker = new Map<string, Prisma.Decimal>();

  for (const c of comDeficit) {
    if (c.deficit.lte(0)) continue; // acima da meta: não recebe aporte

    // orçamento deste ativo: o menor entre o déficit e o dinheiro que sobrou
    const orcamento = c.deficit.lt(restante) ? c.deficit : restante;
    const quantidade = orcamento.div(c.precoAtual).floor(); // unidades inteiras
    if (quantidade.lte(0)) continue;

    const total = quantidade.times(c.precoAtual);
    restante = restante.minus(total);
    gastoPorTicker.set(c.ticker, total);

    compras.push({
      ticker: c.ticker,
      name: c.name,
      deficit: em2Casas(c.deficit),
      quantidade: quantidade.toNumber(),
      precoUnitario: c.precoAtual,
      total: em2Casas(total),
    });
  }

  const totalGasto = new Prisma.Decimal(valorAporte).minus(restante);

  // Comparação antes vs. depois (a tela "Antes vs. Depois" do protótipo)
  const patrimonioAposCompras = new Prisma.Decimal(patrimonioAtual).plus(totalGasto);
  const alocacao = comDeficit
    .map((c) => {
      const gasto = gastoPorTicker.get(c.ticker) ?? new Prisma.Decimal(0);
      const valorDepois = gasto.plus(c.valorAtual);
      return {
        ticker: c.ticker,
        alvoPct: c.alvoPct,
        atualPct:
          patrimonioAtual === 0
            ? 0
            : em2Casas(new Prisma.Decimal(c.valorAtual).div(patrimonioAtual).times(100)),
        aposAportePct: patrimonioAposCompras.isZero()
          ? 0
          : em2Casas(valorDepois.div(patrimonioAposCompras).times(100)),
      };
    })
    .sort((a, b) => b.alvoPct - a.alvoPct);

  return {
    valorAporte,
    patrimonioAtual,
    patrimonioFinal: em2Casas(patrimonioFinal),
    compras,
    totalGasto: em2Casas(totalGasto),
    restante: em2Casas(restante),
    alocacao,
  };
}

export const rebalanceService = {
  async simulate(userId: string, valorAporte: number) {
    const [metas, carteira] = await Promise.all([
      goalsRepository.findManyByUser(userId),
      portfolioService.getCarteira(userId),
    ]);

    if (metas.length === 0) {
      throw new AppError(
        "Nenhuma meta de alocação cadastrada. Defina as metas em PUT /goals antes de simular.",
        400,
      );
    }

    // patrimônio total inclui TODOS os ativos, mesmo os sem meta
    const patrimonioAtual = carteira.reduce((soma, a) => soma + a.valorAtual, 0);

    const candidatos: CandidatoAporte[] = metas.map((m) => ({
      ticker: m.asset.ticker,
      name: m.asset.name,
      precoAtual: m.asset.currentPrice.toNumber(),
      valorAtual: carteira.find((a) => a.ticker === m.asset.ticker)?.valorAtual ?? 0,
      alvoPct: m.targetWeight.toNumber(),
    }));

    return calcularAporte(candidatos, valorAporte, Number(patrimonioAtual.toFixed(2)));
  },
};
