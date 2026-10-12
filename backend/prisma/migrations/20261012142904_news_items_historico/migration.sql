-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_items_url_key" ON "news_items"("url");

-- CreateIndex
CREATE INDEX "news_items_published_at_idx" ON "news_items"("published_at");

-- Row Level Security: o Supabase expõe as tabelas do schema public pela Data API (PostgREST).
-- Com RLS ligado e nenhuma policy, os papéis anon e authenticated não leem nem escrevem nada.
-- O backend conecta como dono da tabela, que ignora o RLS, então nada muda para a aplicação.
ALTER TABLE "news_items" ENABLE ROW LEVEL SECURITY;
