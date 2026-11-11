import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import type { PontoSerie } from "./indices.calculos.js";

// Só este arquivo fala com o Prisma. index_points é dado público e global (IFIX, SMLL, IDIV e fallback SGS),
// nunca de um usuário. O Decimal fica dentro do banco: a saída já vem como PontoSerie.

export type SlugGravado = "ifix" | "smll" | "idiv";

function paraDataUtc(data: string): Date {
  const iso = data.length === 7 ? `${data}-01` : data;
  return new Date(`${iso}T00:00:00.000Z`);
}

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

  /** Grava vários pontos de uma vez e atualiza o ponto mais recente da lista via upsert. */
  async gravarPontosEmLote(slug: string, pontos: PontoSerie[]): Promise<void> {
    if (pontos.length === 0) return;
    await prisma.indexPoint.createMany({
      data: pontos.map((p) => ({
        slug,
        date: paraDataUtc(p.data),
        value: new Prisma.Decimal(p.valor),
      })),
      skipDuplicates: true,
    });
    const ultimo = pontos[pontos.length - 1]!;
    const date = paraDataUtc(ultimo.data);
    const value = new Prisma.Decimal(ultimo.valor);
    await prisma.indexPoint.upsert({
      where: { slug_date: { slug, date } },
      create: { slug, date, value },
      update: { value },
    });
  },

  /** Persiste a série mensal do SGS no banco para servir de fallback entre reinícios. */
  async gravarSerieSgs(codigo: number, pontos: PontoSerie[]): Promise<void> {
    await indicesRepository.gravarPontosEmLote(`sgs-${codigo}`, pontos);
  },

  /** Lê a última série mensal do SGS persistida no banco. */
  async listarSerieSgs(codigo: number): Promise<PontoSerie[]> {
    const linhas = await prisma.indexPoint.findMany({
      where: { slug: `sgs-${codigo}` },
      orderBy: { date: "asc" },
    });
    return linhas.map((l) => ({ data: l.date.toISOString().slice(0, 10), valor: l.value.toNumber() }));
  },
};
