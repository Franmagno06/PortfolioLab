import { PrismaClient, TransactionKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { assertDatabaseUrlIsLocal } from "../src/config/dbGuard.js";
import { quotesService } from "../src/modules/quotes/quotes.service.js";

// Este seed apaga e recria UMA conta (a de demonstração), não o banco inteiro
// como prisma/seed.ts. Ainda assim o guarda vem primeiro: escrever conta de
// teste no Supabase de produção é lixo que alguém teria de limpar à mão.
assertDatabaseUrlIsLocal(process.env.DATABASE_URL);

const prisma = new PrismaClient();

// E-mail próprio, e não o demo@ do prisma/seed.ts: os dois seeds coexistem no
// mesmo banco, e reusar o endereço faria um apagar a conta do outro sem aviso.
const EMAIL = "carteira@portfoliolab.dev";
const SENHA = "demo123456";

/**
 * CARTEIRA DE DEMONSTRAÇÃO — o que é real aqui e o que não é
 *
 * Os TICKERS são reais e a escolha deles é pública e verificável:
 *
 *  - As ações são as que a imprensa financeira atribui à carteira de Luiz
 *    Barsi (Money Times, Seu Dinheiro, XP): banco, papel e celulose,
 *    transmissão de energia e saneamento — setores perenes, foco em dividendo.
 *  - Os FII são os de maior liquidez do IFIX, entre os mais negociados da B3.
 *    MXRF11 entra também porque `relatorios-para-teste/` tem PDFs reais dele,
 *    o que deixa o módulo de IA testável com esta mesma conta.
 *
 * As QUANTIDADES, DATAS e PREÇOS de compra são inventados. Ninguém publica a
 * posição de outra pessoa, e apresentar número inventado como se fosse de
 * alguém real seria falso. O que existe de real é a lista de ativos; o resto é
 * massa de teste desenhada para exercitar o produto:
 *
 *  - compras espalhadas de 2024 a 2026, para o preço médio ter história
 *  - uma venda parcial, para conferir que a VENDA não mexe no preço médio
 *  - metas somando exatamente 100%, para a simulação de aporte fechar
 *
 * Nada aqui é recomendação de investimento.
 */
type Compra = { em: string; qtd: number; preco: number; taxa?: number };
type AtivoDemo = {
  ticker: string;
  meta: number;
  compras: Compra[];
  vendas?: Compra[];
  /** usado só se o Yahoo não responder no momento do seed */
  precoFallback: number;
};

const CARTEIRA: AtivoDemo[] = [
  // ── Ações — 55% ────────────────────────────────────────────────────────
  {
    ticker: "BBAS3",
    meta: 12,
    precoFallback: 24.5,
    compras: [
      { em: "2024-07-12", qtd: 300, preco: 26.4, taxa: 4.9 },
      { em: "2025-03-20", qtd: 200, preco: 22.1, taxa: 4.9 },
      { em: "2026-02-10", qtd: 150, preco: 25.8, taxa: 4.9 },
    ],
  },
  {
    ticker: "KLBN4",
    meta: 8,
    precoFallback: 4.2,
    compras: [
      { em: "2024-09-05", qtd: 1500, preco: 4.55, taxa: 4.9 },
      { em: "2025-11-18", qtd: 1000, preco: 3.98, taxa: 4.9 },
    ],
  },
  {
    ticker: "TAEE11",
    meta: 10,
    precoFallback: 36.0,
    compras: [
      { em: "2024-06-18", qtd: 200, preco: 34.2, taxa: 4.9 },
      { em: "2025-08-22", qtd: 150, preco: 35.9, taxa: 4.9 },
    ],
  },
  {
    ticker: "BRSR6",
    meta: 5,
    precoFallback: 12.0,
    compras: [{ em: "2025-01-15", qtd: 500, preco: 11.4, taxa: 4.9 }],
  },
  {
    ticker: "SANB11",
    meta: 6,
    precoFallback: 28.0,
    // A venda parcial existe para o teste ficar interessante: pela regra da
    // Receita ela reduz a quantidade e NÃO altera o preço médio.
    compras: [
      { em: "2024-10-30", qtd: 300, preco: 26.7, taxa: 4.9 },
      { em: "2025-06-12", qtd: 100, preco: 29.4, taxa: 4.9 },
    ],
    vendas: [{ em: "2026-01-20", qtd: 120, preco: 31.2, taxa: 4.9 }],
  },
  {
    ticker: "AURE3",
    meta: 5,
    precoFallback: 11.5,
    compras: [{ em: "2025-04-08", qtd: 600, preco: 10.9, taxa: 4.9 }],
  },
  {
    ticker: "CMIG4",
    meta: 5,
    precoFallback: 11.0,
    compras: [{ em: "2025-09-25", qtd: 700, preco: 10.6, taxa: 4.9 }],
  },
  {
    ticker: "UNIP6",
    meta: 4,
    precoFallback: 62.0,
    compras: [{ em: "2024-12-03", qtd: 90, preco: 68.5, taxa: 4.9 }],
  },

  // ── FII — 45% ──────────────────────────────────────────────────────────
  {
    ticker: "MXRF11",
    meta: 10,
    precoFallback: 10.3,
    compras: [
      { em: "2024-08-14", qtd: 900, preco: 10.6, taxa: 3.5 },
      { em: "2025-05-16", qtd: 600, preco: 9.95, taxa: 3.5 },
      { em: "2026-03-12", qtd: 400, preco: 10.15, taxa: 3.5 },
    ],
  },
  {
    ticker: "HGLG11",
    meta: 10,
    precoFallback: 152.0,
    compras: [
      { em: "2024-11-21", qtd: 60, preco: 148.3, taxa: 3.5 },
      { em: "2025-10-09", qtd: 40, preco: 156.7, taxa: 3.5 },
    ],
  },
  {
    ticker: "KNRI11",
    meta: 9,
    precoFallback: 148.0,
    compras: [{ em: "2025-02-27", qtd: 80, preco: 143.2, taxa: 3.5 }],
  },
  {
    ticker: "XPML11",
    meta: 8,
    precoFallback: 105.0,
    compras: [
      { em: "2025-07-03", qtd: 70, preco: 101.8, taxa: 3.5 },
      { em: "2026-04-22", qtd: 40, preco: 108.4, taxa: 3.5 },
    ],
  },
  {
    ticker: "VISC11",
    meta: 8,
    precoFallback: 98.0,
    compras: [{ em: "2025-12-11", qtd: 90, preco: 95.6, taxa: 3.5 }],
  },
];

async function main() {
  const somaMetas = CARTEIRA.reduce((s, a) => s + a.meta, 0);
  if (somaMetas !== 100) {
    throw new Error(`As metas somam ${somaMetas}%, e a soma precisa fechar em 100%.`);
  }

  // onDelete: Cascade (achado 9) leva transações, metas, proventos e
  // relatórios junto — por isso apagar o usuário basta para recomeçar limpo.
  await prisma.user.deleteMany({ where: { email: EMAIL } });

  const user = await prisma.user.create({
    data: {
      name: "Carteira de Demonstração",
      email: EMAIL,
      passwordHash: await bcrypt.hash(SENHA, 10),
    },
  });

  let comCotacaoReal = 0;
  const semCotacao: string[] = [];

  for (const ativo of CARTEIRA) {
    // buscarOuCadastrar é a mesma porta que transactions, goals e dividends
    // usam: cadastra o ativo a partir da cotação real da B3 se ele não existir.
    let asset = await quotesService.buscarOuCadastrar(ativo.ticker);

    if (asset) {
      comCotacaoReal += 1;
    } else {
      // Yahoo fora do ar ou ticker recusado: o seed não pode depender de rede,
      // então cria o ativo com o preço de referência embutido.
      semCotacao.push(ativo.ticker);
      asset = await prisma.asset.create({
        data: {
          ticker: ativo.ticker,
          name: ativo.ticker,
          type: ativo.ticker.endsWith("11") ? "FII" : "ACAO",
          currentPrice: ativo.precoFallback,
        },
      });
    }

    const lancamentos = [
      ...ativo.compras.map((c) => ({ ...c, kind: TransactionKind.COMPRA })),
      ...(ativo.vendas ?? []).map((v) => ({ ...v, kind: TransactionKind.VENDA })),
    ];

    for (const l of lancamentos) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          assetId: asset.id,
          kind: l.kind,
          quantity: l.qtd,
          unitPrice: l.preco,
          fee: l.taxa ?? 0,
          executedAt: new Date(l.em),
        },
      });
    }

    await prisma.assetGoal.create({
      data: { userId: user.id, assetId: asset.id, targetWeight: ativo.meta },
    });
  }

  const transacoes = await prisma.transaction.count({ where: { userId: user.id } });

  console.log(`\nConta de demonstração criada.`);
  console.log(`  e-mail ......... ${EMAIL}`);
  console.log(`  senha .......... ${SENHA}`);
  console.log(`  ativos ......... ${CARTEIRA.length} (${comCotacaoReal} com cotação real da B3)`);
  console.log(`  transações ..... ${transacoes}`);
  console.log(`  metas .......... somam ${somaMetas}%`);
  if (semCotacao.length > 0) {
    console.log(`\n  Sem cotação da B3, criados com preço de referência: ${semCotacao.join(", ")}`);
    console.log(`  Rode de novo com a rede disponível para corrigir os preços.`);
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
