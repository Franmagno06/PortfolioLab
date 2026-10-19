import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import type { PontoSerie } from "./indices.calculos.js";

// Só este arquivo fala com o Prisma. index_points é dado público e global (IFIX, SMLL, IDIV),
// nunca de um usuário. O Decimal fica dentro do banco: a saída já vem como PontoSerie.

export type SlugGravado = "ifix" | "smll" | "idiv";

export const indicesRepository = {
  /** Um ponto por índice por dia: gravar o mesmo dia de novo só atualiza o valor. */
  async gravarPonto(slug: SlugGravado, data: string, valor: number): Promise<void> {
    const date = new Date(`${data}T00:00:00.000Z`);
    const value = new Prisma.Decimal(valor);
    await prisma.indexPoint.upsert({
      where: { slug_date: { slug, date } },
      create: { slug, date, value },
      update: { value },
    });
  },

  /** Série gravada, da data mais antiga para a mais recente. */
  async listarPontos(slug: SlugGravado): Promise<PontoSerie[]> {
    const linhas = await prisma.indexPoint.findMany({ where: { slug }, orderBy: { date: "asc" } });
    return linhas.map((l) => ({ data: l.date.toISOString().slice(0, 10), valor: l.value.toNumber() }));
  },
};
