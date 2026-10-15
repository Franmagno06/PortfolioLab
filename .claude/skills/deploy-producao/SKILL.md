---
name: deploy-producao
description: Checklist de publicação em produção (Render para a API, Vercel/front, Supabase para o banco) na ordem certa — migration antes do push, sem segredos no commit, sem escrita no Supabase sem pedido explícito. Use antes de `git push` para a main, antes de `npm run supabase:migrate`, quando uma branch contém migration nova, ou quando o usuário falar em "subir", "publicar", "deploy" ou "produção".
---

# Publicar sem derrubar a produção

Aqui o push para a `main` **já é o deploy** (o Render publica sozinho), mas a migration do
Supabase é manual. A ordem errada derruba a API: código novo contra banco sem a coluna dá `P2022`
em toda leitura que passa pelo model alterado (aconteceu com `divida_ebitda`).

## Passo 0 — Segredos: bloqueia o push se falhar

```bash
git ls-files | grep -E "(^|/)\.env"          # só .env.example pode aparecer
git diff origin/main --stat -- '*.env*'
```

`backend/.env.supabase` tem a URL do banco de produção, `JWT_SECRET` e `GEMINI_API_KEY`. Se ele
aparecer como rastreado, **pare**: não dê push. Um push publica o arquivo (pode ser cacheado e
indexado mesmo apagado depois). Peça ao usuário para decidir entre reescrever os commits locais
ainda não enviados e rotacionar as chaves; não faça nenhum dos dois sozinho, é irreversível.
O `.gitignore` deve ter `.env.*` ignorando tudo menos `.env.example`.

## Passo 1 — A mudança tem migration?

```bash
git diff origin/main --name-only -- backend/prisma
```

- **Não tem:** vá para o passo 3.
- **Tem:** a migration só pode ser aplicada na produção **com pedido explícito do dono do banco**.
  Mostre o SQL (`backend/prisma/migrations/<pasta>/migration.sql`) e classifique:
  - só `ADD COLUMN` nulo / `CREATE TABLE` / `CREATE INDEX`: aditiva, segura antes do código novo;
  - `DROP`, `RENAME`, `ALTER TYPE`, `NOT NULL` sem default, `UPDATE`/`DELETE` em massa: altera
    dados ou quebra o código **antigo** que ainda está no ar. Exige expand/contract e é caso de
    modelo Fable. Pare e planeje antes.

## Passo 2 — Ordem

1. Teste a migration no Docker: `npm run db:local` e depois `rodar-testes-seguro`.
2. Confirme o destino: `npm run supabase:migrate` lê `.env.supabase` e **escreve em produção**.
3. Com pedido explícito, rode `npm run supabase:migrate`. Confira com `npx prisma migrate status`
   usando o mesmo `--env-file`.
4. **Só então** `git push` da `main`.

Nunca use `db:seed`, `migrate reset` ou `db push` contra o Supabase (`seed.ts` faz `deleteMany`
em todas as tabelas).

## Passo 3 — Antes do push

- `rodar-testes-seguro` completo e verde (inclui build do front).
- CI (`.github/workflows/ci.yml`) roda `prisma migrate deploy` num Postgres limpo: uma migration que
  só funciona no seu banco local sujo falha lá. Rode do zero com `npm run db:local:reset`.
- Variável de ambiente nova? Ela precisa existir no Render/Vercel **antes** do deploy. Sem
  `GEMINI_API_KEY` a rota devolve 503 por desenho, mas `JWT_SECRET` ou `DATABASE_URL` ausentes
  derrubam o boot.
- Mudou o DTO de `/ativos`? O front lê direto de `API_URL`; publique a API antes do front.

## Passo 4 — Depois do push

Acompanhe o deploy do Render (`mcp__claude_ai_Render__list_deploys`, `list_logs`, só leitura) e o
log de subida: ele imprime `🗄️ Banco: SUPABASE (produção)`. Se aparecer `P2022`/`P2021`, a migration
não foi aplicada: aplique (com pedido) em vez de fazer rollback de código.

## O que relatar

Diga o que foi verificado e o que **não** foi (ex.: "migration não aplicada, aguardando seu OK").
Nunca declare "em produção" sem ter visto o deploy concluído.
