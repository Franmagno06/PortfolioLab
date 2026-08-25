import { AssetType, PrismaClient, TransactionKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { assertDatabaseUrlIsLocal } from "../src/config/dbGuard.js";

// O main() abaixo faz deleteMany() em todas as tabelas — abortar antes de
// conectar é o que separa um seed local de um apagão na produção.
assertDatabaseUrlIsLocal(process.env.DATABASE_URL);

const prisma = new PrismaClient();

// Mesmos ativos do protótipo Figma, com metas que somam 100%
const carteira = [
  { ticker: "MXRF11", name: "Maxi Renda FII", type: AssetType.FII, sector: "Papel/Híbrido", currentPrice: 10.85, quantity: 120, avgPrice: 10.4, targetWeight: 12 },
  { ticker: "HGLG11", name: "CSHG Logística FII", type: AssetType.FII, sector: "Logística", currentPrice: 155.0, quantity: 20, avgPrice: 148.0, targetWeight: 15 },
  { ticker: "PETR4", name: "Petrobras PN", type: AssetType.ACAO, sector: "Petróleo e Gás", currentPrice: 38.2, quantity: 50, avgPrice: 32.5, targetWeight: 10 },
  { ticker: "VALE3", name: "Vale ON", type: AssetType.ACAO, sector: "Mineração", currentPrice: 62.5, quantity: 40, avgPrice: 68.0, targetWeight: 10 },
  { ticker: "ITUB4", name: "Itaú Unibanco PN", type: AssetType.ACAO, sector: "Bancos", currentPrice: 34.8, quantity: 60, avgPrice: 28.9, targetWeight: 8 },
  { ticker: "IPCA2035", name: "Tesouro IPCA+ 2035", type: AssetType.RENDA_FIXA, sector: "Tesouro Direto", currentPrice: 1000.0, quantity: 5, avgPrice: 940.0, targetWeight: 20 },
  { ticker: "BOVA11", name: "iShares Ibovespa ETF", type: AssetType.ETF, sector: "Índice Brasil", currentPrice: 110.0, quantity: 15, avgPrice: 104.0, targetWeight: 15 },
  { ticker: "IVVB11", name: "iShares S&P 500 ETF", type: AssetType.ETF, sector: "Índice EUA", currentPrice: 290.0, quantity: 10, avgPrice: 255.0, targetWeight: 10 },
];

// Proventos recentes dos FIIs (valor total recebido pela posição)
const proventos = [
  { ticker: "MXRF11", amount: 12.0, paidAt: new Date("2026-04-15") },
  { ticker: "MXRF11", amount: 12.0, paidAt: new Date("2026-05-15") },
  { ticker: "MXRF11", amount: 13.2, paidAt: new Date("2026-06-15") },
  { ticker: "HGLG11", amount: 22.0, paidAt: new Date("2026-05-10") },
  { ticker: "HGLG11", amount: 22.0, paidAt: new Date("2026-06-10") },
];

async function main() {
  // Limpa tudo (ordem importa por causa das foreign keys) para o seed ser idempotente
  await prisma.dividend.deleteMany();
  await prisma.assetGoal.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      name: "Usuário Demo",
      email: "demo@portfoliolab.dev",
      passwordHash: await bcrypt.hash("123456", 10),
    },
  });

  for (const item of carteira) {
    const asset = await prisma.asset.create({
      data: {
        ticker: item.ticker,
        name: item.name,
        type: item.type,
        sector: item.sector,
        currentPrice: item.currentPrice,
      },
    });

    // Posição atual representada como uma compra única pelo preço médio
    await prisma.transaction.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        kind: TransactionKind.COMPRA,
        quantity: item.quantity,
        unitPrice: item.avgPrice,
        executedAt: new Date("2026-01-15"),
      },
    });

    await prisma.assetGoal.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        targetWeight: item.targetWeight,
      },
    });
  }

  for (const p of proventos) {
    const asset = await prisma.asset.findUniqueOrThrow({ where: { ticker: p.ticker } });
    await prisma.dividend.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        amount: p.amount,
        paidAt: p.paidAt,
      },
    });
  }

  console.log("Seed concluído: 1 usuário, 8 ativos, 8 transações, 8 metas, 5 proventos.");
  console.log("Login demo: demo@portfoliolab.dev / 123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
