import { Prisma, type Asset } from "@prisma/client";
import { buscarCotacao, buscarCotacoes } from "./quotes.provider.js";
import { quotesRepository } from "./quotes.repository.js";

// Cotação com menos de 15 minutos é considerada fresca. A B3 opera em
// pregão contínuo, mas para acompanhamento de carteira de longo prazo
// esse intervalo é mais que suficiente e evita consultas desnecessárias.
const VALIDADE_MS = 15 * 60 * 1000;

/** O mínimo que se precisa saber de um ativo para decidir se vale cotá-lo. */
export type AtivoParaCotacao = Pick<
  Asset,
  "ticker" | "type" | "currentPrice" | "priceUpdatedAt"
>;

function estaDesatualizado(asset: Pick<Asset, "priceUpdatedAt">): boolean {
  if (!asset.priceUpdatedAt) return true; // veio do seed, nunca atualizado
  return Date.now() - asset.priceUpdatedAt.getTime() > VALIDADE_MS;
}

// A coluna current_price é Decimal(12,2): arredondar aqui faz o preço em
// memória ser exatamente o preço gravado, e não uma aproximação dele.
function emCentavos(preco: number): Prisma.Decimal {
  return new Prisma.Decimal(preco).toDecimalPlaces(2);
}

export const quotesService = {
  /**
   * Resolve o preço de cada ativo UMA vez, e devolve o mapa que todo mundo
   * consome — carteira, resumo e simulação de aporte.
   *
   * Existe para que não haja dois preços do mesmo ativo na mesma resposta: a
   * simulação lia `asset.current_price` enquanto a carteira, em paralelo,
   * gravava a cotação nova por cima. O déficit saía de um preço e a divisão em
   * unidades saía de outro.
   *
   * Renda fixa não é cotada em bolsa, então fica de fora. Falha na API não é
   * erro fatal: mantém o último preço conhecido.
   */
  async resolverPrecos(ativos: AtivoParaCotacao[]): Promise<Map<string, Prisma.Decimal>> {
    // um ativo pode chegar duas vezes (união de metas e carteira, por exemplo)
    const porTicker = new Map<string, AtivoParaCotacao>();
    for (const a of ativos) porTicker.set(a.ticker, a);

    const precos = new Map<string, Prisma.Decimal>();
    for (const a of porTicker.values()) precos.set(a.ticker, a.currentPrice);

    const desatualizados = [...porTicker.values()].filter(
      (a) => a.type !== "RENDA_FIXA" && estaDesatualizado(a),
    );
    if (desatualizados.length === 0) return precos;

    const cotacoes = await buscarCotacoes(desatualizados.map((a) => a.ticker));
    if (cotacoes.size === 0) return precos;

    for (const c of cotacoes.values()) precos.set(c.ticker, emCentavos(c.preco));

    // A gravação é oportunista: o preço a devolver já está no mapa e a resposta
    // não depende dela. allSettled porque um timeout de pool ou um deadlock não
    // podem derrubar um GET de carteira que já tem tudo o que precisa.
    const agora = new Date();
    await Promise.allSettled(
      [...cotacoes.values()].map((c) => quotesRepository.updatePrice(c.ticker, c.preco, agora)),
    );

    return precos;
  },

  /**
   * Encontra o ativo pelo ticker; se não existir no banco, busca na API
   * de cotações e cadastra. É o que permite ao usuário registrar qualquer
   * ação ou FII da B3 sem depender de uma lista pré-carregada — e é a porta
   * única para transações, metas e proventos.
   */
  async buscarOuCadastrar(ticker: string): Promise<Asset | null> {
    const simbolo = ticker.toUpperCase().trim();

    const existente = await quotesRepository.findByTicker(simbolo);
    if (existente) {
      // aproveita a consulta para refrescar o preço, se estiver velho
      if (existente.type !== "RENDA_FIXA" && estaDesatualizado(existente)) {
        const cotacao = await buscarCotacao(simbolo);
        if (cotacao) {
          const agora = new Date();
          await quotesRepository.updatePrice(simbolo, cotacao.preco, agora);
          return { ...existente, currentPrice: emCentavos(cotacao.preco), priceUpdatedAt: agora };
        }
      }
      return existente;
    }

    const cotacao = await buscarCotacao(simbolo);
    if (!cotacao) return null;

    return quotesRepository.create({
      ticker: cotacao.ticker,
      name: cotacao.nome,
      type: cotacao.tipo,
      currentPrice: cotacao.preco,
    });
  },
};
