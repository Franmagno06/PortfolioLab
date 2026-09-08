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
  const patrimonioProjetado = new Prisma.Decimal(patrimonioAtual).plus(valorAporte);

  // Passo 2: déficit em R$ de cada ativo
  const comDeficit = candidatos.map((c) => ({
    ...c,
    deficit: patrimonioProjetado.times(c.alvoPct).div(100).minus(c.valorAtual),
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

  // Ativos sem preço saem antes de qualquer conta: não há como dividir o
  // aporte em unidades de um ativo cujo preço é zero.
  const elegiveis = comDeficit.filter((c) => {
    if (c.precoAtual <= 0) {
      ignorados.push({ ticker: c.ticker, motivo: "sem cotação disponível — preço zerado" });
      return false;
    }
    return c.deficit.gt(0); // acima da meta: não recebe aporte, e isso é normal
  });

  // Quanto cada ativo já recebeu, em reais. A segunda passada consulta este
  // mapa para saber quanto ainda falta para o ativo chegar à meta.
  const gasto = new Map<string, Prisma.Decimal>(
    elegiveis.map((c) => [c.ticker, new Prisma.Decimal(0)]),
  );

  /** Compra `quantidade` unidades e atualiza restante e gasto do ativo. */
  const comprar = (c: (typeof elegiveis)[number], quantidade: Prisma.Decimal) => {
    const total = quantidade.times(c.precoAtual);
    restante = restante.minus(total);
    gasto.set(c.ticker, (gasto.get(c.ticker) ?? new Prisma.Decimal(0)).plus(total));
  };

  /** O que falta para este ativo chegar à meta, descontado o que já recebeu. */
  const deficitRestante = (c: (typeof elegiveis)[number]) =>
    c.deficit.minus(gasto.get(c.ticker) ?? new Prisma.Decimal(0));

  // ── Primeira passada: proporcional ao déficit ───────────────────────────
  //
  // O algoritmo guloso anterior dava a cada ativo o mínimo entre o déficit e o
  // dinheiro restante, do maior déficit para o menor. Quando o aporte é menor
  // que a soma dos déficits — o caso normal de quem aporta todo mês — o
  // primeiro da fila levava quase tudo. Na carteira de demonstração, BBAS3
  // ficava com 89% de um aporte de R$ 3.000 e metade dos ativos abaixo da meta
  // não recebia nada.
  //
  // Aqui cada ativo recebe a fatia do aporte proporcional ao tamanho do seu
  // buraco, limitada pelo próprio déficit. Todos andam na direção da meta.
  const deficitTotal = elegiveis.reduce(
    (soma, c) => soma.plus(c.deficit),
    new Prisma.Decimal(0),
  );

  for (const c of elegiveis) {
    if (deficitTotal.isZero()) break;

    const fatia = new Prisma.Decimal(valorAporte).times(c.deficit).div(deficitTotal);
    // a fatia nunca ultrapassa o déficit, e nunca ultrapassa o que sobrou
    const orcamento = Prisma.Decimal.min(fatia, c.deficit, restante);
    const quantidade = orcamento.div(c.precoAtual).floor();

    if (quantidade.gt(0)) comprar(c, quantidade);
  }

  // ── Segunda passada: aproveita o troco ──────────────────────────────────
  //
  // A primeira passada compra unidades inteiras, então quase sempre sobra
  // dinheiro: uma fatia de R$ 150 numa cota de R$ 100 deixa R$ 50 parados.
  // Somadas, essas sobras compram mais cotas. Aqui elas são gastas no ativo
  // que continua mais longe da meta, repetindo até nada mais caber.
  //
  // O laço termina: cada volta ou compra ao menos uma unidade (e reduz
  // `restante` em pelo menos um preço) ou não compra nada e sai.
  for (;;) {
    const candidatos = elegiveis
      .filter((c) => deficitRestante(c).gte(c.precoAtual) && restante.gte(c.precoAtual))
      // maior déficit remanescente primeiro; desempate igual ao da ordenação
      // inicial, para a mesma carteira sugerir sempre a mesma compra
      .sort((a, b) => {
        const porDeficit = deficitRestante(b).comparedTo(deficitRestante(a));
        if (porDeficit !== 0) return porDeficit;
        if (a.precoAtual !== b.precoAtual) return a.precoAtual - b.precoAtual;
        return a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0;
      });

    const alvo = candidatos[0];
    if (!alvo) break;

    const orcamento = Prisma.Decimal.min(deficitRestante(alvo), restante);
    const quantidade = orcamento.div(alvo.precoAtual).floor();
    if (quantidade.lte(0)) break;

    comprar(alvo, quantidade);
  }

  // ── Resultado: quem comprou vira compra, quem não comprou vira ignorado ──
  for (const c of elegiveis) {
    const total = gasto.get(c.ticker) ?? new Prisma.Decimal(0);

    if (total.isZero()) {
      // Duas causas diferentes levam a zero unidades, e confundi-las põe a
      // culpa no lugar errado. Se o ativo ainda tem déficit para uma cota, o
      // que faltou foi dinheiro. Se nem o déficit paga uma cota, aí sim o
      // preço é a barreira.
      const preco = c.precoAtual.toFixed(2).replace(".", ",");
      ignorados.push({
        ticker: c.ticker,
        motivo: c.deficit.gte(c.precoAtual)
          ? "o aporte acabou antes de sobrar para este ativo"
          : `1 unidade custa R$ ${preco} e o déficit do ativo é menor`,
      });
      continue;
    }

    gastoPorTicker.set(c.ticker, total);
    compras.push({
      ticker: c.ticker,
      name: c.name,
      deficit: em2Casas(c.deficit),
      quantidade: total.div(c.precoAtual).toNumber(),
      precoUnitario: c.precoAtual,
      total: em2Casas(total),
    });
  }

  // as compras saem na ordem em que a lista já estava: maior déficit primeiro
  compras.sort((a, b) => b.deficit - a.deficit || (a.ticker < b.ticker ? -1 : 1));

  const totalGasto = new Prisma.Decimal(valorAporte).minus(restante);

  // O patrimônio que o usuário realmente terá conta o que virou ativo, não o
  // aporte inteiro: o troco fica em caixa, fora da carteira. Antes a tela
  // mostrava patrimônio + aporte enquanto os percentuais usavam
  // patrimônio + gasto — duas réguas para o mesmo número.
  //
  // O déficit continua calculado sobre patrimonioProjetado, e isso é
  // deliberado: ali o alvo é "se todo o aporte for investido", que é a
  // pergunta certa ANTES de saber quanto vai sobrar.
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
    /** O que vira ativo: patrimônio + o que foi gasto. Base dos percentuais. */
    patrimonioFinal: em2Casas(patrimonioAposCompras),
    /** Base do cálculo do déficit: patrimônio + o aporte inteiro. */
    patrimonioProjetado: em2Casas(patrimonioProjetado),
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
