---
name: deploy-producao
description: Checklist de publicação em produção (Render gratuito para a API, Vercel Hobby para o site, Supabase para o banco) na ordem certa — migration antes do push, sem segredos no commit, sem escrita no Supabase, no Render ou na Vercel sem pedido explícito. Use antes de `git push` para a main, antes de `npm run supabase:migrate`, quando uma branch contém migration nova, ou quando o usuário falar em "subir", "publicar", "deploy" ou "produção".
---

# Publicar sem derrubar a produção

Arranjo (plano completo em `docs/deploy.md`):

- **API**: Render, web service Node, plano **gratuito** (0,1 CPU, 512 MB, dorme após 15 min sem tráfego),
  descrito em `render.yaml`. Processo Express comum, sem Docker e sem serverless.
- **Site**: Vercel **Hobby**, Root Directory `frontend`, que reescreve `/api/*` para `API_URL`.
- **Banco**: Supabase `portfoliolab` (`sa-east-1`), pelo Session pooler (5432).
- Docker é só o Postgres do desenvolvimento local.

Depois do primeiro deploy, o push para a `main` **já é o deploy** (o Render publica a API se mudou algo em
`backend/`, a Vercel publica o site), mas a migration do Supabase é manual. A ordem errada derruba a API:
código novo contra banco sem a coluna dá `P2022` em toda leitura que passa pelo model alterado (aconteceu
com `divida_ebitda`).

## Passo 0 — Segredos: bloqueia o push se falhar

```bash
git ls-files | grep -E "(^|/)\.env"          # só .env.example e .env.supabase.example podem aparecer
git diff origin/main --stat -- '*.env*'
```

`backend/.env.supabase` tem a URL do banco de produção (com a senha) e o `JWT_SECRET`. Se ele aparecer como
rastreado, **pare**: não dê push. Um push publica o arquivo (pode ser cacheado e indexado mesmo apagado
depois). Peça ao usuário para decidir entre reescrever os commits locais ainda não enviados e rotacionar a
senha do banco e o segredo; não faça nenhum dos dois sozinho, é irreversível. O `.gitignore` deve ter
`.env.*` ignorando tudo menos os dois `.example`. Nunca imprima o conteúdo desses arquivos.

O `render.yaml` só pode ter nomes de variável, valores não secretos e `sync: false`/`generateValue: true`.

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
- SQL em `backend/prisma/manual/` **não** é migration: não vai no `supabase:migrate`, roda à mão e só com OK.

## Passo 2 — Ordem

1. Teste a migration no Docker: `npm run db:local` e depois `rodar-testes-seguro`.
2. Confirme o destino: `npm run supabase:migrate` lê `.env.supabase` e **escreve em produção**. Antes,
   `node --env-file=.env.supabase node_modules/prisma/build/index.js migrate status` (leitura) mostra o host
   e o que está pendente.
3. Com pedido explícito, rode `npm run supabase:migrate`. Confira com o mesmo `migrate status`.
4. **Só então** `git push` da `main`.

O plano gratuito do Render não tem `preDeployCommand`: a migration nunca roda no deploy.

Nunca use `db:seed`, `migrate reset` ou `db push` contra o Supabase (`seed.ts` faz `deleteMany`
em todas as tabelas).

## Passo 3 — Antes do push

- `rodar-testes-seguro` completo e verde (inclui build do front).
- CI (`.github/workflows/ci.yml`) roda `prisma migrate deploy` num Postgres limpo: uma migration que
  só funciona no seu banco local sujo falha lá. Rode do zero com `npm run db:local:reset`.
- Variável de ambiente nova? Ela precisa existir no Render/Vercel **antes** do deploy, e entrar no
  `render.yaml` (sem valor, se for segredo). `JWT_SECRET` curto ou `DATABASE_URL` ausente derrubam o boot.
- Mudou o DTO de `/ativos` ou `/indices`? O front lê direto de `API_URL`; publique a API antes do front.
- **Memória (512 MB).** Mexeu em `cvm.provider.ts`, nas filas da CVM, no aquecimento ou em algo que lê arquivo
  grande? Meça o pico de RSS (`process.resourceUsage().maxRSS`) com os zips reais antes de subir. A leitura
  inteira de um CSV da CVM em string chegou a 1,6 GB por ficha (`docs/deploy.md`, seção "Memória da leitura da CVM", já corrigido).
- Rota com login **nunca** manda `Cache-Control: public`: a CDN da Vercel respeita esse cabeçalho nos
  rewrites e serviria a resposta de uma pessoa para outra.

## Passo 4 — Depois do push

Acompanhe o deploy do Render (`mcp__claude_ai_Render__list_deploys`, `list_logs`, `get_metrics`, só
leitura) e o log de subida: ele imprime `🗄️ Banco: SUPABASE (produção) — aws-…pooler.supabase.com:5432/postgres`.
Se aparecer `P2022`/`P2021`, a migration não foi aplicada: aplique (com pedido) em vez de fazer rollback de
código. Confira `GET /health` (`{"status":"ok",...,"database":"ok"}`) e, nas métricas, a memória abaixo de
512 MB. Reinício repetido sem erro no log costuma ser falta de memória.

Criar serviço, variável, projeto ou deploy no Render ou na Vercel é escrita: só com pedido explícito, e com
o workspace/time que o dono confirmou (não escolha sozinho).

## O que relatar

Diga o que foi verificado e o que **não** foi (ex.: "migration não aplicada, aguardando seu OK").
Nunca declare "em produção" sem ter visto o deploy concluído.
