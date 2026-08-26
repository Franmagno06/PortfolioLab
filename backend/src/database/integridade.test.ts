import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";

// Achado 9: as chaves estrangeiras não declaravam onDelete. Apagar um usuário
// esbarrava nas transações dele; apagar um Asset em uso era barrado só pelo
// padrão implícito do Prisma. Estes testes fixam as duas intenções.

const SUFIXO = "integridade-test";
const email = `${SUFIXO}@portfoliolab.test`;
const TICKER = "ZZIN3";

async function limpar() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.assetGoal.deleteMany({ where: { userId: user.id } });
    await prisma.dividend.deleteMany({ where: { userId: user.id } });
    await prisma.report.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.asset.deleteMany({ where: { ticker: TICKER } });
}

/** Usuário com um filho de cada tipo que aponta para ele. */
async function usuarioComTodosOsFilhos() {
  const user = await prisma.user.create({
    data: { name: "Integridade", email, passwordHash: "hash-irrelevante" },
  });

  const asset = await prisma.asset.create({
    data: { ticker: TICKER, name: "Ativo Integridade", type: "ACAO", currentPrice: 10 },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      assetId: asset.id,
      kind: "COMPRA",
      quantity: 1,
      unitPrice: 10,
      executedAt: new Date(),
    },
  });
  await prisma.assetGoal.create({
    data: { userId: user.id, assetId: asset.id, targetWeight: 100 },
  });
  await prisma.dividend.create({
    data: { userId: user.id, assetId: asset.id, amount: 5, paidAt: new Date() },
  });
  await prisma.report.create({
    data: { userId: user.id, fileName: "x.pdf", extractedText: "texto" },
  });

  return { user, asset };
}

beforeEach(limpar);
afterAll(limpar);

describe("integridade referencial do schema", () => {
  it("apagar o usuário leva junto transações, metas, proventos e relatórios", async () => {
    const { user } = await usuarioComTodosOsFilhos();

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.assetGoal.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.dividend.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.report.count({ where: { userId: user.id } })).toBe(0);
  });

  it("apagar um ativo que alguém possui continua sendo recusado", async () => {
    const { asset } = await usuarioComTodosOsFilhos();

    await expect(prisma.asset.delete({ where: { id: asset.id } })).rejects.toThrow();

    expect(await prisma.asset.count({ where: { id: asset.id } })).toBe(1);
  });

  it("o ativo sobrevive à remoção do usuário — é catálogo, não dado de usuário", async () => {
    const { user, asset } = await usuarioComTodosOsFilhos();

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.asset.count({ where: { id: asset.id } })).toBe(1);
  });
});
