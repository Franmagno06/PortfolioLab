import type { Asset } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { buscarCotacao, buscarCotacoes } from "./quotes.provider.js";

// Cotação com menos de 15 minutos é considerada fresca. A B3 opera em
// pregão contínuo, mas para acompanhamento de carteira de longo prazo
// esse intervalo é mais que suficiente e evita consultas desnecessárias.
const VALIDADE_MS = 15 * 60 * 1000;

function estaDesatualizado(asset: Pick<Asset, "priceUpdatedAt">): boolean {
  if (!asset.priceUpdatedAt) return true; // veio do seed, nunca atualizado
  return Date.now() - asset.priceUpdatedAt.getTime() > VALIDADE_MS;
}

export const quotesService = {
  /**
   * Atualiza no banco as cotações que estiverem velhas.
   * Renda fixa não é cotada em bolsa, então fica de fora.
   * Falha na API não é erro fatal: mantém o último preço conhecido.
   */
  async atualizarSeNecessario(assets: Asset[]): Promise<Map<string, number>> {
    const precos = new Map<string, number>();
    for (const a of assets) precos.set(a.ticker, a.currentPrice.toNumber());

    const desatualizados = assets.filter(
      (a) => a.type !== "RENDA_FIXA" && estaDesatualizado(a),
    );
    if (desatualizados.length === 0) return precos;

    const cotacoes = await buscarCotacoes(desatualizados.map((a) => a.ticker));
    if (cotacoes.size === 0) return precos;

    const agora = new Date();
    await Promise.all(
      [...cotacoes.values()].map((c) => {
        precos.set(c.ticker, c.preco);
        return prisma.asset.update({
          where: { ticker: c.ticker },
          data: { currentPrice: c.preco, priceUpdatedAt: agora },
        });
      }),
    );

    return precos;
  },

  /**
   * Encontra o ativo pelo ticker; se não existir no banco, busca na API
   * de cotações e cadastra. É o que permite ao usuário registrar qualquer
   * ação ou FII da B3 sem depender de uma lista pré-carregada.
   */
  async buscarOuCadastrar(ticker: string): Promise<Asset | null> {
    const simbolo = ticker.toUpperCase().trim();

    const existente = await prisma.asset.findUnique({ where: { ticker: simbolo } });
    if (existente) {
      // aproveita a consulta para refrescar o preço, se estiver velho
      if (existente.type !== "RENDA_FIXA" && estaDesatualizado(existente)) {
        const cotacao = await buscarCotacao(simbolo);
        if (cotacao) {
          return prisma.asset.update({
            where: { ticker: simbolo },
            data: { currentPrice: cotacao.preco, priceUpdatedAt: new Date() },
          });
        }
      }
      return existente;
    }

    const cotacao = await buscarCotacao(simbolo);
    if (!cotacao) return null;

    return prisma.asset.create({
      data: {
        ticker: cotacao.ticker,
        name: cotacao.nome,
        type: cotacao.tipo,
        currentPrice: cotacao.preco,
        priceUpdatedAt: new Date(),
      },
    });
  },
};
