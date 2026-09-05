import { Prisma } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import { goalsRepository } from "../goals/goals.repository.js";
import { portfolioService } from "../portfolio/portfolio.service.js";
import { quotesService, type AtivoParaCotacao } from "../quotes/quotes.service.js";

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
    // Comparação direta, não localeCompare: sem locale explícito ele depende do
    // ICU do ambiente, e este desempate existe justamente para a mesma carteira
    // sugerir sempre a mesma compra, em qualquer máquina.
    return a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0;
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

  // Achado 16: sem preço não há como dividir o aporte em unidades. O ativo é
  // pulado, mas sai daqui nomeado — some da lista de compras, não do resultado.
  const ignorados: { ticker: string; motivo: string }[] = [];

  for (const c of comDeficit) {
    if (c.precoAtual <= 0) {
      ignorados.push({ ticker: c.ticker, motivo: "sem cotação disponível — preço zerado" });
      continue;
    }
    if (c.deficit.lte(0)) continue; // acima da meta: não recebe aporte

    // orçamento deste ativo: o menor entre o déficit e o dinheiro que sobrou
    const orcamento = c.deficit.lt(restante) ? c.deficit : restante;
    const quantidade = orcamento.div(c.precoAtual).floor(); // unidades inteiras
    if (quantidade.lte(0)) {
      // O outro jeito de um ativo sumir das compras: o dinheiro disponível não
      // paga nem uma unidade. Sem isto, 'ignorados' vazio mentiria dizendo que
      // todos os ativos foram considerados.
      ignorados.push({
        ticker: c.ticker,
        motivo: `aporte insuficiente para 1 unidade (R$ ${c.precoAtual.toFixed(2).replace(".", ",")})`,
      });
      continue;
    }

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
    ignorados,
  };
}

export const rebalanceService = {
  async simulate(userId: string, valorAporte: number) {
    // As duas leituras são independentes e nenhuma delas grava — antes,
    // getCarteira atualizava as cotações enquanto findManyByUser lia a mesma
    // coluna, e a simulação acabava com dois preços do mesmo ativo.
    const [metas, posicoes] = await Promise.all([
      goalsRepository.findManyByUser(userId),
      portfolioService.posicoesPorAtivo(userId),
    ]);

    if (metas.length === 0) {
      throw new AppError(
        "Nenhuma meta de alocação cadastrada. Defina as metas em PUT /goals antes de simular.",
        400,
      );
    }

    // União dos ativos: os que têm meta e os que estão na carteira. Uma
    // resolução de preços só, depois das duas leituras, e o mesmo mapa
    // responde por quanto custa a unidade e por quanto vale a posição.
    const uniao = new Map<string, AtivoParaCotacao>();
    for (const p of posicoes) uniao.set(p.asset.ticker, p.asset);
    for (const m of metas) uniao.set(m.asset.ticker, m.asset);

    const precos = await quotesService.resolverPrecos([...uniao.values()]);
    const precoDe = (ticker: string) => precos.get(ticker) ?? new Prisma.Decimal(0);

    const quantidadePorTicker = new Map(posicoes.map((p) => [p.asset.ticker, p.quantidade]));
    const tickersComMeta = new Set(metas.map((m) => m.asset.ticker));

    // Só o que tem meta entra no denominador. Antes o patrimônio somava TODOS
    // os ativos: com metas em parte da carteira, o alvo de cada ativo era
    // calculado sobre um bolo que ele nunca poderia ocupar, e o déficit saía
    // inflado. Você rebalanceia a parte da carteira que decidiu gerenciar.
    const patrimonioConsiderado = posicoes.reduce(
      (soma, p) =>
        tickersComMeta.has(p.asset.ticker)
          ? soma.plus(p.quantidade.times(precoDe(p.asset.ticker)))
          : soma,
      new Prisma.Decimal(0),
    );

    // O que ficou de fora não some em silêncio: a tela precisa dizer quanto
    // dinheiro a simulação não está considerando, e de quais ativos.
    const fora = posicoes
      .filter((p) => !tickersComMeta.has(p.asset.ticker))
      .map((p) => ({
        ticker: p.asset.ticker,
        valor: em2Casas(p.quantidade.times(precoDe(p.asset.ticker))),
      }))
      .filter((a) => a.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    const somaMetas = metas.reduce((soma, m) => soma + m.targetWeight.toNumber(), 0);

    const candidatos: CandidatoAporte[] = metas.map((m) => {
      const preco = precoDe(m.asset.ticker);
      const quantidade = quantidadePorTicker.get(m.asset.ticker) ?? new Prisma.Decimal(0);

      return {
        ticker: m.asset.ticker,
        name: m.asset.name,
        precoAtual: preco.toNumber(),
        valorAtual: em2Casas(quantidade.times(preco)),
        alvoPct: m.targetWeight.toNumber(),
      };
    });

    return {
      ...calcularAporte(candidatos, valorAporte, em2Casas(patrimonioConsiderado)),
      patrimonioConsiderado: em2Casas(patrimonioConsiderado),
      somaMetas,
      foraDaSimulacao: {
        valor: fora.reduce((soma, a) => soma + a.valor, 0),
        ativos: fora,
      },
    };
  },
};
