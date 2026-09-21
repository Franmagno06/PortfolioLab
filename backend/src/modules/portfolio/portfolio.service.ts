import { Prisma } from "@prisma/client";
import { quotesService } from "../quotes/quotes.service.js";
import { portfolioRepository } from "./portfolio.repository.js";

type TransacaoComAtivo = Awaited<
  ReturnType<typeof portfolioRepository.transacoesComAtivo>
>[number];

export type TransacaoParaCalculo = {
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

export type HistoricoDeAtivo = {
  ticker: string;
  transacoes: TransacaoParaCalculo[];
  /** Fechamento mensal real do provedor, chave "AAAA-MM" (ver quotesService.historicoMensal). */
  fechamentos: Map<string, number>;
};

export type PontoEvolucao = {
  /** "AAAA-MM" */
  mes: string;
  aplicado: number;
  /** patrimônio − aplicado. Pode ser negativo (carteira no prejuízo naquele mês). */
  resultado: number;
  patrimonio: number;
};

/**
 * Reconstrói a evolução mensal do patrimônio a partir do histórico REAL de
 * transações e de fechamento — não inventa nenhum número.
 *
 * Para cada mês, reaplica calcularPosicao só com as transações até aquele
 * corte: a mesma função que decide a posição de hoje decide a posição de
 * qualquer mês passado, com a mesma regra de preço médio. O mês corrente usa
 * o preço de agora (o mês ainda não fechou); os anteriores usam o fechamento
 * real daquele mês, com o preço atual como último recurso se o provedor não
 * tiver o dado (ticker sem pregão naquele mês, IPO recente, falha da API —
 * o mesmo tratamento defensivo que o resto do app dá à falta de cotação).
 *
 * Meses anteriores à primeira transação de QUALQUER ativo não entram no
 * resultado: patrimônio zero por falta de atividade não é informação, é
 * ruído visual — a tela trata lista vazia como "sem histórico ainda".
 *
 * Tudo em UTC, nunca no fuso do servidor: executedAt vem de um <input
 * type="date"> sem hora, então o Zod grava meia-noite UTC (ver
 * nova-transacao.tsx no frontend, que já documenta o mesmo cuidado do lado
 * de cá). Um corte de mês construído no fuso local (ex. Brasília, UTC−3)
 * vira "01/ago 02:59 UTC" para o que deveria ser "31/jul 23:59" — tarde o
 * bastante para engolir uma venda do dia 1 de agosto dentro de julho, e o
 * mês fechado sairia com a posição errada. Ler e escrever em UTC dos dois
 * lados elimina esse descompasso.
 *
 * Pura: sem banco, sem HTTP — fácil de testar.
 */
export function calcularEvolucaoPatrimonial(
  ativos: HistoricoDeAtivo[],
  precoAtualPorTicker: Map<string, number>,
  hoje: Date,
  meses: number,
): PontoEvolucao[] {
  const chaveMes = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const mesAtual = chaveMes(hoje);

  const primeiraData = ativos
    .flatMap((a) => a.transacoes)
    .reduce<Date | null>((min, t) => (!min || t.executedAt < min ? t.executedAt : min), null);
  if (!primeiraData) return [];
  const mesDaPrimeira = chaveMes(primeiraData);

  const pontos: PontoEvolucao[] = [];

  for (let i = meses - 1; i >= 0; i--) {
    const referencia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
    const mes = chaveMes(referencia);
    if (mes < mesDaPrimeira) continue; // carteira ainda não existia

    // corte: último instante do mês em UTC, ou agora mesmo se for o mês corrente
    const cutoff =
      mes === mesAtual
        ? hoje
        : new Date(
            Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, 0, 23, 59, 59, 999),
          );

    let aplicado = ZERO;
    let patrimonio = ZERO;

    for (const ativo of ativos) {
      const ateOMes = ativo.transacoes.filter((t) => t.executedAt <= cutoff);
      if (ateOMes.length === 0) continue;

      const { quantidade, precoMedio } = calcularPosicao(ateOMes);
      if (quantidade.lte(0)) continue; // posição zerada naquele mês

      const precoAtual = precoAtualPorTicker.get(ativo.ticker);
      const preco =
        mes === mesAtual
          ? (precoAtual ?? precoMedio.toNumber())
          : (ativo.fechamentos.get(mes) ?? precoAtual ?? precoMedio.toNumber());

      aplicado = aplicado.plus(quantidade.times(precoMedio));
      patrimonio = patrimonio.plus(quantidade.times(preco));
    }

    pontos.push({
      mes,
      aplicado: em2Casas(aplicado),
      resultado: em2Casas(patrimonio.minus(aplicado)),
      patrimonio: em2Casas(patrimonio),
    });
  }

  return pontos;
}

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

  // Evolução mensal do patrimônio (dashboard), últimos `meses` meses.
  async getEvolucaoPatrimonial(userId: string, meses = 12): Promise<PontoEvolucao[]> {
    const transacoes = await portfolioRepository.transacoesComAtivo(userId);
    if (transacoes.length === 0) return [];

    const porAtivo = new Map<
      string,
      { asset: TransacaoComAtivo["asset"]; transacoes: TransacaoParaCalculo[] }
    >();
    for (const t of transacoes) {
      const grupo = porAtivo.get(t.assetId) ?? { asset: t.asset, transacoes: [] };
      grupo.transacoes.push(t);
      porAtivo.set(t.assetId, grupo);
    }

    const ativosUnicos = [...porAtivo.values()].map((g) => g.asset);

    // preço atual pela mesma fonte que o resto do app usa, e o fechamento
    // real de cada mês em paralelo — duas chamadas independentes ao provedor.
    const [precosAtuais, historicoMensal] = await Promise.all([
      quotesService.resolverPrecos(ativosUnicos),
      quotesService.historicoMensal(ativosUnicos, meses),
    ]);

    const ativosParaCalculo: HistoricoDeAtivo[] = [...porAtivo.values()].map((g) => ({
      ticker: g.asset.ticker,
      transacoes: g.transacoes,
      fechamentos: historicoMensal.get(g.asset.ticker) ?? new Map(),
    }));

    const precoAtualPorTicker = new Map(
      [...porAtivo.values()].map((g) => [
        g.asset.ticker,
        (precosAtuais.get(g.asset.ticker) ?? g.asset.currentPrice).toNumber(),
      ]),
    );

    return calcularEvolucaoPatrimonial(ativosParaCalculo, precoAtualPorTicker, new Date(), meses);
  },
};
