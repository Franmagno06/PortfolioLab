# Arquitetura do PortfolioLab

Retrato do código em 13/11/2026. As regras do dia a dia (camadas, dinheiro em `Decimal`, os dois bancos) estão
no `CLAUDE.md` da raiz; este documento mostra como as peças se encaixam. As rotas, uma a uma, estão em
[api.md](api.md); o front, em [frontend.md](frontend.md); a produção, em [deploy.md](deploy.md).

## Visão geral

```
├── backend/    API REST: Node 22 + TypeScript (ESM) + Express 5 + Prisma 6 + PostgreSQL
├── frontend/   Next 16 (App Router) + React 19 + Tailwind v4 + Recharts + MDX
├── docs/       arquitetura, API, deploy e decisões
└── render.yaml Blueprint do Render (só a API)
```

```
navegador ──/api/*──► Next (Vercel) ──rewrite──► API Express (Render) ──► Postgres (Supabase)
     │                     │                          │
     │                     └─ Server Components ──────┤ (direto em API_URL: /ativos, /indices)
     │                                                │
     └─ páginas e /aprender (sem backend)             └─► Yahoo, CVM, Banco Central, B3, feeds RSS
```

O navegador só fala com o próprio site. As páginas públicas de ativos e índices são renderizadas no servidor
do Next, que lê a API direto. A API é um processo Express comum, sempre no ar enquanto o Render não a põe para
dormir; nada é serverless.

## Backend em camadas

```
Routes (*.routes.ts)          URL + verbo → controller, com os middlewares da rota
Controller (*.controller.ts)  valida a entrada com Zod, chama o service, formata a resposta
Service (*.service.ts)        regra de negócio; não conhece req/res
Repository (*.repository.ts)  único lugar que fala com o Prisma
Prisma → PostgreSQL
```

As dependências apontam só para baixo. Erro esperado é `throw new AppError(msg, status)`; o Express 5
encaminha erros de rota async sozinho, e o `errorHandler` (registrado por último no `app.ts`) responde. O
formato dos erros está em [api.md](api.md#convenções-que-valem-para-todas-as-rotas).

### Módulos (`backend/src/modules/`)

| Módulo | O que faz | Arquivos fora do padrão de cinco |
|---|---|---|
| `auth` | cadastro, login (JWT em cookie), `/me`. É a referência canônica | — |
| `assets` | catálogo de ativos do usuário e busca por ticker; tabela ticker → CNPJ (`cnpj.ts`, `tabela-cnpj.json`) | sem service nem schemas: o controller lê o repository direto |
| `transactions` | compra, venda, extrato e exclusão, com a checagem de venda descoberta | — |
| `portfolio` | posição, resumo e evolução mensal, derivados das transações (`calcularPosicao`) | sem schemas (só GET) |
| `quotes` | cotações do Yahoo (`quotes.provider.ts`) e a resolução de preço única (`resolverPrecos`) | o controller chama o provider direto; sem schemas |
| `goals` | metas de alocação, unitária e em lote | — |
| `rebalance` | simulação de aporte (`calcularAporte`) e o exemplo público da home | sem repository (lê `goals` e `portfolio`) |
| `dividends` | proventos manuais e a sincronização com o Yahoo | — |
| `indicators` | P/L, P/VP, DY, ROE, ROA, margem, dívida/EBITDA das ações da carteira; cálculo pela CVM (`indicators.cvm.ts`) | sem schemas |
| `news` | aba Notícias (`rss.ts`) e o histórico de 14 dias das fichas (`news.historico.ts`) | sem schemas |
| `reports` | relatórios oficiais da CVM: provider dos zips (`cvm.provider.ts`), períodos (`periodo.ts`), texto por regra fixa (`resumo-cvm.ts`, `analise.ts`) | — |
| `ativos` | páginas públicas de ações, FIIs e ETFs: catálogo curado, descrições, fontes com cache, fotografias, fila | `ativos.cache.ts`, `ativos.fontes.ts`, `ativos.snapshots.ts`, `ativos.noticias.ts`, `ativos.composicao.ts`, `ativos.tipos.ts` |
| `indices` | Selic, IPCA, CDI, Ibovespa, S&P 500, IFIX, SMLL e IDIV numa rota só | `indices.fontes.ts`, `indices.calculos.ts` |

`shared/` tem o `AppError`, os middlewares (`auth-guard`, `somente-leitura-na-demo`, `rate-limit`,
`error-handler`), a paginação por cursor, o `tickerSchema` e o e-mail e a mensagem da conta demo. `config/env.ts`
valida as variáveis no boot (falha rápido); `config/dbGuard.ts` descreve o banco no log e barra seed e testes
fora do Docker.

### Ordem de montagem no `app.ts`

A ordem importa. O que vem antes do `limitadorGlobal` não gasta o teto de 500 por 15 min, e o que vem antes do
`express.json()` não paga o parse.

1. `trust proxy = TRUST_PROXY` e `helmet` (sem CSP; `crossOriginResourcePolicy: cross-origin`).
2. `/ativos` e `/indices`: públicas, com o `limitadorAtivos` (300/min).
3. `limitadorGlobal`, `express.json()`, `cookieParser()`.
4. `GET /health` (faz `SELECT 1`).
5. `/auth` (o `limitadorAuth` só em `register` e `login`).
6. `/rebalance/exemplo`, público, com `limitadorExemplo`, antes do `/rebalance` protegido.
7. Protegidos com `authGuard` e `somenteLeituraNaDemo`: `/assets`, `/transactions`, `/dividends`, `/goals`,
   `/reports`. Só com `authGuard`: `/indicators`, `/news`, `/quotes`, `/portfolio`, `/rebalance`.
8. `errorHandler`.

Não há CORS configurado, e não precisa: o navegador nunca chama a API de outra origem.

### Subida e desligamento (`server.ts`)

O log imprime `🚀 API rodando` e `🗄️ Banco: LOCAL | SUPABASE (produção) | REMOTO — host:porta/banco`, sem a
senha. Com `AQUECER_CATALOGO` ligado (o padrão), a API aquece o catálogo de Ativos (só em produção) e as séries
de índices (fora de teste); o `render.yaml` desliga os dois. `SIGTERM`/`SIGINT` fecham o servidor HTTP, esperam
as requisições em voo e só então desconectam o Prisma.

## Dinheiro e regras de cálculo

- **Posição derivada.** Nada de posição gravada: `calcularPosicao` (`portfolio.service.ts`) percorre as
  transações em ordem de `executedAt` e, no empate, de `seq` (autoincrement). COMPRA recalcula o preço médio
  com a taxa; VENDA reduz a quantidade e não mexe no PM; quantidade zerada zera o PM. A mesma função valida a
  venda nova (com `seq` no máximo do BIGINT), a exclusão de transação, a sincronização de proventos e a
  evolução mensal.
- **`Decimal` até a fronteira.** Os services fazem conta em `Prisma.Decimal` e convertem com `em2Casas()` na
  resposta. Pontos onde ainda há `number` no meio: a entrada das rotas (`z.coerce.number()`), a soma das metas
  em `goals.service.ts` e `rebalance.service.ts`, o resumo (`getSummary` soma os valores já arredondados de
  `getCarteira`) e os preços do Yahoo, que chegam como `number` e viram `Decimal` em `emCentavos`.
- **Preço de uma fonte só por resposta.** `quotesService.resolverPrecos` resolve cada ticker uma vez (Yahoo se
  o preço gravado tem mais de 15 min, senão o gravado; renda fixa nunca é cotada) e grava o novo preço de forma
  oportunista (`allSettled`). Carteira, resumo, simulação e notícias usam esse mapa.
- **Rebalanceamento** (`rebalance.service.ts:calcularAporte`): fatia do aporte proporcional ao déficit, depois o
  troco para quem continua mais longe da meta, sempre em cotas inteiras. Detalhe em
  [algoritmo-rebalanceamento.md](algoritmo-rebalanceamento.md).

## Integrações externas, filas e caches

Nenhuma fonte externa derruba uma rota: falha vira `null`, lista vazia ou o último dado bom. A tabela de
comportamento na falha está no `CLAUDE.md`. Aqui, o que cada uma tem de prazo, fila e cache.

| Fonte | Arquivo | Prazo por chamada | Cache | Fila |
|---|---|---|---|---|
| Yahoo `v8/chart` (cotação, histórico mensal, proventos, séries de índice) | `quotes/quotes.provider.ts` | 8 s | preço em `assets.current_price` (15 min); nas fichas, memória (`ativos.fontes.ts`: cotação 15 min, histórico e proventos 6 h, falha 2 min); índices 1 min | não |
| Yahoo `quoteSummary` (indicadores) | idem | 8 s na consulta, no cookie e no crumb | `asset_indicators` (24 h); cookie e crumb em memória | sequencial dentro de `GET /indicators` |
| CVM: ITR, DFP, Informe Mensal de FII, cadastro de classes | `reports/cvm.provider.ts` | 90 s por download, zip até 128 MB | zip compactado em memória 6 h; análise em `cvm_summaries` (por versão); fotografias em `asset_snapshots` | `naFilaDaCvm` (relatórios) e a fila pesada de `ativos.snapshots.ts` |
| Banco Central SGS (432, 433, 4391, 4389) | `indices/indices.fontes.ts` | 15 s por janela de 5 anos, uma nova tentativa | série em memória 6 h (falha 2 min), última série boa em memória, reserva mensal em `index_points` (`sgs-*`) | `filaSgs`: nunca duas chamadas ao mesmo tempo |
| B3, estatísticas de índices (IFIX, SMLL, IDIV) | idem | 15 s por ano, uma nova tentativa | `index_points`; busca refeita depois de 6 h (falha 2 min) | uma busca por índice em voo |
| Feeds RSS (7 portais) | `news/rss.ts`, `news/news.historico.ts` | 8 s por feed | aba Notícias: memória 10 min; fichas: `news_items` (14 dias) e fotografia `NEWS` (30 min) | uma ida aos feeds por vez |

**As filas.** Interpretar o zip da CVM é CPU síncrona (0,5 a 2 s por trimestre nesta máquina, cerca de 10 vezes
mais no Render gratuito). Por isso as leituras passam por filas seriais:

- `naFilaDaCvm` (`reports.service.ts`): uma consulta de relatório por vez, para a API inteira. A rota espera a
  vez dela sem prazo.
- `filaPesada` (`ativos.snapshots.ts`): renovação das fotografias `CVM_RESULTS` e `CVM_FUND_REPORT`. A ficha
  espera até 8 s e responde com o que tem; a busca continua e grava. Uma busca que falhou não é refeita por
  30 min (`falhasRecentes`).
- `fila` de `ativos.service.ts`: o aquecimento e a renovação em segundo plano do catálogo, um ativo por vez,
  com espera de até 180 s por fonte.

As duas filas da CVM não somam memória de leitura: depois do download, a leitura e a montagem do dado não têm
`await`, então duas leituras nunca se intercalam. O que pode coincidir são dois downloads.

**Memória.** `lerCsvsDoZip` descompacta um CSV de cada vez e, com o CNPJ, decodifica só o cabeçalho e as linhas
da companhia. O pico medido com o catálogo inteiro foi de 362 MB; os números e o histórico da correção estão em
[deploy.md](deploy.md), seção "Memória da leitura da CVM".

## Tabelas

Esquema em `backend/prisma/schema.prisma`, banco em `snake_case`. RLS ligado em todas as tabelas, sem policy:
a API conecta como dono e ignora o RLS; os papéis `anon` e `authenticated` do Supabase não leem nada.

| Tabela | De quem | O que guarda |
|---|---|---|
| `users` | usuário | nome, e-mail (único, com caixa), hash bcrypt |
| `transactions` | usuário | compras e vendas; `seq` (BIGINT autoincrement) desempata a mesma data |
| `asset_goals` | usuário | meta por ativo (`Decimal(5,2)`), única por usuário e ativo |
| `dividends` | usuário | proventos `MANUAL` e `PROVEDOR`; única por usuário, ativo, data e origem |
| `reports` | usuário | relatórios guardados na conta (até 50); as colunas `extracted_text` e `content_hash` são do tempo do PDF |
| `assets` | global | catálogo que cresce com o uso: ticker, nome, classe, último preço, CNPJ |
| `asset_indicators` | global | cache dos indicadores por ativo (24 h) |
| `cvm_summaries` | global | análise da CVM por ativo e período, válida só com a `versao` atual (`VERSAO_DA_ANALISE`) |
| `asset_snapshots` | global | fotografias das fichas: `CVM_RESULTS` (24 h), `CVM_FUND_REPORT` (6 h), `NEWS` (30 min) |
| `news_items` | global | notícias dos feeds, 14 dias, chave pelo link |
| `index_points` | global | um ponto por dia de IFIX, SMLL e IDIV, e a reserva mensal do SGS (`sgs-432` etc.). Só cresce: nunca apague em produção (ver `CLAUDE.md`) |

As 13 migrations estão em `backend/prisma/migrations/`. O SQL de `backend/prisma/manual/` não é migration: roda
à mão e só com o OK do dono.

## Conta de demonstração

Qualquer visitante entra na mesma conta (`EMAIL_DA_DEMO`, senha pública no botão "Ver a demonstração"), então
ela é somente leitura. O login dá a ela a claim `demo: true`; `somenteLeituraNaDemo` recusa com 403 toda escrita
nos prefixos que o montam e confere o e-mail no banco quando o token não tem a claim. A única escrita liberada é
`POST /dividends/sync`, que só recopia proventos do Yahoo e tem limitador próprio. A carteira dela vem de
`prisma/seed-demo.ts`, que carrega os relatórios pelo mesmo caminho da rota (`reportsService.consultar`).

## Frontend

O resumo: três grupos de rota (`(site)` público, `(auth)`, `(app)` logado), `src/proxy.ts` protegendo a área
logada pela presença do cookie e montando o CSP, `lib/api.ts` como cliente único do navegador e
`ativos-api.ts`/`indices-api.ts` lendo no servidor. Tudo em [frontend.md](frontend.md).

## Decisões registradas

| Decisão | Alternativa rejeitada | Por quê |
|---|---|---|
| Express 5 com camadas manuais | NestJS | o objetivo é aprender os padrões; o NestJS os automatiza |
| JWT em cookie `HttpOnly` + `SameSite=Strict`, atrás do rewrite do Next | token no `localStorage`, CORS | imune a roubo por XSS, e sem CORS a configurar |
| Posição derivada das transações | posição gravada | fonte única de verdade, não fica inconsistente |
| PostgreSQL no Docker para o dia a dia, Supabase só para produção | um banco só | testes e seed nunca tocam a produção (`dbGuard.ts`) |
| Enum `AssetType` extensível | tabela de tipos | simplicidade; `CRIPTO`/`INTERNACIONAL` entram com uma migration |
| Conta demo pública e somente leitura | demo gravável com reset diário | um clique para entrar, sem vandalismo |
| Relatórios só com dados abertos da CVM, texto por regra fixa | PDF enviado e resumo por IA | todo número vem do documento oficial; nada de texto inventado |
| Catálogo curado nas páginas públicas | qualquer ticker | só ticker conhecido chega às fontes externas; caches com no máximo 40 chaves |
| Histórico de IFIX, SMLL e IDIV gravado (`index_points`) e completado pela B3 | ETF como aproximação | o Yahoo não tem histórico desses índices; nada de série falsa |
| Banco Central em fila serial, com a última série boa e a reserva no banco | chamadas paralelas | o SGS cai em rajada; a reserva cobre a API recém-subida |
| CPU da CVM em filas seriais, com leitura só das linhas do CNPJ | ler o CSV inteiro | o Render gratuito tem 512 MB e 0,1 CPU |
