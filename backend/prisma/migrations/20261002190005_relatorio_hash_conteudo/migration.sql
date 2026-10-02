-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "content_hash" TEXT;

-- CreateIndex
CREATE INDEX "reports_content_hash_idx" ON "reports"("content_hash");
