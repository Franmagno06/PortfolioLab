-- CreateEnum
CREATE TYPE "ReportSource" AS ENUM ('CVM', 'PDF');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "cnpj" TEXT;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "asset_id" TEXT,
ADD COLUMN     "period" TEXT,
ADD COLUMN     "source" "ReportSource" NOT NULL DEFAULT 'PDF',
ALTER COLUMN "extracted_text" DROP NOT NULL;

-- CreateTable
CREATE TABLE "cvm_summaries" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "analysis" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvm_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cvm_summaries_asset_id_period_key" ON "cvm_summaries"("asset_id", "period");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvm_summaries" ADD CONSTRAINT "cvm_summaries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

