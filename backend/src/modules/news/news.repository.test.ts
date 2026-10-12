import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { newsRepository } from "./news.repository.js";

const PREFIXO = "https://teste.invalid/news-repo/";
const item = (n: number, publicadoEm: string) => ({
  titulo: `Matéria ${n}`,
  resumo: "",
  link: `${PREFIXO}${n}`,
  fonte: "Teste",
  publicadoEm,
});

const limpar = () => prisma.newsItem.deleteMany({ where: { url: { startsWith: PREFIXO } } });

beforeEach(limpar);
afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("newsRepository", () => {
  it("o mesmo link não é gravado duas vezes", async () => {
    await newsRepository.saveMany([item(1, "2026-10-09T12:00:00.000Z")]);
    await newsRepository.saveMany([item(1, "2026-10-09T12:00:00.000Z"), item(2, "2026-10-10T12:00:00.000Z")]);
    const linhas = await newsRepository.findSince(new Date("2026-10-01T00:00:00.000Z"));
    expect(linhas.filter((l) => l.url.startsWith(PREFIXO))).toHaveLength(2);
  });

  it("findSince devolve as mais recentes primeiro e deleteOlderThan apaga as antigas", async () => {
    await newsRepository.saveMany([item(1, "2026-10-01T12:00:00.000Z"), item(2, "2026-10-10T12:00:00.000Z")]);
    const antes = (await newsRepository.findSince(new Date("2026-09-01T00:00:00.000Z"))).filter((l) => l.url.startsWith(PREFIXO));
    expect(antes.map((l) => l.url)).toEqual([`${PREFIXO}2`, `${PREFIXO}1`]);

    await newsRepository.deleteOlderThan(new Date("2026-10-05T00:00:00.000Z"));
    const depois = (await newsRepository.findSince(new Date("2026-09-01T00:00:00.000Z"))).filter((l) => l.url.startsWith(PREFIXO));
    expect(depois.map((l) => l.url)).toEqual([`${PREFIXO}2`]);
  });
});
