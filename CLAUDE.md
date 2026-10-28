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
— hoje são 21 arquivos, entre eles todos os `*.api.test.ts`, `auth.test.ts`, `news.test.ts`,
`indices.repository.test.ts` e `src/database/integridade.test.ts`. Confira com:

```bash
grep -rl "database/prisma" backend/src --include=*.test.ts
```

**Ordem do deploy quando há migration.** Depois do primeiro deploy (plano em `docs/deploy.md`; em 28/10/2026 a API e o
site ainda não estavam publicados), o Render publica a API no push para a `main`, mas a migration do
Supabase de produção é manual (`npm run supabase:migrate`). Rode a migration **antes** do push que a
contém: código novo contra um banco sem a coluna dá P2022 em toda leitura que passa pelo model alterado
(a coluna `divida_ebitda`, por exemplo, quebraria `/indicators` e a carteira). Só rode contra a produção
com o pedido explícito de quem é dono do banco.

**`index_points` é histórico que não se refaz.** A tabela guarda um ponto por dia de IFIX, SMLL e IDIV
(o Yahoo não tem histórico deles), gravado de forma preguiçosa pelo `GET /indices/dados`
(`modules/indices/indices.repository.ts`), e só cresce. Em produção, nunca apague, reseede nem recrie a
tabela: o histórico perdido não volta. A migration `index_points` vai para o Supabase com
`supabase:migrate` **antes** do push que a contém.

**`backend/.env.supabase` não pode ser commitado** (tem a URL do banco de produção, `JWT_SECRET` e
`GEMINI_API_KEY`). Confira com `git ls-files | grep "\.env"`: só `.env.example` e `.env.supabase.example` (modelo com
valores de mentira) devem aparecer.

Use a skill `deploy-producao` antes de qualquer `git push` para a `main`, de `supabase:migrate`, ou quando
a branch tiver migration: ela confere segredos no commit, a ordem migration → push e o deploy no Render.

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

**Movimento** só com o kit: tokens `--duracao-*` e `--curva` em `globals.css`, `src/lib/movimento.ts` e
`src/components/movimento/` (`Revelar`, `NumeroQueConta`, `Minigrafico`, `ExplicacaoQueAbre`, `GraficoDeFundo`) mais as
classes `.interativo`, `.toque` e `.linha-de-tabela`. Nada de curva ou duração escrita à mão, nada de animar propriedade de
layout (a única exceção é `grid-template-rows` do `ExplicacaoQueAbre`), e **sem `prefers-reduced-motion`**,
`motion-reduce:` ou `motion-safe:` (decisão do dono; o teste `app/movimento-css.test.ts` barra). Movimento contínuo
tem sempre o botão de pausa. A primeira dobra nunca espera animação (exceto o `.reveal` legado do dashboard, mantido por decisão do plano): `Revelar` só esconde o que o observador viu fora da
tela, e número e minigráfico só animam se foram vistos fora antes.

**Aba Aprender** (`/aprender`, artigos, glossário, indicadores, como-calculamos; pública, sem backend). O conteúdo é
`.mdx` e `.ts` em `frontend/src/content/aprender/`, e as regras de escrita estão em `docs/aprender-conteudo.md`:
nada de recomendação, número que muda sempre com fonte oficial e data, e todo exemplo numérico conferido em
`lib/aprender/exemplos.test.ts`. Texto com lei, imposto ou dado de mercado é tarefa de Opus, com busca na web.

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
- `catalogo-de-ativos` — ao incluir, trocar ou remover ticker no catálogo das páginas `/ativos`: lista as
  cópias (catálogo do back e do front, descrições, logo, stub do E2E, tabela CNPJ, testes de contagem)
  para nenhuma ficar para trás.
- `supabase-postgres-best-practices` — RLS, índices, tipos de coluna, migrations e connection
  pooling, ao mexer no `schema.prisma`, em migrations, ou na configuração do Supabase de produção.

## Integrações externas

| Serviço | Onde | Comportamento na falha |
|---------|------|------------------------|
| Yahoo Finance (cotações B3) | `modules/quotes/quotes.provider.ts` | devolve `null`; mantém o último preço conhecido |
| Google Gemini (análise de PDF) | `modules/reports/gemini.ts` | sem `GEMINI_API_KEY` → 503 com instrução |
| RSS Money Times / Suno | `modules/news/rss.ts` | feed fora do ar → lista vazia daquela fonte |
| CVM dados abertos (ITR, DFP, Informe Mensal de FII) | `modules/reports/cvm.provider.ts` | devolve `null`; o relatório cai na leitura do PDF inteiro |
| Banco Central SGS (Selic 432, IPCA 433, CDI 4391 e 4389) | `modules/indices/indices.fontes.ts` | série vazia; a última série boa fica em memória e é a que sai. Uma fila serial (nunca duas chamadas ao BCB ao mesmo tempo) e prazo de 15 s para a resposta: o que não chegou segue na fila em segundo plano |

Relatórios com ativo informado usam a CVM: o PDF só identifica o período (`reports/periodo.ts`),
os números vêm da CVM e a IA escreve o resumo sobre eles. Esses relatórios não guardam o texto
do PDF, então `POST /reports/:id/ask` responde 409. A tabela ticker → CNPJ
(`modules/assets/tabela-cnpj.json`) é fixa e se regenera com `npx tsx scripts/gerar-tabela-cnpj.ts`.

Nenhuma delas pode derrubar uma rota. Ao mexer nesses módulos, preserve o tratamento defensivo.

**Páginas públicas de Ativos** (`modules/ativos/`, `GET /ativos/{acoes,fiis,etfs}[/:ticker]`, sem login).
Só ticker do catálogo curado (`ativos.catalogo.ts`, 15 ações, 15 FIIs e 10 ETFs) chega às fontes; qualquer
outro dá 404 antes de qualquer chamada externa. Cotação e proventos vêm do Yahoo (cache em memória),
indicadores de `AssetIndicator` (24h) e resultados trimestrais e informe de FII da CVM de
`asset_snapshots`. A renovação é preguiçosa; em produção o catálogo também é aquecido ao subir a API.
Duas regras que não podem se perder:

- Interpretar o zip da CVM é **CPU síncrona** (0,5 a 2 s por trimestre). Essas renovações passam pela
  fila serial de `ativos.snapshots.ts` e pausam entre um trimestre e outro; nunca as chame num caminho
  de requisição sem limite de tempo, ou o Node para de atender todo mundo.
- `buscarProventosOuNulo` distingue "o Yahoo falhou" (null) de "o ativo não pagou nada" (lista vazia).
  O Dividend Yield depende dessa diferença: falha preserva o DY gravado, nunca vira 0%.

ETFs: sem banco de indicadores. Preço, histórico e proventos vêm do Yahoo; o patrimônio, do cadastro de classes da CVM (`registro_classe.csv`, em cache de memória por 24h, um arquivo para todos). **Não há taxa de administração nem cotistas**: nenhuma fonte aberta confiável os traz para ETF, e a ficha manda conferir o regulamento. Não coloque número de taxa na mão sem fonte. A explicação "O que é" de cada ativo fica em `ativos.descricoes.ts` (um teste exige uma por ticker e proíbe palavras de recomendação).

O feed do Google Notícias **não** é usado: o próprio XML o restringe a leitor de feeds pessoal, de uso
não comercial. As notícias de cada ficha vêm de feeds RSS públicos de vários portais (Money Times, Suno, InfoMoney, Valor Investe, Seu Dinheiro, Exame, Bora Investir; `FONTES_PARA_ATIVOS` em `news/rss.ts`), guardadas por 14 dias em `news_items` (`news/news.historico.ts`) e filtradas pelo ticker. A aba Notícias da carteira continua só com Money Times e Suno, sem banco.

**Páginas de Índices** (`modules/indices/`, `GET /indices/dados`, sem login): Selic, IPCA e CDI do SGS, Ibovespa e
S&P 500 com histórico do Yahoo, IFIX, SMLL e IDIV do último valor do Yahoo somado ao que `index_points`
acumulou. O front lê em `frontend/src/lib/indices-api.ts` (20 s de prazo nas páginas de índices; 5 s na
home, cuja seção "Os números de…" chega por streaming sob `<Suspense>` com os números fixos de
`NUMEROS_DO_MES` enquanto carrega). Na home o prazo de 5 s só limita a espera: a leitura segue até 20 s e enche o
cache do Next. Se o servidor não conseguiu (`null`), o navegador tenta de novo por `/api/indices/dados` com 25 s
(`components/site/numeros-do-mes-recuperaveis.tsx`, via `apiPublica`, que não mexe na sessão) e troca pelos
números reais. Mudou o DTO de `/indices/dados`? Confira também a checagem de formato desse componente.

O front lê essa API no servidor (`frontend/src/lib/ativos-api.ts`, direto em `API_URL`, e não por `/api`), com as páginas em `revalidate = 0` e a resposta guardada 2 min pelo Next. `ativos-catalogo.ts` do front é uma cópia só de tickers e nomes, e um teste confere que não diverge do backend. O E2E das páginas (`npm run test:e2e:ativos`) é isolado: lê uma API de mentira (`e2e/ativos/stub-api.mjs`) em portas próprias, sem backend, Docker, Yahoo nem CVM. Mudou um campo do DTO de `/ativos`? Atualize `ativos-tipos.ts` e o stub. O stub também responde `/indices/dados` com
`frontend/e2e/ativos/indices-dados.json`, gerado de `DADOS_DE_EXEMPLO` (`cd frontend && npx tsx
scripts/gerar-fixture-indices.ts`); `indices-contrato.test.ts` confere que as chaves batem com o tipo e com o
backend. Já o E2E principal (`playwright.config.ts`) sobe o backend de verdade, e a home dele chama o Banco
Central e o Yahoo ao vivo.

**Conta de demonstração somente leitura.** O botão "Ver a demonstração" loga qualquer visitante na mesma
conta (`EMAIL_DA_DEMO` em `backend/src/shared/conta-demo.ts`), então ela não escreve: o middleware
`somenteLeituraNaDemo` (depois do `authGuard`) recusa com 403 toda escrita da demo, reconhecida pela claim
`demo` do JWT ou, em token antigo sem a claim, pelo e-mail conferido no banco. A única escrita liberada é
`POST /dividends/sync` (copia proventos do Yahoo), que tem limitador próprio por usuário.

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
   - Antes do push, invocar a skill `deploy-producao` (segredos, migration antes do push).
   - Depois, push com commit explicativo.
   - A branch pode ser deletada após merge bem-sucedido.
