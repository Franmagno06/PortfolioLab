# PortfolioLab

Monorepo: `backend/` (Node + Express 5 + Prisma + PostgreSQL) e `frontend/` (Next 16 App Router).
Domínio: carteira de investimentos da B3 — posição consolidada, rebalanceamento por aporte,
análise de relatórios em PDF por IA e feed de notícias.

## ⚠️ O `.env` aponta para o Supabase de PRODUÇÃO

`backend/.env` tem a `DATABASE_URL` do banco real. Antes de qualquer comando que escreva no
schema ou apague dados, troque o `DATABASE_URL` para o Postgres local do `docker-compose.yml`.

Nunca rode sem confirmar o banco de destino:

- `npm run db:seed` — `prisma/seed.ts:29-33` faz `deleteMany()` em **todas** as tabelas
- `npx prisma migrate reset`
- `npx prisma db push`

Os testes de integração (`auth`, `portfolio.api`, `rebalance.api`, `news`) usam o `prisma` real
e herdam essa mesma `DATABASE_URL`. Use a skill `rodar-testes-seguro` antes de `npm test`.

## Comandos

```bash
cd backend
npm run dev            # API em http://localhost:3333
npm test               # vitest (ver aviso acima)
npx tsc --noEmit       # typecheck — deve passar limpo
npx prisma validate    # valida o schema sem tocar no banco

cd frontend
npm run dev            # http://localhost:3000, faz proxy de /api/* para o backend
npm run lint
npx tsc --noEmit       # não há script; rode direto
```

Backend e frontend precisam estar no ar juntos: o Next reescreve `/api/*` para o backend
(`next.config.ts`), o que mantém tudo na mesma origem e faz o cookie `SameSite=Strict` funcionar.

## Arquitetura — a regra de ouro

As dependências apontam **só para baixo**:

```
Routes → Controller → Service → Repository → Prisma
```

- Controller nunca importa Prisma. Valida a entrada com Zod (`*.schemas.ts`) e formata a resposta.
- **Service nunca vê `req`/`res`** — é regra de negócio pura, testável sem servidor.
- **Repository é o único lugar que fala com Prisma.** Sem regra de negócio dentro dele.
- Um módulo = uma pasta em `src/modules/` com os cinco arquivos:
  `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schemas.ts`.
  Use `src/modules/auth/` como referência canônica.

Erros esperados: `throw new AppError("mensagem", status)`. O Express 5 encaminha erros de rotas
async sozinho — controllers **não** levam try/catch. O `errorHandler` (`shared/middlewares/`)
é registrado por último no `app.ts` e trata `AppError`, `ZodError`, `MulterError`,
`PrismaClientInitializationError` e o resto como 500 genérico.

## Convenções

- **Dinheiro é sempre `Prisma.Decimal`, nunca `number`.** Ponto flutuante binário erra centavos.
  A conversão para `number` acontece só na fronteira HTTP, via `em2Casas()`.
- **Preço médio segue a regra da Receita Federal**: COMPRA recalcula o PM incluindo a taxa;
  VENDA reduz a quantidade e **não altera o PM**. Ver `portfolio.service.ts:calcularPosicao`.
- **A posição da carteira é derivada das transações**, nunca armazenada. Fonte única de verdade.
- Banco em `snake_case` via `@map`/`@@map`; código em `camelCase`.
- Domínio em português (`calcularAporte`, `precoMedio`, `quantidade`), Prisma/schema em inglês
  (`unitPrice`, `targetWeight`, `executedAt`). Não misture dentro do mesmo identificador.
- ESM com `moduleResolution: NodeNext` — **imports relativos levam `.js`**, mesmo apontando
  para arquivos `.ts`.
- `noUncheckedIndexedAccess` está ligado: acesso por índice devolve `T | undefined`.

## Frontend

`frontend/AGENTS.md` avisa: este Next 16 tem breaking changes em relação ao que o modelo
memorizou. Antes de escrever código de framework, consulte `node_modules/next/dist/docs/`.
Em particular, a proteção de rota vive em `src/proxy.ts` (ex-`middleware.ts`).

Todo acesso à API passa por `src/lib/api.ts` (`api()` e `apiUpload()`), que lança `ApiError`
com a mensagem vinda do backend. Formatação de número/moeda só em `src/lib/format.ts`.

## Integrações externas

| Serviço | Onde | Comportamento na falha |
|---------|------|------------------------|
| Yahoo Finance (cotações B3) | `modules/quotes/quotes.provider.ts` | devolve `null`; mantém o último preço conhecido |
| Google Gemini (análise de PDF) | `modules/reports/gemini.ts` | sem `GEMINI_API_KEY` → 503 com instrução |
| RSS Money Times / Suno | `modules/news/rss.ts` | feed fora do ar → lista vazia daquela fonte |

Nenhuma delas pode derrubar uma rota. Ao mexer nesses módulos, preserve o tratamento defensivo.
