import { Asset, AssetType, PrismaClient, ReportSource, TransactionKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { assertDatabaseUrlIsLocal, descreverBanco } from "../src/config/dbGuard.js";
import { quotesService } from "../src/modules/quotes/quotes.service.js";
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
 *    MXRF11 entra também porque `relatorios-para-teste/` tem PDFs reais dele,
 *    o que deixa o módulo de IA testável com esta mesma conta.
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

  // Relatórios CVM pré-analisados para permitir ao visitante testar /relatorios de imediato
  const relatoriosDemo = [
    {
      ticker: "BBAS3",
      fileName: "BBAS3-Demonstracoes-Financeiras-1T26.pdf",
      period: "2026-T1",
      analysis: {
        tipoDocumento: "ITR — Informações Trimestrais (CVM)",
        resumoExecutivo: [
          "Lucro líquido ajustado atingiu R$ 9,3 bilhões no trimestre, mantendo rentabilidade consistente.",
          "Retorno sobre o patrimônio líquido (ROE) permaneceu em patamar elevado de 21,4%.",
          "Carteira de crédito ampliada continuou com forte participação do agronegócio e crédito consignado.",
          "Índice de inadimplência acima de 90 dias controlado em 2,8%, abaixo da média do Sistema Financeiro Nacional.",
          "Margem financeira bruta apresentou expansão refletindo reprecificação da carteira de crédito.",
        ],
        alertas: [
          {
            titulo: "Custo de captação e provisões (PDD)",
            severidade: "atencao",
            detalhe: "Despesas com provisão para créditos de liquidação duvidosa acompanham o ciclo de juros e expansão da carteira.",
          },
          {
            titulo: "Índice de Basileia confortável",
            severidade: "info",
            detalhe: "Capital principal e índice de Basileia situam-se com folga acima dos requerimentos mínimos regulatórios.",
          },
        ],
        indicadores: [
          { nome: "Receitas de Intermediação Financeira", valor: "R$ 48,20 bi (+12,5%)" },
          { nome: "Lucro líquido atribuído aos controladores", valor: "R$ 9,30 bi (+8,2%)" },
          { nome: "ROE", valor: "21,40%" },
          { nome: "Patrimônio Líquido", valor: "R$ 178,50 bi (+9,1%)" },
          { nome: "Ativo Total", valor: "R$ 2,20 tri" },
        ],
      },
    },
    {
      ticker: "TAEE11",
      fileName: "TAEE11-Release-Resultados-1T26.pdf",
      period: "2026-T1",
      analysis: {
        tipoDocumento: "ITR — Informações Trimestrais (CVM)",
        resumoExecutivo: [
          "Receita líquida IFRS refletiu a atualização monetária das concessões pela inflação (IPCA e IGP-M).",
          "EBITDA regulatório manteve margem elevada superior a 80%, característica da previsibilidade das transmissoras.",
          "Ciclo da RAP (Receita Anual Permitida) sem perdas materiais de disponibilidade de linhas.",
          "Endividamento com perfil alongado e custo médio atrelado a NTN-B / IPCA + spread.",
          "Manutenção da prática de distribuição de proventos intercalares conforme estatuto social.",
        ],
        alertas: [
          {
            titulo: "Alavancagem financeira (Dívida Líquida / EBITDA)",
            severidade: "atencao",
            detalhe: "Relação dívida líquida sobre EBITDA encerrou em 3,7x, exigindo monitoramento diante de novos investimentos.",
          },
          {
            titulo: "Vencimento de concessões nos próximos anos",
            severidade: "info",
            detalhe: "Lotes pioneiros entram no terço final de vigência da concessão contratual.",
          },
        ],
        indicadores: [
          { nome: "Receita Líquida", valor: "R$ 720,40 mi (+5,3%)" },
          { nome: "Lucro Líquido", valor: "R$ 385,20 mi (+4,1%)" },
          { nome: "Margem EBITDA Regulatório", valor: "83,50%" },
          { nome: "Dívida Líquida / EBITDA", valor: "3,70x" },
          { nome: "Patrimônio Líquido", valor: "R$ 7,12 bi" },
        ],
      },
    },
    {
      ticker: "MXRF11",
      fileName: "MXRF11-Informe-Mensal-2026-03.pdf",
      period: "2026-03",
      analysis: {
        tipoDocumento: "Informe Mensal Estruturado (CVM)",
        resumoExecutivo: [
          "Patrimônio líquido do fundo encerrou o período em R$ 3,25 bilhões, distribuído em mais de 1 milhão de cotistas.",
          "Alocação preponderante em Certificados de Recebíveis Imobiliários (CRI) com garantias reais e indexação ao CDI e IPCA.",
          "Rendimentos distribuídos em linha com a média histórica, proporcionando retorno isento a pessoas físicas.",
          "Inadimplência na carteira de crédito imobiliário mantida em zero, sem perdas de principal no período.",
          "Reserva de contingência acumulada para amortecimento de oscilações de inflação e deflação pontuais.",
        ],
        alertas: [
          {
            titulo: "Sensibilidade à curva de juros futura",
            severidade: "info",
            detalhe: "A parcela prefixada e atrelada a IPCA sofre marcação a mercado conforme abertura ou fechamento da curva de juros.",
          },
          {
            titulo: "Concentração em devedores e setores imobiliários",
            severidade: "info",
            detalhe: "Maior exposição individual representa menos de 7% do patrimônio líquido do fundo.",
          },
        ],
        indicadores: [
          { nome: "Patrimônio Líquido", valor: "R$ 3,25 bi (+0,8%)" },
          { nome: "Valor Patrimonial por Cota (VP)", valor: "R$ 9,85" },
          { nome: "Número de Cotistas", valor: "1.120.450" },
          { nome: "Dividend Yield Anualizado", valor: "12,40%" },
          { nome: "Ativo Total", valor: "R$ 3,31 bi" },
        ],
      },
    },
  ];

  for (const rel of relatoriosDemo) {
    const asset = assetsPorTicker.get(rel.ticker);
    if (!asset) continue;

    await prisma.cvmSummary.upsert({
      where: { assetId_period: { assetId: asset.id, period: rel.period } },
      create: { assetId: asset.id, period: rel.period, analysis: rel.analysis },
      update: { analysis: rel.analysis },
    });

    await prisma.report.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        fileName: rel.fileName,
        source: ReportSource.CVM,
        period: rel.period,
        extractedText: null,
        analysis: rel.analysis,
      },
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
