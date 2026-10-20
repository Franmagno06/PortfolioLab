-- Row Level Security em todas as tabelas do schema public que ainda não o tinham.
--
-- O Supabase expõe o schema public pela Data API (PostgREST). Sem RLS, quem tivesse a chave anon do
-- projeto leria e alteraria qualquer linha, inclusive os hashes de senha de `users`. As migrations
-- de `asset_snapshots` e `news_items` já ligavam o RLS; as tabelas anteriores a elas, a
-- `asset_indicators` e a `index_points` tinham ficado de fora.
--
-- Com RLS ligado e nenhuma policy, os papéis anon e authenticated não leem nem escrevem nada. O
-- backend conecta como dono das tabelas (`postgres` no Supabase, `portfoliolab` no Docker), e o dono
-- ignora o RLS enquanto ele não for FORCE, então nada muda para a aplicação nem para o Prisma.
--
-- Só metadados: nenhum dado é copiado, alterado ou apagado. Rodar de novo sobre uma tabela que já
-- tem RLS não faz nada.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dividends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cvm_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_indicators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "index_points" ENABLE ROW LEVEL SECURITY;
-- IF EXISTS: o banco-sombra do `prisma migrate dev`/`migrate diff` reaplica as migrations sem criar a
-- tabela de controle do Prisma. Sem o IF EXISTS esta linha quebraria o migrate dev de todo mundo.
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
