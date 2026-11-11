import { Asset, AssetType, PrismaClient, TransactionKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { assertDatabaseUrlIsLocal, descreverBanco } from "../src/config/dbGuard.js";
import { desconectarBanco } from "../src/database/prisma.js";
import { quotesService } from "../src/modules/quotes/quotes.service.js";
import { chaveDoPeriodo, parsearPeriodo, periodoAnterior } from "../src/modules/reports/periodo.js";
import { reportsService } from "../src/modules/reports/reports.service.js";
import { EMAIL_DA_DEMO } from "../src/shared/conta-demo.js";

// Este seed apaga e recria UMA conta (a de demonstração), não o banco inteiro
// como prisma/seed.ts. Por padrão só roda no banco local. No Supabase ele serve
// de vitrine para quem visita o app, mas só com --remoto (`npm run
// supabase:demo`): escrever em produção tem de ser uma decisão, não um acidente.
const REMOTO_PERMITIDO = process.argv.includes("--remoto");
if (!REMOTO_PERMITIDO) assertDatabaseUrlIsLocal(process.env.DATABASE_URL);
console.log(`Destino: ${descreverBanco(process.env.DATABASE_URL)}`);

const prisma = new PrismaClient();

// E-mail próprio, e não o demo@ do prisma/seed.ts: os dois seeds coexistem no
// mesmo banco, e reusar o endereço faria um apagar a conta do outro sem aviso.
// O endereço mora em src/shared/conta-demo.ts: o backend o usa para tratar a
// conta como somente leitura, e uma cópia aqui poderia divergir sem aviso.
const EMAIL = EMAIL_DA_DEMO;
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
 *    MXRF11 e HGLG11 também carregam relatórios (informe mensal da CVM), um de papel e um de tijolo.
 *  - Os ETF cobrem as três exposições que faltavam: bolsa brasileira (BOVA11),
 *    bolsa americana (IVVB11) e juro real (IMAB11).
 *
 * Sobre renda fixa: o Tesouro Direto NÃO entra, porque não existe. Título
 * público não é negociado em bolsa e não tem ticker — TESOURO, IPCA2035 e
 * NTNB2035 devolvem 404 na API de cotação. IMAB11 é o mais próximo que se
 * pode ter com preço real: um ETF que segue o IMA-B, a cesta de NTN-B
 * indexadas ao IPCA. Quem quiser Tesouro Direto de verdade na carteira
 * precisa lançar à mão, com o tipo RENDA_FIXA.
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
  /** Classe usada só no fallback; com rede, o provedor é quem classifica. */
  tipoFallback: AssetType;
  compras: Compra[];
  vendas?: Compra[];
  /** usado só se o Yahoo não responder no momento do seed */
  precoFallback: number;
};

const CARTEIRA: AtivoDemo[] = [
  // ── Ações — 45% ────────────────────────────────────────────────────────
  {
    ticker: "BBAS3",
    meta: 10,
    tipoFallback: AssetType.ACAO,
    precoFallback: 24.5,
    compras: [
      { em: "2024-07-12", qtd: 300, preco: 26.4, taxa: 4.9 },
      { em: "2025-03-20", qtd: 200, preco: 22.1, taxa: 4.9 },
      { em: "2026-02-10", qtd: 150, preco: 25.8, taxa: 4.9 },
    ],
  },
  {
    ticker: "KLBN4",
    meta: 6,
    tipoFallback: AssetType.ACAO,
    precoFallback: 4.2,
    compras: [
      { em: "2024-09-05", qtd: 1500, preco: 4.55, taxa: 4.9 },
      { em: "2025-11-18", qtd: 1000, preco: 3.98, taxa: 4.9 },
    ],
  },
  {
    ticker: "TAEE11",
    meta: 8,
    tipoFallback: AssetType.ACAO,
    precoFallback: 36.0,
    compras: [
      { em: "2024-06-18", qtd: 200, preco: 34.2, taxa: 4.9 },
      { em: "2025-08-22", qtd: 150, preco: 35.9, taxa: 4.9 },
    ],
  },
  {
    ticker: "BRSR6",
    meta: 4,
    tipoFallback: AssetType.ACAO,
    precoFallback: 12.0,
    compras: [{ em: "2025-01-15", qtd: 500, preco: 11.4, taxa: 4.9 }],
  },
  {
    ticker: "SANB11",
    meta: 5,
    tipoFallback: AssetType.ACAO,
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
    meta: 4,
    tipoFallback: AssetType.ACAO,
    precoFallback: 11.5,
    compras: [{ em: "2025-04-08", qtd: 600, preco: 10.9, taxa: 4.9 }],
  },
  {
    ticker: "CMIG4",
    meta: 4,
    tipoFallback: AssetType.ACAO,
    precoFallback: 11.0,
    compras: [{ em: "2025-09-25", qtd: 700, preco: 10.6, taxa: 4.9 }],
  },
  {
    ticker: "UNIP6",
    meta: 4,
    tipoFallback: AssetType.ACAO,
    precoFallback: 62.0,
    compras: [{ em: "2024-12-03", qtd: 90, preco: 68.5, taxa: 4.9 }],
  },

  // ── FII — 35% ──────────────────────────────────────────────────────────
  {
    ticker: "MXRF11",
    meta: 8,
    tipoFallback: AssetType.FII,
    precoFallback: 10.3,
    compras: [
      { em: "2024-08-14", qtd: 900, preco: 10.6, taxa: 3.5 },
      { em: "2025-05-16", qtd: 600, preco: 9.95, taxa: 3.5 },
      { em: "2026-03-12", qtd: 400, preco: 10.15, taxa: 3.5 },
    ],
  },
  {
    ticker: "HGLG11",
    meta: 8,
    tipoFallback: AssetType.FII,
    precoFallback: 152.0,
    compras: [
      { em: "2024-11-21", qtd: 60, preco: 148.3, taxa: 3.5 },
      { em: "2025-10-09", qtd: 40, preco: 156.7, taxa: 3.5 },
    ],
  },
  {
    ticker: "KNRI11",
    meta: 7,
    tipoFallback: AssetType.FII,
    precoFallback: 148.0,
    compras: [{ em: "2025-02-27", qtd: 80, preco: 143.2, taxa: 3.5 }],
  },
  {
    ticker: "XPML11",
    meta: 6,
    tipoFallback: AssetType.FII,
    precoFallback: 105.0,
    compras: [
      { em: "2025-07-03", qtd: 70, preco: 101.8, taxa: 3.5 },
      { em: "2026-04-22", qtd: 40, preco: 108.4, taxa: 3.5 },
    ],
  },
  {
    ticker: "VISC11",
    meta: 6,
    tipoFallback: AssetType.FII,
    precoFallback: 98.0,
    compras: [{ em: "2025-12-11", qtd: 90, preco: 95.6, taxa: 3.5 }],
  },

  // ── ETF — 20% ──────────────────────────────────────────────────────────
  {
    ticker: "BOVA11",
    meta: 8,
    tipoFallback: AssetType.ETF,
    precoFallback: 180.0,
    compras: [
      { em: "2024-08-28", qtd: 40, preco: 122.4, taxa: 4.9 },
      { em: "2025-09-15", qtd: 25, preco: 148.9, taxa: 4.9 },
    ],
  },
  {
    ticker: "IVVB11",
    meta: 7,
    tipoFallback: AssetType.ETF,
    precoFallback: 445.0,
    compras: [{ em: "2025-03-06", qtd: 25, preco: 358.2, taxa: 4.9 }],
  },
  {
    // O mais perto de Tesouro IPCA+ que a B3 negocia: ETF do IMA-B, a cesta
    // de NTN-B. Título público não tem ticker, então não há cotação para ele.
    ticker: "IMAB11",
    meta: 5,
    tipoFallback: AssetType.ETF,
    precoFallback: 115.0,
    compras: [{ em: "2025-06-19", qtd: 60, preco: 108.7, taxa: 4.9 }],
  },
];

/**
 * RELATÓRIOS DA DEMONSTRAÇÃO: os mesmos que qualquer conta obtém em /relatorios.
 *
 * A conta de demonstração é somente leitura, então o visitante não consegue consultar a CVM por ela:
 * o que ele vê é o que este seed deixou. Por isso os relatórios passam pelo MESMO caminho da rota
 * (reportsService.consultar), com os números que a CVM publica. Nenhum texto ou número de relatório
 * é escrito aqui: uma análise inventada com o rótulo "CVM" ensinaria errado e, pior, ia parar no
 * cache compartilhado (cvm_summaries), de onde seria servida às contas de verdade.
 *
 * Para cada ativo: o período mais recente que a CVM já tem e os anteriores, até `PERIODOS_POR_ATIVO`,
 * para a tela ter o que comparar. Sem rede, ou com a CVM fora do ar, a conta fica sem relatórios e o
 * seed segue: relatório é vitrine, não pode impedir a carteira de existir.
 */
const ATIVOS_COM_RELATORIO = ["BBAS3", "TAEE11", "CMIG4", "MXRF11", "HGLG11"];
const PERIODOS_POR_ATIVO = 3;

async function carregarRelatorios(userId: string): Promise<{ carregados: number; semDados: string[] }> {
  let carregados = 0;
  const semDados: string[] = [];

  for (const ticker of ATIVOS_COM_RELATORIO) {
    try {
      const maisRecente = await reportsService.consultar(userId, { ticker });
      let periodo = parsearPeriodo(maisRecente.relatorio.period);
      const anteriores: string[] = [];
      while (periodo && anteriores.length < PERIODOS_POR_ATIVO - 1) {
        periodo = periodoAnterior(periodo);
        anteriores.push(chaveDoPeriodo(periodo));
      }
      carregados += 1;
      for (const chave of anteriores) {
        await reportsService.consultar(userId, { ticker, periodo: chave });
        carregados += 1;
      }
    } catch (err) {
      // 404 da CVM para um período antigo, ou a CVM fora do ar: fica o que já foi carregado
      semDados.push(`${ticker} (${err instanceof Error ? err.message : "falha"})`);
    }
  }
  return { carregados, semDados };
}

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
  const assetsPorTicker = new Map<string, Asset>();
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
          // o sufixo 11 não distingue FII de ETF (MXRF11 e BOVA11 terminam
          // igual), então a classe vem declarada em cada ativo
          type: ativo.tipoFallback,
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

    assetsPorTicker.set(ativo.ticker, asset);
  }

  const relatorios = await carregarRelatorios(user.id);

  const transacoes = await prisma.transaction.count({ where: { userId: user.id } });

  console.log(`\nConta de demonstração criada.`);
  console.log(`  e-mail ......... ${EMAIL}`);
  console.log(`  senha .......... ${SENHA}`);
  console.log(`  ativos ......... ${CARTEIRA.length} (${comCotacaoReal} com cotação real da B3)`);
  console.log(`  transações ..... ${transacoes}`);
  console.log(`  metas .......... somam ${somaMetas}%`);
  console.log(`  relatórios ..... ${relatorios.carregados} (demonstrações reais da CVM)`);
  if (relatorios.semDados.length > 0) {
    console.log(`
  Relatórios que a CVM não entregou agora: ${relatorios.semDados.join("; ")}`);
    console.log(`  Rode de novo mais tarde para completar.`);
  }
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
  // dois clientes: o deste seed e o do app, que reportsService e quotesService usam
  .finally(() => Promise.all([prisma.$disconnect(), desconectarBanco()]));
