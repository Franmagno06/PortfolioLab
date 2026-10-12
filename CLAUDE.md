# PortfolioLab

Monorepo: `backend/` (Node + Express 5 + Prisma + PostgreSQL) e `frontend/` (Next 16 App Router).
Domínio: carteira de investimentos da B3 — posição consolidada, rebalanceamento por aporte,
análise de relatórios em PDF por IA e feed de notícias.

## ⚠️ Dois bancos: Docker (dia a dia) e Supabase (PRODUÇÃO)

- `backend/.env` → Postgres local do `docker-compose.yml`. É o que `npm run dev` usa.
- `backend/.env.supabase` → Supabase de produção. Só os scripts com `supabase` no nome o leem
  (`supabase:migrate`, `supabase:demo`, `supabase:studio`, `dev:supabase`), via `--env-file`,
  que tem precedência sobre o `.env`.
- `backend/.env.test` → Docker, carregado pelo `vitest.config.ts`.

A API imprime `🗄️ Banco: LOCAL…` ou `SUPABASE (produção)…` ao subir. Máquinas antigas podem
ainda ter a URL do Supabase no `.env` — confira antes de escrever, com
`npx tsx scripts/garantir-banco-local.ts`. `npm run db:local` sobe o container, aplica as
migrations e cria a conta demo, e recusa rodar se o `.env` não for local.

Nunca rode sem confirmar o banco de destino:

- `npm run db:seed` — `prisma/seed.ts:29-33` faz `deleteMany()` em **todas** as tabelas
- `npx prisma migrate reset`
- `npx prisma db push`

**Todo teste que importa `src/database/prisma.js` escreve no banco apontado pela `DATABASE_URL`**
— hoje são onze arquivos, entre eles todos os `*.api.test.ts`, `auth.test.ts`, `news.test.ts` e
`src/database/integridade.test.ts`. Confira com:

```bash
grep -rl "database/prisma" backend/src --include=*.test.ts
```

Use a skill `rodar-testes-seguro` antes de `npm test`. Testes de regra pura (`calcularPosicao`,
`calcularAporte`, a cota de relatórios) não tocam o banco e não dependem disso.

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

Use a skill `frontend-design`e `web-design-guidelines` sempre que a tarefa envolver possível melhoria de layout — tela
nova, redesign de página existente, padronização das interfaces existentes, ou qualquer pedido de deixar a interface mais moderna ou
mais fácil de entender. Carregue a skill antes de escrever o JSX, não depois.

## Backend

Use a skill `novo-modulo-backend` ao criar um módulo novo em `src/modules/` — ela gera os cinco
arquivos no padrão de `auth` e já inclui teste. Use `prisma-client-api` como referência ao
escrever queries (filtros, operadores, `$transaction`).

Para revisão e correção, use antes de fechar a mudança:
- `auditar-calculo-financeiro` — confere as invariantes de dinheiro (Decimal, taxa nos dois
  sentidos, fonte única de preço, divisão protegida) em qualquer diff que toque
  portfolio/rebalance/transactions/dividends/goals/quotes.
- `security-and-hardening` — checklist de hardening (injeção, auth, upload, CORS, SSRF, segredos)
  para módulos novos ou que mexem em autenticação, upload ou integração externa.
- `security-review` — revisão de segurança do **diff atual** de uma branch/PR (precisa de commits
  para comparar contra `origin/main`; não serve para auditar o repositório inteiro de uma vez).
- `supabase-postgres-best-practices` — RLS, índices, tipos de coluna, migrations e connection
  pooling, ao mexer no `schema.prisma`, em migrations, ou na configuração do Supabase de produção.

## Integrações externas

| Serviço | Onde | Comportamento na falha |
|---------|------|------------------------|
| Yahoo Finance (cotações B3) | `modules/quotes/quotes.provider.ts` | devolve `null`; mantém o último preço conhecido |
| Google Gemini (análise de PDF) | `modules/reports/gemini.ts` | sem `GEMINI_API_KEY` → 503 com instrução |
| RSS Money Times / Suno | `modules/news/rss.ts` | feed fora do ar → lista vazia daquela fonte |
| CVM dados abertos (ITR, DFP, Informe Mensal de FII) | `modules/reports/cvm.provider.ts` | devolve `null`; o relatório cai na leitura do PDF inteiro |

Relatórios com ativo informado usam a CVM: o PDF só identifica o período (`reports/periodo.ts`),
os números vêm da CVM e a IA escreve o resumo sobre eles. Esses relatórios não guardam o texto
do PDF, então `POST /reports/:id/ask` responde 409. A tabela ticker → CNPJ
(`modules/assets/tabela-cnpj.json`) é fixa e se regenera com `npx tsx scripts/gerar-tabela-cnpj.ts`.

Nenhuma delas pode derrubar uma rota. Ao mexer nesses módulos, preserve o tratamento defensivo.

## Qual modelo usar em cada tarefa

Regra em uma frase: **quanto mais caro for um erro silencioso, mais forte o modelo.** Aqui o
erro silencioso mais caro é dinheiro calculado errado que compila e passa nos testes.

- **Haiku** — mudança local e mecânica (renomear, mensagem de erro, texto, Zod simples, commit).
- **Sonnet** — padrão do dia a dia: módulo novo seguindo o template, endpoint simples,
  componente/página seguindo um padrão existente, testes de regra pura.
- **Opus** — regra de negócio multi-camada onde o erro pode passar despercebido:
  `calcularPosicao` (preço médio), `rebalance.service.ts`, `dividends.service.ts`,
  `indicators.service.ts`, recorte/chamadas de IA em `reports/`, auth/cookie/JWT/rate limit/upload,
  estado complexo no frontend (`simulacao/page.tsx`, `dashboard/page.tsx`), qualquer afirmação de
  conteúdo educativo com lei/imposto/número de mercado (com busca na web).
- **Fable** — alto risco: migration que altera dados em produção, qualquer escrita no Supabase
  de produção, ou quando o Opus já travou duas vezes na mesma correção.

Sinais para subir de modelo: o modelo "consertou" o teste em vez do código; a mesma correção
falhou duas vezes; passou nos testes mas você não consegue explicar por quê; toca em dinheiro,
imposto, autenticação ou produção.

Sinais para descer: há um modelo pronto para copiar; o erro seria óbvio na hora; é a mesma
transformação repetida em dezenas de arquivos.

Agentes somente-leitura do projeto já têm modelo sugerido no próprio cabeçalho
(`auditor-financeiro` → Opus, `revisor-camadas` → Sonnet/Haiku). Revisão deve rodar em modelo
igual ou mais forte que quem escreveu o código.

Isso vale só para o modelo que **ajuda a programar** — não confundir com o Gemini usado dentro
do app (`gemini.ts`) para analisar relatórios em PDF, que é decisão separada.

## Fluxo de branches

Toda nova funcionalidade segue este processo:

1. **Verificar compatibilidade**: antes de criar uma branch nova, conferir se a funcionalidade é
   compatível com alguma das branches de desenvolvimento existentes (`aporte-bases-e-motivos`,
   `feat/frontend-design-pass`, etc.).

2. **Criar ou reutilizar branch**:
   - Se compatível com uma existente, criar a funcionalidade dentro dela.
   - Se não, criar uma branch nova com nome descritivo: `feat/nome-da-melhoria`.

3. **Desenvolvimento**: implementar, fazer commits regulares.

4. **Testes**: ao terminar a funcionalidade, **invocar a skill `rodar-testes-seguro` sem esperar
   pedido** e rodar a bateria inteira que ela descreve: backend (`prisma validate`, `tsc`,
   `npm test`), frontend (`typecheck`, `lint`, `npm test`, `build`) e o E2E quando a mudança
   mexer em tela. Se algo falhar por causa da mudança, corrigir antes de prosseguir. Falhas que
   já existiam no `main` são relatadas, não corrigidas escondidas.

5. **Merge para main**:
   - Quando pronto, fazer merge da branch para `main`.
   - Depois, push com commit explicativo.
   - A branch pode ser deletada após merge bem-sucedido.
