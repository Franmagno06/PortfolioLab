import { prisma } from "../../database/prisma.js";
import type { ItemNoticia } from "./rss.js";

// O histórico de notícias dos feeds. Dado público e global, nunca de um usuário.
export const newsRepository = {
  /**
   * Grava as notícias que ainda não estão guardadas. O link é a chave única: ler o mesmo feed de
   * dez em dez minutos devolve quase as mesmas matérias, e skipDuplicates as descarta no banco.
   */
  saveMany(itens: ItemNoticia[]) {
    return prisma.newsItem.createMany({
      data: itens.map((n) => ({
        url: n.link,
        title: n.titulo,
        summary: n.resumo,
        source: n.fonte,
        publishedAt: new Date(n.publicadoEm),
      })),
      skipDuplicates: true,
    });
  },

  /** As notícias publicadas a partir de uma data, as mais recentes primeiro. */
  findSince(since: Date) {
    return prisma.newsItem.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
    });
  },

  deleteOlderThan(before: Date) {
    return prisma.newsItem.deleteMany({ where: { publishedAt: { lt: before } } });
  },
};
