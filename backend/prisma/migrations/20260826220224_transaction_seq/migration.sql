-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "seq" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "transactions_user_id_asset_id_executed_at_seq_idx" ON "transactions"("user_id", "asset_id", "executed_at", "seq");
