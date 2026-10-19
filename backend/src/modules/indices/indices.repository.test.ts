import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { indicesRepository } from "./indices.repository.js";

// Escreve no banco local (Docker), como todo teste que importa o prisma. A tabela index_points
// só guarda IFIX/SMLL/IDIV; o teste limpa as linhas do slug "ifix" antes e depois.
async function limpar() {
  await prisma.indexPoint.deleteMany({ where: { slug: "ifix" } });
}

beforeAll(limpar);
beforeEach(limpar);
afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("indicesRepository", () => {
  it("gravar o mesmo dia duas vezes deixa uma linha com o último valor", async () => {
    await indicesRepository.gravarPonto("ifix", "2026-10-19", 3950.1);
    await indicesRepository.gravarPonto("ifix", "2026-10-19", 3953.42);

    expect(await prisma.indexPoint.count({ where: { slug: "ifix" } })).toBe(1);
    expect(await indicesRepository.listarPontos("ifix")).toEqual([{ data: "2026-10-19", valor: 3953.42 }]);
  });

  it("lista em ordem crescente de data", async () => {
    await indicesRepository.gravarPonto("ifix", "2026-10-20", 3960);
    await indicesRepository.gravarPonto("ifix", "2026-10-19", 3953.42);

    expect((await indicesRepository.listarPontos("ifix")).map((p) => p.data)).toEqual(["2026-10-19", "2026-10-20"]);
  });
});
