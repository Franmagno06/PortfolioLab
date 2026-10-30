-- CreateIndex
CREATE INDEX "asset_goals_asset_id_idx" ON "asset_goals"("asset_id");

-- CreateIndex
CREATE INDEX "reports_asset_id_idx" ON "reports"("asset_id");

-- CreateIndex
CREATE INDEX "dividends_asset_id_idx" ON "dividends"("asset_id");
