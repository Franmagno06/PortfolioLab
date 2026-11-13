import { prisma } from "../../database/prisma.js";

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
   * Os trimestres que a fotografia CVM_RESULTS das páginas de Ativos guarda (só existe para ação do
   * catálogo). Null se não há fotografia. O formato é conferido por quem usa: é jsonb.
   */
  async resultadosDaCvm(assetId: string): Promise<unknown> {
    const fotografia = await prisma.assetSnapshot.findUnique({
      where: { assetId_type: { assetId, type: "CVM_RESULTS" } },
      select: { data: true },
    });
    return fotografia?.data ?? null;
  },

  /**
   * Campo ausente (undefined) significa "não mexa no que está gravado": o Prisma ignora
   * campo undefined no update. É como o DY sobrevive a uma consulta de proventos que
   * falhou, sem virar null nem zero, e como a margem, a dívida/EBITDA e o setor do Yahoo
   * sobrevivem a uma renovação feita pela CVM, que não os calcula.
   */
  upsert(
    assetId: string,
    data: {
      pl: number | null;
      pvp: number | null;
      dividendYield?: number | null;
      roe: number | null;
      roa: number | null;
      margemLiquida?: number | null;
      dividaEbitda?: number | null;
      industria?: string | null;
    },
  ) {
    return prisma.assetIndicator.upsert({
      where: { assetId },
      create: { assetId, ...data },
      update: data,
    });
  },
};
