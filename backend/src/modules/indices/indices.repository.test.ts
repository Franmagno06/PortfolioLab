import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { indicesRepository } from "./indices.repository.js";

// Escreve no banco local (Docker), como todo teste que importa o prisma. A tabela index_points guarda o
// histórico de IFIX/SMLL/IDIV que o `npm run dev` acumula: o teste só usa datas de 1990, que nenhum
// pregão gravado de verdade tem, e só apaga essas linhas. O histórico de desenvolvimento fica intacto.
const DATAS_DE_TESTE = ["1990-01-02", "1990-01-03"] as const;
const [DIA_1, DIA_2] = DATAS_DE_TESTE;
const doTeste = { slug: "ifix", date: { in: DATAS_DE_TESTE.map((d) => new Date(`${d}T00:00:00.000Z`)) } };

const pontosDoTeste = async () =>
  (await indicesRepository.listarPontos("ifix")).filter((p) => (DATAS_DE_TESTE as readonly string[]).includes(p.data));

async function limpar() {
  await prisma.indexPoint.deleteMany({ where: doTeste });
}

beforeEach(limpar);
afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("indicesRepository", () => {
  it("gravar o mesmo dia duas vezes deixa uma linha com o último valor", async () => {
    await indicesRepository.gravarPonto("ifix", DIA_1, 3950.1);
    await indicesRepository.gravarPonto("ifix", DIA_1, 3953.42);

    expect(await prisma.indexPoint.count({ where: doTeste })).toBe(1);
    expect(await pontosDoTeste()).toEqual([{ data: DIA_1, valor: 3953.42 }]);
  });

  it("lista em ordem crescente de data", async () => {
    await indicesRepository.gravarPonto("ifix", DIA_2, 3960);
    await indicesRepository.gravarPonto("ifix", DIA_1, 3953.42);

    expect((await pontosDoTeste()).map((p) => p.data)).toEqual([DIA_1, DIA_2]);
  });

  it("a limpeza do teste não apaga o histórico de outras datas", async () => {
    // um "pregão de verdade" de mentira, numa data fora das do teste; apagado à mão no fim
    const outra = { slug: "ifix", date: new Date("1989-12-29T00:00:00.000Z") };
    await indicesRepository.gravarPonto("ifix", "1989-12-29", 2);
    await indicesRepository.gravarPonto("ifix", DIA_1, 1);

    try {
      await limpar();

      expect(await prisma.indexPoint.count({ where: doTeste })).toBe(0);
      expect(await prisma.indexPoint.count({ where: outra })).toBe(1);
    } finally {
      await prisma.indexPoint.deleteMany({ where: outra });
    }
  });
});
