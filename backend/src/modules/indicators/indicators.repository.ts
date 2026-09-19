import { prisma } from "../../database/prisma.js";

const DOZE_MESES_MS = 365 * 24 * 60 * 60 * 1000;

export const indicatorsRepository = {
  // Só ações têm os indicadores fundamentalistas que esta tela mostra — FII,
  // ETF e renda fixa não têm P/L, P/VP, ROE ou margem líquida no sentido
  // corporativo do termo.
  ativosAcaoDoUsuario(userId: string) {
    return prisma.asset.findMany({
      where: {
        type: "ACAO",
        transactions: { some: { userId } },
      },
      include: { indicator: true },
      orderBy: { ticker: "asc" },
    });
  },

  findAllAcao() {
    return prisma.asset.findMany({ where: { type: "ACAO" } });
  },

  /**
   * Soma os proventos por cota pagos nos últimos 12 meses, a partir do que o
   * módulo Proventos já importou — a fonte do Dividend Yield, não a de
   * cotação (ver o porquê em quotes.provider.ts). `distinct` em
   * paidAt+unitAmount porque o mesmo provento gera uma linha POR USUÁRIO que
   * sincronizou (amount total depende da posição de cada um); unitAmount é
   * o valor por cota anunciado pela empresa, igual para todo mundo na mesma
   * data-ex.
   */
  async somaProventosUltimos12Meses(assetId: string): Promise<number> {
    const desde = new Date(Date.now() - DOZE_MESES_MS);

    const proventos = await prisma.dividend.findMany({
      where: { assetId, source: "PROVEDOR", paidAt: { gte: desde }, unitAmount: { not: null } },
      distinct: ["paidAt", "unitAmount"],
      select: { unitAmount: true },
    });

    return proventos.reduce((soma, p) => soma + Number(p.unitAmount), 0);
  },

  upsert(
    assetId: string,
    data: {
      pl: number | null;
      pvp: number | null;
      dividendYield: number | null;
      roe: number | null;
      roa: number | null;
      margemLiquida: number | null;
      industria: string | null;
    },
  ) {
    return prisma.assetIndicator.upsert({
      where: { assetId },
      create: { assetId, ...data },
      update: data,
    });
  },
};
