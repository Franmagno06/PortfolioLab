# PortfolioLab

Plataforma web educacional de carteira de investimentos da B3 (ações, FIIs, ETFs e
renda fixa): posição consolidada, rebalanceamento por aporte, análise de relatórios
em PDF por IA, notícias, fichas públicas de ativos e uma biblioteca de artigos para
quem está começando.

> **Aviso:** projeto educacional e de portfólio. Nada aqui constitui recomendação
> profissional de compra ou venda de ativos.

## Estágio atual

Estado em **15/10/2026**. O produto tem duas metades, que dividem a mesma API e o
mesmo visual ("caderno de laboratório": papel frio, tinta navy, anotações roxas na margem):

| Metade | O que é | Acesso |
|---|---|---|
| **Site público** | Página inicial com o desafio do aporte, fichas de 15 ações, 15 FIIs e 10 ETFs, e a aba **Aprender** (14 artigos, glossário, indicadores explicados) | aberto, sem login |
| **Área logada** | Dashboard, carteira, simulação de aporte, proventos, relatórios com IA, indicadores e notícias | login (cookie `HttpOnly`) |

| Frente | Situação |
|---|---|
| Backend (12 módulos, 10 migrations) | pronto; 559 testes |
| Frontend (site, área logada, Aprender) | pronto; 185 testes unitários e 147 de ponta a ponta |
| Conteúdo educacional | 14 artigos, 38 verbetes, 9 indicadores, "Como o site calcula"; números conferidos em código e dados públicos com fonte e data |
| Segurança | auditoria feita; decisões e pendências em [SECURITY.md](SECURITY.md) |
| Deploy | API no Render, frontend na Vercel, banco no Supabase (a migration de produção é manual) |

**O que ainda falta**

- O CI do GitHub está vermelho por três causas já identificadas, anteriores à aba Aprender: o typecheck do
  frontend não acha os tipos dos `.svg` do cabeçalho; um teste do histórico de notícias assume fuso de
  Brasília e o CI roda em UTC; e um teste de integração do backend é intermitente. Os 559 testes do backend
  passam localmente.
- Agenda de proventos anunciados, Tesouro Direto com cotação automática e metas por classe de ativo
  (veja [Limitações conhecidas](#limitações-conhecidas)).
- O IPCA da página inicial e dos exemplos é fixado à mão, com data. O de outubro sai por volta de 10/11/2026.

## O que o projeto apresenta

### Site público

| Página | O que mostra |
|---|---|
| **Início** (`/`) | O desafio do aporte: o visitante monta a compra de uma carteira de exemplo e compara com o cálculo do PortfolioLab. Traz os números do mês (Selic, IPCA, Ibovespa, IFIX), um ativo anotado e os critérios didáticos de leitura |
| **Ativos** (`/ativos/acoes`, `/fiis`, `/etfs` e cada ficha) | Lista e ficha de cada ativo do catálogo curado: cotação, histórico de preço, indicadores, proventos, resultados trimestrais da CVM, informe mensal de FII, notícias e uma explicação "o que é". Cada número tem um "?" e um link "Saiba mais" para o indicador explicado |
| **Aprender** (`/aprender`) | Artigos, glossário, indicadores explicados e como o site calcula (detalhes abaixo) |

O catálogo público é **curado**: 15 ações, 15 FIIs e 10 ETFs. Só ticker do catálogo chega às fontes
externas; qualquer outro devolve 404 antes de qualquer chamada. A ordem do catálogo é fixa e **não é
ranking**: nada ali indica qual ativo é melhor.

### Área logada

| Módulo | O que resolve |
|--------|---------------|
| **Carteira** | Posição consolidada calculada a partir das transações: preço médio ponderado, lucro/prejuízo, taxas pagas e alocação por classe, com **cotações da B3** |
| **Dashboard** | Patrimônio, lucro, proventos, alocação por classe (rosca) e evolução do patrimônio |
| **Simulação de aportes** | Dado um valor, calcula **o que comprar** para aproximar a carteira das metas. Considera só os ativos que têm meta e declara quanto da carteira ficou fora da conta. As metas são editadas na própria tela |
| **Proventos** | **Importados e calculados sozinhos**: para cada dividendo anunciado, cruza o valor por cota com a quantidade que você tinha na data-ex. O lançamento manual continua disponível para o que a fonte não cobre |
| **Indicadores** | P/L, P/VP, dividend yield, ROE, ROA, margem líquida e dívida líquida/EBITDA dos ativos da carteira, com atualização preguiçosa a cada 24 h |
| **Relatórios com IA** | Envie o PDF de um relatório gerencial (FII) ou release trimestral (ação). Com o ativo informado, o PDF só identifica o período e os **números vêm da CVM** (ITR, DFP e informe mensal de FII); a IA escreve o resumo sobre eles. Sem o ativo, a IA lê o PDF inteiro. O resultado é resumo executivo, alertas por severidade e indicadores, com chat para tirar dúvidas (só nos relatórios lidos do PDF) |
| **Notícias** | Feed de mercado (Money Times e Suno) que destaca o que cita ativos da sua carteira, por ticker e pela marca da empresa |

### Conteúdo educacional (aba Aprender)

Aprender é feita de **artigos**, e não de curso: sem aulas, trilhas nem progresso. Os textos moram em
`frontend/src/content/aprender/`, fora dos componentes; a página só renderiza.

| Tema | Artigos |
|---|---|
| **Antes de investir** | Por que o dinheiro parado perde valor · Reserva de emergência: quanto guardar e onde · Juros compostos: a favor no investimento, contra na dívida |
| **Renda fixa** | Selic, CDI e "100% do CDI" sem mistério · Tesouro Direto: Selic, Prefixado e IPCA+ · CDB, LCI, LCA e o FGC · Imposto na renda fixa: quanto fica para você |
| **Ações e FIIs** | P/L e P/VP: a empresa está cara ou barata? · Dividend yield: quando o provento alto engana · ROE, margem e endividamento · FIIs: tijolo ou papel? |
| **Montar a carteira** | Preço médio sem dor de cabeça · ETFs: uma cota, vários ativos |
| **Rebalancear** | Rebalancear a carteira só com aportes |

Além dos artigos:

- **Glossário** (`/aprender/glossario`): 38 verbetes de A a V, com busca que filtra enquanto se digita, navegação
  por letra e âncora por verbete (`#data-ex`). O link "Ler o artigo" só aparece quando o artigo existe.
- **Indicadores explicados** (`/aprender/indicadores`): P/L, P/VP, DY, ROE, ROA, margem líquida, dívida
  líquida/EBITDA, vacância e DY/P-VP de FII. Cada um traz fórmula, como ler, armadilha e exemplo, e tem âncora
  própria (`#pl`, `#dy`, `#roa`...), usada pelas fichas de ativos.
- **Como o site calcula** (`/aprender/como-calculamos`): preço médio, dividend yield, aporte e juro real, cada um
  com exemplo em reais e o quadro "o que o site não faz".

**Regras de conteúdo** (detalhadas em [docs/aprender-conteudo.md](docs/aprender-conteudo.md)):

1. Nada é recomendação. O texto diz o que o número mede e como ler, nunca que um ativo é bom ou barato.
2. Número que muda (taxa, índice, limite, alíquota, lei) entra **com fonte oficial e data**. Em 15/10/2026
   foram conferidos a Selic meta (13,75%), o CDI (13,65%), o IPCA de 12 meses (4,58%, setembro de 2026), na
   API aberta do Banco Central, e os limites do FGC (R$ 250 mil por CPF por instituição, teto de R$ 1 milhão a
   cada 4 anos), no site do FGC.
3. **Todo número escrito num artigo é conferido em código**: a conta vive em `lib/aprender/exemplos.ts` (aritmética
   em centavos inteiros) e o teste falha se o texto divergir dela.
4. Exemplos hipotéticos dizem que são hipotéticos.

Detalhes de usabilidade: filtro por tema na URL (`?tema=renda-fixa`, funciona sem JavaScript), índice lateral que
acompanha a rolagem, anotações na margem que viram notas em linha no celular, tabelas que viram listas
empilhadas, foco visível, alvos de toque de 44 px e nenhuma rolagem horizontal em 375, 768 e 1440 px.

## Destaques técnicos

- **Preço médio ponderado** seguindo a regra da Receita Federal (compras recalculam o PM incluindo taxas;
  vendas reduzem quantidade sem alterá-lo), com `Decimal` em vez de `float` para não perder centavos.
- **Posição derivada, nunca armazenada**: a carteira inteira sai das transações, fonte única de verdade.
- **Algoritmo guloso de rebalanceamento**: ordena por maior déficit (`O(n log n)`) e aloca em unidades
  inteiras (`O(n)`). Documentado com exemplo numérico e análise de complexidade em
  [docs/algoritmo-rebalanceamento.md](docs/algoritmo-rebalanceamento.md).
- **Provento é derivado, não digitado**: a mesma `calcularPosicao` que monta a carteira diz quantas cotas você
  tinha na data-ex de cada dividendo. Quem comprou depois não recebe, quem vendeu recebeu na época. A importação
  é idempotente e nunca encosta no que foi lançado à mão.
- **Dividend yield calculado pelo site**, com os proventos que ele mesmo importa, e não pelo campo pronto do
  Yahoo. A falha da fonte preserva o DY gravado, nunca o transforma em 0%.
- **CVM como fonte dos números**: o PDF só identifica o período; ITR, DFP e informe mensal vêm dos dados
  abertos. Interpretar o zip da CVM é CPU síncrona, então passa por uma fila serial que devolve a vez ao laço de
  eventos entre um trimestre e outro, para o Node continuar atendendo todo mundo.
- **Saída estruturada da IA** via JSON Schema e **recorte por relevância** antes de chamar a IA: o release de um
  banco tem ~217 mil tokens, e só os blocos que respondem à pergunta viajam. Análise reaproveitada pelo hash do
  PDF (~80% menos tokens por envio).
- **Auditoria de alucinação**: `scripts/verificar-analise.mjs` confere se cada número citado pela IA existe no PDF.
- **Listas paginadas por cursor** em transações, proventos e relatórios.
- **Fontes externas que nunca derrubam uma rota**: cada provedor devolve `null` na falha e a tela mostra o
  último dado conhecido (ver [Integrações externas](#integrações-externas)).
- **Conteúdo versionado e testado**: artigos em MDX, frontmatter validado no build, índice lateral gerado dos
  títulos, e testes que ligam cada número do texto à conta que o produz.

## Arquitetura

Monorepo com `backend/` (API) e `frontend/` (Next.js). O Next reescreve `/api/*` para o backend, então tudo fica
na mesma origem e o cookie `SameSite=Strict` funciona.

### Backend: camadas

```
Routes → Controller → Service → Repository → Prisma → PostgreSQL
```

As dependências apontam **só para baixo**:

- **Controller** valida a entrada com Zod (`*.schemas.ts`) e formata a resposta; nunca importa Prisma.
- **Service** é regra de negócio pura, sem `req`/`res`: testável sem servidor.
- **Repository** é o único lugar que fala com o Prisma.
- Um módulo é uma pasta em `src/modules/` com `*.routes.ts`, `*.controller.ts`, `*.service.ts`,
  `*.repository.ts` e `*.schemas.ts`. `auth` é a referência.
- Erro esperado é `throw new AppError("mensagem", status)`; o Express 5 encaminha erros de rotas async sozinho.

| Módulo | Responsabilidade |
|---|---|
| `auth` | cadastro, login (JWT em cookie), sessão |
| `assets`, `quotes` | catálogo da carteira e cotação (Yahoo Finance) |
| `transactions`, `portfolio` | compras e vendas; posição, resumo e evolução |
| `dividends` | proventos manuais e importados |
| `goals`, `rebalance` | metas de alocação e algoritmo de aporte (incluindo o exemplo público da home) |
| `indicators` | P/L, P/VP, DY, ROE, ROA, margem e dívida/EBITDA por ativo |
| `reports` | análise por IA: CVM, extração de PDF, recorte e chat |
| `news` | feeds RSS, histórico de 14 dias e casamento notícia ↔ ativo |
| `ativos` | as páginas públicas: catálogo curado, ficha de ação, FII e ETF |

Convenções: dinheiro é sempre `Prisma.Decimal` (a conversão para `number` só na fronteira HTTP); banco em
`snake_case` e código em `camelCase`; domínio em português e schema em inglês; ESM com `NodeNext` (imports
relativos levam `.js`).

### Modelo de dados

`User` · `Asset` · `Transaction` · `AssetGoal` · `Dividend` (manual ou do provedor) · `AssetIndicator` (cache de
24 h) · `Report` e `CvmSummary` (análises) · `AssetSnapshot` (resultados da CVM, informe de FII e notícias das
fichas públicas) · `NewsItem` (histórico de notícias). Dez migrations versionadas em `backend/prisma/migrations`.

### Frontend

Next.js 16 (App Router), Tailwind CSS 4 e Recharts. Tipografia: Literata (títulos e leitura), Public Sans
(interface e números tabulares) e Space Grotesk (só o logotipo).

```
src/app/(site)/        site público: início, ativos e aprender
src/app/(app)/         área logada: dashboard, carteira, simulação, relatórios, indicadores, notícias
src/app/(auth)/        login e registro
src/components/        ui, site, ativos e aprender
src/content/aprender/  artigos (.mdx), glossário e indicadores
src/lib/               cliente HTTP único (api.ts), formatação (format.ts), regras puras e conteúdo
src/proxy.ts           proteção de rotas e CSP (era o middleware.ts)
```

As páginas de ativos são lidas no servidor, direto da API (`API_URL`), com cache curto do Next. A aba Aprender não
chama a API: é conteúdo estático.

### Integrações externas

| Serviço | Para quê | Se falhar |
|---------|----------|-----------|
| Yahoo Finance | cotação, histórico e proventos | devolve `null`; mantém o último preço conhecido |
| CVM (dados abertos) | ITR, DFP, informe mensal de FII, cadastro de classes | devolve `null`; o relatório cai na leitura do PDF |
| Google Gemini | resumo e chat dos relatórios | sem `GEMINI_API_KEY`, `503` com a instrução |
| Feeds RSS (Money Times, Suno, InfoMoney, Valor Investe, Seu Dinheiro, Exame, Bora Investir) | notícias | a fonte fora do ar some da lista, sem derrubar a rota |
| API do Banco Central (SGS) | conferência manual de Selic, CDI e IPCA para os textos | não é chamada em tempo de execução |

O feed do Google Notícias **não** é usado: os próprios termos do XML o restringem a uso pessoal e não comercial.

### Segurança

Resumo; a lista completa, com as decisões de **não** corrigir algo, está em [SECURITY.md](SECURITY.md).

- Sessão: JWT em cookie `HttpOnly` + `Secure` + `SameSite=Strict`; senha com bcrypt (12 rodadas).
- Limites por camada: login e cadastro (10 por 15 min por IP), análises de IA (20 por hora por usuário),
  teto global (500 por 15 min), desafio do aporte (30 por minuto) e páginas públicas de ativos (300 por minuto),
  cada um com o seu contador para um não esgotar o outro.
- Entrada validada com Zod; ticker restrito a `[A-Z0-9]{4,12}`; upload só de PDF até 25 MB, em memória.
- Cabeçalhos: helmet na API; HSTS, nosniff, X-Frame-Options, Permissions-Policy e CSP no frontend.
- O isolamento entre usuários é feito na aplicação (todo acesso por id filtra `userId`); não há RLS.

## Limitações conhecidas

- **Proventos futuros não aparecem.** A fonte gratuita só expõe dividendos com data-ex passada; a agenda de
  proventos anunciados, com data-com, exigiria outra fonte.
- **A data do provento é a data-ex, não a de pagamento.** O Yahoo Finance não fornece a segunda.
- **Tesouro Direto não tem cotação automática.** Título público não é negociado em bolsa e não tem ticker; a classe
  `RENDA_FIXA` existe no schema, mas o preço precisa ser informado à mão.
- **Metas são por ticker**, não por classe de ativo.
- **ETFs não têm taxa de administração nem número de cotistas**: nenhuma fonte aberta confiável os traz. A ficha
  manda conferir o regulamento.
- **Nem toda notícia sobre um ativo é reconhecida.** A busca usa o ticker e a marca extraída da razão social;
  empresas cuja marca não deriva do nome oficial só casam quando a notícia cita o ticker.
- **A IA analisa um recorte** de documentos muito grandes. O prompt avisa a IA disso, para ela não afirmar que algo
  não existe no relatório.
- **A cota gratuita do Gemini é apertada.** Análises seguidas esgotam o limite; a API responde 429 e o backend
  traduz para uma mensagem pedindo para aguardar.
- **Não há agendador embutido.** O aquecimento dos indicadores é preguiçoso (a cada leitura); o job em massa
  (`npm run job:indicadores`) é opcional e roda por cron externo.
- **Valores de mercado dos textos são fixados à mão**, com fonte e data (Selic, CDI, IPCA, FGC), e precisam ser
  atualizados quando mudarem.

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Backend | Node.js, TypeScript (strict), Express 5, Prisma ORM 6, Zod, helmet, express-rate-limit |
| Banco de dados | PostgreSQL 16 (Docker local; Supabase em produção) |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, Recharts, MDX (`@next/mdx`, `remark-gfm`) |
| Fontes de dados | Yahoo Finance, CVM (dados abertos), feeds RSS, Banco Central (SGS) |
| IA | Google Gemini (`@google/genai`) + `unpdf` para extração de PDF |
| Testes | Vitest, Supertest, Testing Library (jsdom) e Playwright |
| Operação | GitHub Actions (CI), Render (API), Vercel (frontend), Supabase (banco) |

## Como rodar

Pré-requisito: **Node.js 20+** (o CI usa 22) e Docker Desktop para o banco local.

### 1. Banco de dados

O projeto usa **dois bancos, com papéis separados**:

| | Docker (local) | Supabase (nuvem) |
|---|---|---|
| Para quê | desenvolver, testar, quebrar à vontade | o app publicado, que outras pessoas usam |
| Arquivo | `backend/.env` | `backend/.env.supabase` (nunca versionado) |
| Comandos | `npm run dev`, `db:local`, `db:studio`, `npm test`* | só os que têm `supabase` no nome |
| Pode apagar? | sim, com `npm run db:local:reset` | **nunca** |

\* `npm test` lê o `backend/.env.test`, que também aponta para o Docker.

Ao subir, a API imprime em qual banco está: `🗄️ Banco: LOCAL (Docker) — …` ou
`🗄️ Banco: SUPABASE (produção) — …`.

**Banco local (Docker), o do dia a dia:**

```bash
cd backend
cp .env.example .env      # a DATABASE_URL do Docker já vem preenchida
npm install
npm run db:local          # sobe o Postgres, aplica as migrations e cria a carteira demo
```

O `db:local` recusa rodar se o `.env` apontar para fora da sua máquina. Para recomeçar do zero (apaga só o volume do
Docker): `npm run db:local:reset`. Para desligar o container: `npm run db:local:stop`.

**Supabase, o de produção.** Crie um projeto em [supabase.com](https://supabase.com), copie a connection string
em *Connect → ORM → Prisma* (use o **Session pooler**) e:

```bash
cd backend
cp .env.supabase.example .env.supabase   # cole a connection string
npm run supabase:migrate                 # aplica as migrations pendentes (não apaga dados)
npm run supabase:demo                    # opcional: conta de demonstração pública
```

| Comando | O que faz no Supabase |
|---|---|
| `npm run supabase:migrate` | `prisma migrate deploy`: só aplica migrations novas |
| `npm run supabase:demo` | apaga e recria **só** a conta `carteira@portfoliolab.dev` |
| `npm run supabase:studio` | Prisma Studio no banco real: edite com cuidado |
| `npm run dev:supabase` | API local lendo e escrevendo no banco real |

`npm run db:seed` (que apaga **todas** as tabelas), `prisma db push` e `prisma migrate reset` nunca devem rodar no
Supabase. O app publicado não lê `.env.supabase`: lá a `DATABASE_URL` fica no painel do serviço.

### 2. Backend

```bash
cd backend
npm run dev               # http://localhost:3333
```

Teste com `GET /health` (faz um `SELECT 1`: um Supabase hibernado aparece como `503`).

### 3. Frontend

Em **outro terminal**:

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

Login da carteira de demonstração: `carteira@portfoliolab.dev` / `demo123456`. O frontend faz proxy de `/api/*`
para o backend, então os dois precisam estar no ar. A aba Aprender e a página inicial funcionam sem login.

### 4. Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `DATABASE_URL` | backend | conexão com o Postgres |
| `PORT` | backend | porta da API (padrão 3333) |
| `JWT_SECRET` | backend | segredo da sessão; em produção recusa placeholder e menos de 32 caracteres |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | backend | módulo de IA (opcional) |
| `API_URL` | frontend | endereço da API (padrão `http://localhost:3333`) |

### 5. Módulo de IA (opcional)

Crie uma chave em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e coloque em `backend/.env`:

```env
GEMINI_API_KEY="sua-chave"
```

Sem a chave, todo o resto funciona; só a tela de Relatórios responde `503` com a instrução.

## Endpoints da API

Rotas com 🔒 exigem login (cookie `HttpOnly`). As marcadas como **públicas** não pedem login e têm limitador próprio.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status da API e do banco |
| POST | `/auth/register` · `/auth/login` · `/auth/logout` | Cadastro, login (grava o cookie) e logout |
| GET 🔒 | `/auth/me` | Perfil do usuário logado |
| GET | `/ativos/acoes` · `/ativos/fiis` · `/ativos/etfs` | **Públicas.** Listagens do catálogo curado |
| GET | `/ativos/acoes/:ticker` · `/fiis/:ticker` · `/etfs/:ticker` | **Públicas.** Ficha do ativo (404 para quem não está no catálogo) |
| POST | `/rebalance/exemplo` | **Pública.** Cálculo do desafio do aporte da página inicial (sem banco nem cotação) |
| GET 🔒 | `/assets` · `/assets/:ticker` | Ativos já cadastrados / busca por ticker |
| GET 🔒 | `/quotes/:ticker` | Cotação na B3 (nome, preço e classe) sem cadastrar |
| POST 🔒 | `/transactions` | Registrar compra/venda (`ticker`, `kind`, `quantity`, `unitPrice`, `fee?`, `executedAt`) |
| GET 🔒 | `/transactions` | Histórico de transações (paginado) |
| DELETE 🔒 | `/transactions/:id` | Apagar transação |
| POST 🔒 | `/dividends` | Registrar provento (`ticker`, `amount`, `paidAt`) |
| GET 🔒 | `/dividends` | Histórico de proventos (paginado) |
| POST 🔒 | `/dividends/sync` | Importar os proventos dos ativos da carteira |
| DELETE 🔒 | `/dividends/:id` | Apagar provento |
| GET 🔒 | `/portfolio` · `/portfolio/summary` · `/portfolio/evolution` | Posição por ativo; patrimônio, lucro e alocação por classe; evolução do patrimônio |
| GET 🔒 | `/indicators` | Indicadores fundamentalistas dos ativos da carteira |
| GET 🔒 | `/goals` | Metas de alocação e soma total |
| PUT 🔒 | `/goals` · `/goals/batch` | Criar/atualizar uma meta, ou várias de uma vez (soma ≤ 100%) |
| DELETE 🔒 | `/goals/:ticker` | Remover meta |
| POST 🔒 | `/rebalance/simulate` | Simular aporte (`amount`): só os ativos com meta entram na conta |
| GET 🔒 | `/news` | Notícias, separando as que citam ativos da carteira |
| POST 🔒 | `/reports` | Enviar PDF (campo `file`), com ou sem o ativo, para a análise por IA |
| GET 🔒 | `/reports` | Relatórios já analisados (paginado) |
| POST 🔒 | `/reports/:id/ask` | Chat "Pergunte ao Relatório" (`question`, `history?`); `409` nos relatórios feitos pela CVM, que não guardam o texto do PDF |
| DELETE 🔒 | `/reports/:id` | Apagar relatório |

As listas paginadas (transações, proventos e relatórios) devolvem `{ "itens": [...], "proximoCursor": "<id>" | null }`.
Aceitam `?limite=` (1 a 100, padrão 50) e `?cursor=`, que é o `proximoCursor` da página anterior; nulo significa
que acabou.

## Testes e qualidade

| Suíte | Quantidade | Como rodar |
|---|---|---|
| Backend (Vitest + Supertest, 48 arquivos) | 559 | `cd backend && npm test` |
| Frontend unitário (Vitest + jsdom, 15 arquivos) | 185 | `cd frontend && npm test` |
| E2E: área logada, site e fluxo completo (Playwright) | 18 | `cd frontend && npm run test:e2e` |
| E2E: ativos e Aprender, contra uma API de mentira | 129 | `cd frontend && npm run test:e2e:ativos` |

```bash
cd backend  && npx prisma validate && npm run typecheck && npm test
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

- Os testes do backend escrevem no Postgres do Docker: o `vitest.config.ts` carrega o `.env.test`, e uma guarda
  (`assertDatabaseUrlIsLocal`) aborta a suíte se o destino não for local.
- O E2E principal sobe o próprio backend com `NODE_ENV=test` (limitador de login desligado). O E2E de ativos e
  Aprender não precisa de backend, Docker, Yahoo nem CVM: lê um stub em portas próprias (3100 e 3399).
- Os testes de conteúdo ligam cada número escrito num artigo à conta que o produz
  (`frontend/src/lib/aprender/exemplos.test.ts`) e validam frontmatter, tempo de leitura, índice e links.
- **Integração contínua** (`.github/workflows/ci.yml`): backend com Postgres 16 (`migrate deploy`, typecheck e
  testes) e frontend (typecheck, lint, testes e build). Veja a situação atual em [Estágio atual](#estágio-atual).

## Deploy

O push na `main` publica a API no Render e o frontend na Vercel; **a migration do Supabase de produção é
manual**. Rode `npm run supabase:migrate` **antes** do push que a contém: código novo contra um banco sem a coluna
quebra todas as leituras do model alterado. O passo a passo, com a checagem de segredos, está na skill
`deploy-producao` (`.claude/skills/`).

## Conta de demonstração

Uma carteira pronta para explorar o produto sem cadastrar nada à mão:

```bash
cd backend
npm run db:local        # já cria a conta; sozinho: npm run db:seed:demo
```

Entre com `carteira@portfoliolab.dev` / `demo123456`. São 16 ativos (8 ações, 5 FIIs e 3 ETFs), 27 transações
espalhadas de 2024 a 2026 e metas somando 100%.

Os ETFs cobrem bolsa brasileira (BOVA11), bolsa americana (IVVB11) e juro real (IMAB11). **Tesouro Direto não
entra**: título público não é negociado em bolsa e não tem ticker. IMAB11 é o mais próximo que se pode ter com
preço real. Para ter Tesouro Direto na carteira, lance à mão.

O e-mail é diferente do `demo@portfoliolab.dev` que o `npm run db:seed` cria de propósito: os dois seeds convivem
no mesmo banco, e reusar o endereço faria um apagar a conta do outro sem aviso.

Os tickers são reais e a escolha deles é pública: as ações são as que a imprensa financeira atribui à carteira de
Luiz Barsi, e os FIIs estão entre os mais líquidos do IFIX. **As quantidades, datas e preços de compra são
inventados**: ninguém publica a posição de outra pessoa. Nada ali é recomendação de investimento.

Diferente de `npm run db:seed`, este script apaga apenas a conta de demonstração e recria; o resto do banco fica
intacto. Por isso ele também pode rodar no Supabase, com `npm run supabase:demo`. Lá a conta é compartilhada: o que
um visitante lançar, todos veem. Rode o comando de novo para devolvê-la ao estado original.

## Problemas comuns

**`EPERM` ao rodar `npx prisma generate`**

O `npm run dev` mantém aberto o `query_engine-windows.dll.node`, e o Windows não deixa substituir arquivo em uso.
Pare o servidor antes de gerar o client. Para descobrir qual processo o segura:

```powershell
Get-Process node | Where-Object { $_.Modules.ModuleName -like '*query_engine*' }
```

**Troquei a `GEMINI_API_KEY` e o erro de chave inválida continua**

O `.env` é lido uma vez, quando a API sobe. O `npm run dev` reinicia sozinho ao salvar o `.env`; se a API foi
iniciada de outro jeito, pare (`Ctrl + C`) e suba de novo. Para testar a chave sem a API no meio, sem gastar cota:

```bash
cd backend
npx tsx scripts/medir-tokens-relatorios.ts   # falha logo se a chave for recusada
```

**"Erro interno do servidor" no login**

Se você usa Supabase no plano gratuito, o projeto **hiberna após ~1 semana sem uso** e a API passa a responder
`503`. Reative em *Restore project* no painel do Supabase (leva 2 a 4 minutos). Para diagnosticar em etapas:

```bash
cd backend
node scripts/debug-login.mjs   # testa banco → senha → JWT separadamente
```

**Páginas do frontend dando 404, ou o servidor de teste caindo ao subir**

Cache do Next.js corrompido, que acontece quando um build de produção e o servidor de desenvolvimento se misturam
na mesma pasta. Apague a pasta e suba de novo:

```bash
cd frontend && rm -rf .next && npm run dev          # servidor do dia a dia
cd frontend && rm -rf .next-e2e                     # servidor do E2E de ativos e Aprender
```

**Conferir se a IA inventou algum número**

```bash
cd backend
node scripts/verificar-analise.mjs <pdf> "valor1" "valor2" ...
node scripts/medir-pdf.mjs <pdf>       # páginas, caracteres e tokens
```

## Documentação

- [Roadmap](docs/roadmap.md): os 9 sprints, do schema ao módulo de IA
- [Arquitetura](docs/arquitetura.md): camadas e decisões técnicas
- [Algoritmo de rebalanceamento](docs/algoritmo-rebalanceamento.md): estratégia, complexidade e limitações
- [Como escrever um artigo](docs/aprender-conteudo.md): frontmatter, blocos do MDX, regras de conteúdo e dados públicos
- [Conteúdo-base educacional](docs/conteudo-educacional-base.md): a pesquisa que originou os artigos, com o que ainda está por escrever
- [Segurança](SECURITY.md): controles em vigor, limitações aceitas e pendências
- [CLAUDE.md](CLAUDE.md): convenções do repositório e fluxo de trabalho (inclui as skills e os agentes do projeto)

## Estrutura

```
├── backend/                  # API Node.js + TypeScript + Prisma
│   ├── prisma/               # schema, migrations e seeds
│   ├── scripts/              # banco local, job de indicadores, tabela ticker→CNPJ, auditoria de PDF
│   └── src/
│       ├── config/           # variáveis de ambiente (Zod) e guarda do banco local
│       ├── database/         # cliente Prisma (singleton)
│       ├── modules/          # auth, assets, quotes, transactions, portfolio, dividends, goals,
│       │                     # rebalance, indicators, reports, news, ativos
│       └── shared/           # middlewares, erros e utilitários
├── frontend/                 # Next.js (App Router)
│   ├── e2e/                  # Playwright (área logada, site, ativos e aprender)
│   └── src/
│       ├── app/              # (site), (app) e (auth)
│       ├── components/       # ui, site, ativos e aprender
│       ├── content/aprender/ # artigos (.mdx), glossário e indicadores
│       └── lib/              # api, formatação, regras puras e conteúdo
├── docs/                     # roadmap, arquitetura, algoritmo e guia de conteúdo
├── .claude/                  # skills e agentes de revisão do projeto
├── .github/workflows/        # CI
└── relatorios-para-teste/    # PDFs reais para testar o módulo de IA
```

## Licença

MIT. Veja [LICENSE](LICENSE).
