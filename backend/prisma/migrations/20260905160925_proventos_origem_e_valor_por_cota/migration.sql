-- CreateEnum
CREATE TYPE "DividendSource" AS ENUM ('MANUAL', 'PROVEDOR');

-- AlterTable
ALTER TABLE "dividends" ADD COLUMN     "source" "DividendSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "unit_amount" DECIMAL(12,6);

-- CreateIndex
CREATE UNIQUE INDEX "dividends_user_id_asset_id_paid_at_source_key" ON "dividends"("user_id", "asset_id", "paid_at", "source");

