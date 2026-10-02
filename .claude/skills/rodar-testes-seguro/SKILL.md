---
name: rodar-testes-seguro
description: Bateria de verificação do projeto (typecheck, lint, testes do backend e do frontend, build e E2E) rodando contra o Postgres do Docker, nunca o Supabase de produção. Use SEMPRE ao terminar uma funcionalidade ou correção, antes de commit de fechamento ou merge para main, e antes de qualquer `npm test`, `vitest`, `playwright`, `prisma db seed` ou `prisma migrate`.
---

# Verificar uma mudança sem tocar na produção

## Quando usar

- **Ao terminar qualquer funcionalidade ou correção**, antes de dizer que acabou. É o passo 4
  do fluxo de branches do `CLAUDE.md`. Chame sem esperar o usuário pedir.
- Antes de rodar qualquer teste, seed ou migration isolado.

Quem roda é o Claude: execute a bateria inteira, corrija o que quebrar por causa da mudança e
só então declare a tarefa concluída. Falha não se esconde: relate com a saída do comando.

## Os dois bancos

| | Docker (local) | Supabase (produção) |
|---|---|---|
| Arquivo | `backend/.env` | `backend/.env.supabase` |
| Usado por | `npm run dev`, `db:local`, testes | só scripts `supabase:*` e o Render |
| Pode apagar | sim | **nunca** |

Os testes têm proteção própria, e ela não depende do `.env`:

- **Vitest do backend**: o `vitest.config.ts` carrega o `backend/.env.test`, que aponta para o
  Docker. O `vitest.globalSetup.ts` chama `assertDatabaseUrlIsLocal` e aborta a suíte se o
  destino não for local.
- **Playwright**: o `frontend/playwright.config.ts` sobe o próprio backend com a
  `DATABASE_URL` do Docker fixada e não reaproveita backend que já esteja no ar.
- **Seeds**: o `seed.ts`, que apaga **todas** as tabelas, recusa banco remoto sempre. O
  `seed-demo.ts` só aceita banco remoto com `--remoto` (`npm run supabase:demo`).

Mesmo assim, esses testes **escrevem no Docker**: todo `*.test.ts` que importa
`src/database/prisma.js` faz isso. Por isso o Postgres local precisa estar no ar e com o
schema em dia.

Nunca rode na bateria `npm run db:seed`, `prisma db push`, `prisma migrate reset` nem nenhum
script `supabase:*`.

## 1. Pré-voo (sempre)

```bash
docker info >/dev/null 2>&1 && echo "docker ok" || echo "DOCKER DESLIGADO"
```

Se o Docker estiver desligado, **pare** e peça ao usuário para abrir o Docker Desktop. Não
tente ligá-lo por conta própria.

```bash
cd backend && npm run db:local
```

O `db:local` primeiro confere que o `.env` é local (`scripts/garantir-banco-local.ts`). Depois
sobe o container com `--wait`, aplica as migrations pendentes com `migrate deploy` e recria a
conta demo. Pode rodar quantas vezes quiser.

- **Se ele abortar com "não é um banco local"**, o `backend/.env` ainda aponta para o
  Supabase. Isso não impede os testes, que usam o `.env.test`, mas impede o `db:local`.
  Rode o equivalente com a URL local só neste comando:
  `DATABASE_URL="postgresql://portfoliolab:portfoliolab@localhost:5432/portfoliolab" npm run db:local`.
  Avise o usuário que o `.env` dele ainda está apontando para a produção.
- **Se o `migrate deploy` falhar com "already exists" (P3018/42P07)**, o volume local tem
  tabelas criadas por um `db push` antigo. O banco é descartável: rode
  `npm run db:local:reset`.
- **Se o seed acusar coluna inexistente (P2022)**, o Prisma Client foi gerado a partir de
  outra branch. Rode `npx prisma generate`. Se ele der `EPERM`, há um `npm run dev` segurando
  a DLL do Prisma: peça ao usuário para pará-lo.

## 2. Backend

Rode a partir de `backend/`, nesta ordem:

```bash
npx prisma validate      # schema sintaticamente válido, não toca no banco
npx tsc --noEmit         # typecheck
npm test                 # vitest: regras puras + integração no Docker
```

Se a mudança mexeu em `prisma/schema.prisma`, confira também se existe migration para ela:

```bash
docker exec portfoliolab-db createdb -U portfoliolab shadow_check
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://portfoliolab:portfoliolab@localhost:5432/shadow_check" --exit-code
docker exec portfoliolab-db dropdb -U portfoliolab shadow_check
```

Precisa sair "No difference detected". Se aparecer diferença, crie a migration com
`npx prisma migrate dev --name <descricao>`. Esse comando é seguro **só** com o `.env` local:
confira antes com `npx tsx scripts/garantir-banco-local.ts`. Schema sem migration quebra o
`supabase:migrate` e o deploy.

## 3. Frontend

Rode a partir de `frontend/`, nesta ordem:

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # vitest com jsdom (unitários, não sobe servidor)
npm run build            # next build
```

**`build` × `dev`.** Se a porta 3000 estiver ocupada, o `next dev` do usuário está rodando, e
os dois disputam a pasta `.next` (o README registra o cache corrompido que isso causa). Não
mate o processo do usuário: pule o build e avise que ele ficou pendente.

```bash
netstat -ano | grep -q ":3000 .*LISTENING" && echo "3000 ocupada" || echo "3000 livre"
```

## 4. E2E com Playwright: só quando a mudança mexe em tela

Rode quando a mudança tocar em `frontend/src/` ou em rotas do backend que o frontend chama.
Pule se for só backend interno: service sem rota nova, script ou documentação.

```bash
cd frontend && npm run test:e2e
```

O config sobe um backend próprio na **porta 3333**, que precisa estar livre porque o
`reuseExistingServer` é `false`. Se a porta estiver ocupada, peça ao usuário para parar o
`npm run dev` do backend. O teste cria um usuário `playwright-<uuid>@portfoliolab.dev` no
Docker. Na primeira vez numa máquina, pode ser preciso rodar `npx playwright install chromium`.

## 5. Quando algo falha

1. **Descubra se a falha já existia.** Rode o mesmo comando no `main` com
   `git stash` + `git switch main`, ou num worktree. Se ela já falhava lá, a mudança não tem
   culpa: relate a falha ao usuário como pré-existente, com arquivo e linha, e não a corrija
   escondido dentro da funcionalidade.
2. **Se a falha veio da mudança**, corrija e rode de novo **o comando que falhou**. No fim,
   rode a bateria inteira mais uma vez.
3. **Teste de integração intermitente** (timeout ou conexão): confira com
   `docker compose ps` se o container continua `healthy` antes de mexer no código.

## 6. Relatório final

Ao usuário, em poucas linhas:

- Uma linha por comando: ✅ / ❌ / ⏭️ (pulado, com o motivo).
- Falhas pré-existentes, separadas das causadas pela mudança.
- Qualquer passo que ficou com ele: build pendente por causa do dev rodando, Docker
  desligado, `.env` ainda apontando para o Supabase.

## Depois

```bash
cd backend && npm run db:local:stop     # desliga o container e mantém os dados
cd backend && npm run db:local:reset    # recomeça do zero (apaga só o volume local)
```
