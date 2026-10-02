-- O modelo AssetIndicator existia em schema.prisma e era usado por
-- indicators.repository.ts, mas nenhuma migration o criava: a tabela tinha
-- entrado nos bancos por um `prisma db push` avulso. Quem rodasse
-- `migrate deploy` num banco novo — foi o caso do Supabase — ficava sem ela,
-- e a tela de Indicadores quebrava com P2021 (tabela não existe).
--
-- SQL gerado por `prisma migrate diff` contra o schema, não escrito à mão.

-- CreateTable
CREATE TABLE "asset_indicators" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "pl" DECIMAL(10,2),
    "pvp" DECIMAL(10,2),
    "dividend_yield" DECIMAL(7,2),
    "roe" DECIMAL(7,2),
    "roa" DECIMAL(7,2),
    "margem_liquida" DECIMAL(7,2),
    "industria" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_indicators_asset_id_key" ON "asset_indicators"("asset_id");

-- AddForeignKey
ALTER TABLE "asset_indicators" ADD CONSTRAINT "asset_indicators_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
