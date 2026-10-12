-- Renomeia a tabela de fotografias para os nomes em inglês que o schema usa (convenção do projeto:
-- domínio em português, schema em inglês). Só metadados: nenhum dado é copiado ou apagado, e o
-- RLS ligado na migration anterior continua valendo.

ALTER TYPE "SnapshotTipo" RENAME TO "SnapshotType";
ALTER TYPE "SnapshotType" RENAME VALUE 'CVM_RESULTADOS' TO 'CVM_RESULTS';
ALTER TYPE "SnapshotType" RENAME VALUE 'CVM_INFORME_FII' TO 'CVM_FUND_REPORT';
ALTER TYPE "SnapshotType" RENAME VALUE 'NOTICIAS' TO 'NEWS';

ALTER TABLE "asset_snapshots" RENAME COLUMN "tipo" TO "type";
ALTER TABLE "asset_snapshots" RENAME COLUMN "dados" TO "data";
ALTER TABLE "asset_snapshots" RENAME COLUMN "atualizado_em" TO "updated_at";

ALTER INDEX "asset_snapshots_asset_id_tipo_key" RENAME TO "asset_snapshots_asset_id_type_key";
