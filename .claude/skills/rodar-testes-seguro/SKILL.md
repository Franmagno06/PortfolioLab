---
name: rodar-testes-seguro
description: Roda a suíte de testes do backend contra um Postgres descartável em vez do Supabase de produção. Use SEMPRE antes de `npm test`, `vitest`, `prisma db seed` ou `prisma migrate` — quatro suítes de integração escrevem no banco apontado por DATABASE_URL, e o seed apaga todas as tabelas.
---

# Rodar os testes sem tocar na produção

## O risco concreto

`backend/.env` tem a `DATABASE_URL` do **Supabase de produção**. Quatro suítes
(`auth.test.ts`, `portfolio.api.test.ts`, `rebalance.api.test.ts`,
`news.test.ts`) importam o cliente Prisma real e criam usuários, transações e
metas nesse banco. Elas limpam o que criam no `afterAll`, mas um teste que
falha no meio deixa lixo — e `prisma/seed.ts` faz `deleteMany()` em **todas** as
tabelas antes de popular.

Rodar `npm test` ou `npm run db:seed` com o `.env` de produção carregado é
gravação direta no banco real.

## Procedimento

**1. Suba o Postgres local.** O `docker-compose.yml` já define o serviço:

```bash
cd backend
docker compose up -d
```

Confirme que subiu antes de seguir: `docker compose ps` deve mostrar
`portfoliolab-db` em estado `running`.

**2. Aponte a `DATABASE_URL` para o container — só nesta sessão de shell.**
Não edite `backend/.env`: uma variável exportada tem precedência sobre o
`dotenv`, e isso evita esquecer o arquivo alterado depois.

```bash
export DATABASE_URL="postgresql://portfoliolab:portfoliolab@localhost:5432/portfoliolab"
```

No PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://portfoliolab:portfoliolab@localhost:5432/portfoliolab"
```

**3. Confirme o destino antes de qualquer escrita.** Este passo não é opcional:

```bash
node -e "console.log(process.env.DATABASE_URL)"
```

A saída **precisa** conter `localhost`. Se aparecer `supabase.com` ou
`pooler.supabase.com`, pare — o export não pegou (shell diferente, ou o
`dotenv` do `config/env.ts` sobrescreveu). Não prossiga.

**4. Crie o schema no banco local.**

```bash
npx prisma db push
```

Só agora isso é seguro: o alvo é o container, não a nuvem.

**5. Rode.**

```bash
npm test
```

## Depois

```bash
docker compose down          # mantém o volume pgdata
docker compose down -v       # descarta também os dados
```

A variável exportada morre com o shell. Se você editou `backend/.env` em vez de
exportar (não recomendado), **reverta agora** — e confirme com `git diff` que
nada de `.env` ficou pendente.

## Se o passo 3 acusar Supabase

O `backend/src/config/env.ts` chama `dotenv/config`, que por padrão **não**
sobrescreve variáveis já presentes no ambiente. Então um `export` anterior ao
comando deveria vencer. Se não venceu, você provavelmente está em um shell
diferente do que rodou o `export` (a ferramenta Bash e a PowerShell deste
ambiente não compartilham estado). Rode o `export` e o `npm test` **no mesmo
comando**, encadeados com `&&`.

## Nota para o futuro

O caminho definitivo é um `.env.test` separado, carregado por
`vitest.config.ts`, para que a suíte nunca dependa de disciplina manual. Isso
está no relatório de auditoria como achado de severidade alta. Até lá, este
procedimento é o que separa a suíte do banco real.
