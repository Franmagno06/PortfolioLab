-- OPCIONAL, SÓ NO SUPABASE DE PRODUÇÃO E SÓ COM O OK DO DONO DO BANCO. Não é migration do Prisma de
-- propósito: fica fora de prisma/migrations para não ir junto num `supabase:migrate`, e os papéis anon e
-- authenticated só existem no Supabase (no Docker e no CI eles não existem).
--
-- Por quê: hoje o RLS está ligado em todas as tabelas e não há policy nenhuma, então anon e authenticated
-- (os papéis da Data API do Supabase, usados por quem tem a chave pública do projeto) não leem nada. Mas
-- eles ainda têm SELECT/INSERT/... por GRANT, e só o RLS segura. Uma policy criada por engano, ou um
-- `DISABLE ROW LEVEL SECURITY`, voltaria a expor `users` (com os hashes de senha). Tirar os GRANTs é a
-- segunda tranca. O app não usa a Data API: o backend entra pelo Prisma com o papel dono das tabelas.
--
-- Como rodar (passo 7 de docs/deploy.md, "Passos que escrevem na produção"):
--
--   1. Conferência, só leitura. No SQL Editor do Supabase ou com o mesmo usuário da DATABASE_URL:
--
--        SELECT current_user,
--               r.rolsuper,
--               r.rolbypassrls,
--               (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') AS dono_de_users
--        FROM pg_roles r WHERE r.rolname = current_user;
--
--        SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
--        FROM information_schema.role_table_grants
--        WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
--        GROUP BY grantee, table_name ORDER BY grantee, table_name;
--
--      Siga só se o usuário da DATABASE_URL (no pooler, `postgres.<ref>` entra como `postgres`) for o dono
--      das tabelas (dono_de_users = current_user) ou tiver BYPASSRLS. Se for anon ou authenticated, PARE:
--      este script derrubaria a API.
--
--   2. Rodar este arquivo com o mesmo usuário da API, a partir de backend/:
--
--        node --env-file=.env.supabase node_modules/prisma/build/index.js db execute \
--          --file prisma/manual/revogar-grants-anon-authenticated.sql --schema prisma/schema.prisma
--
--      (Ou colar no SQL Editor do Supabase, que entra como `postgres`.)
--
--   3. Conferir: a segunda consulta do passo 1 deve voltar vazia, e `GET /health` da API continua 200.
--
-- Desfazer, se algum dia a Data API for usada: GRANT dos privilégios necessários, tabela por tabela, junto
-- com as policies de RLS daquela tabela. Nunca um GRANT ALL de volta.

BEGIN;

-- A mesma trava do passo 1, dentro da transação: aborta sem mudar nada se quem roda não é dono nem ignora o RLS.
DO $$
DECLARE
  dono text;
  ignora_rls boolean;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Abortado: este script roda como %, o próprio papel que ele restringe.', current_user;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Abortado: os papéis anon/authenticated não existem aqui. Este script é só para o Supabase.';
  END IF;

  SELECT tableowner INTO dono FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';
  SELECT rolsuper OR rolbypassrls INTO ignora_rls FROM pg_roles WHERE rolname = current_user;

  IF dono IS DISTINCT FROM current_user AND NOT coalesce(ignora_rls, false) THEN
    RAISE EXCEPTION 'Abortado: % não é dono de public.users (dono: %) nem tem BYPASSRLS.', current_user, dono;
  END IF;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Tabelas que as próximas migrations criarem (o dono delas é quem roda o `supabase:migrate`, o mesmo
-- usuário deste script) já nascem sem os GRANTs automáticos do Supabase para anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
