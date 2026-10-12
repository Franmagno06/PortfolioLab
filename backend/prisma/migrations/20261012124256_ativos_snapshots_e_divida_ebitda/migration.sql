-- CreateEnum
CREATE TYPE "SnapshotTipo" AS ENUM ('CVM_RESULTADOS', 'CVM_INFORME_FII', 'NOTICIAS');

-- AlterTable
ALTER TABLE "asset_indicators" ADD COLUMN     "divida_ebitda" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "asset_snapshots" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "tipo" "SnapshotTipo" NOT NULL,
    "dados" JSONB NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_snapshots_asset_id_tipo_key" ON "asset_snapshots"("asset_id", "tipo");

-- AddForeignKey
ALTER TABLE "asset_snapshots" ADD CONSTRAINT "asset_snapshots_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: o Supabase expõe as tabelas do schema public pela Data API (PostgREST).
-- Com RLS ligado e nenhuma policy, os papéis anon e authenticated não leem nem escrevem nada.
-- O backend conecta como dono da tabela, que ignora o RLS, então nada muda para a aplicação.
ALTER TABLE "asset_snapshots" ENABLE ROW LEVEL SECURITY;
