# Arquitetura do PortfolioLab

## Visão geral do monorepo

```
├── backend/    # API REST — Node.js + TypeScript + Express + Prisma
├── frontend/   # Next.js 16 (App Router) + Tailwind v4
└── docs/       # roadmap, arquitetura e decisões técnicas
```

## Backend — arquitetura em camadas

Cada requisição atravessa as camadas sempre na mesma ordem:

```
HTTP Request
    │
    ▼
Routes (*.routes.ts)         mapeia URL + verbo HTTP → controller
    │
    ▼
Controller (*.controller.ts) fronteira HTTP ↔ domínio: valida entrada (Zod),
    │                        chama o service, formata a resposta JSON
    ▼
Service (*.service.ts)       regra de negócio pura — NÃO conhece HTTP
    │
    ▼
Repository (*.repository.ts) acesso a dados — único lugar que fala com o Prisma
    │
    ▼
Prisma ORM → PostgreSQL
```

**Regra de ouro: as dependências apontam só para baixo.**

- Controller nunca chama o Prisma diretamente
- Service nunca lê `req`/`res` (por isso dá para testá-lo sem servidor)
- Repository não contém regra de negócio, só consultas

Essa separação é o padrão **Layered Architecture** e aplica o **S** do SOLID
(responsabilidade única por camada). Quando os services dependerem de
interfaces de repositório (em vez da classe concreta), aplicaremos também o
**D** (inversão de dependência) — evolução planejada para quando os testes
unitários chegarem no Sprint 4.

## Anatomia de um módulo

Cada domínio vive em uma pasta própria dentro de `src/modules/`, com todas as
camadas juntas (organização por *feature*, não por tipo de arquivo):

```
src/modules/auth/
├── auth.routes.ts       # POST /auth/register, POST /auth/login
├── auth.controller.ts
├── auth.service.ts
├── auth.repository.ts
└── auth.schemas.ts      # DTOs de entrada validados com Zod
```

Módulos existentes: `auth`, `assets`, `transactions`, `portfolio`, `goals`,
`dividends`, `rebalance`, `quotes`, `indicators`, `news`, `reports`, `ativos`
(páginas públicas de ações, FIIs e ETFs) e `indices` (Selic, IPCA, CDI e
índices de bolsa).

## Mapa de requisições do backend

O `app.ts` monta os módulos em ordem, e a ordem importa: o que vem antes do
`limitadorGlobal` não gasta o teto de 500 requisições a cada 15 minutos.

| Prefixo | Acesso | Proteções montadas |
|---------|--------|--------------------|
| `/ativos`, `/indices` | público, só `GET` | `limitadorAtivos` (300/min); antes do `limitadorGlobal` |
| `/auth` | público | `limitadorAuth` em `register` e `login` (10 a cada 15 min) |
| `/rebalance/exemplo` | público | `limitadorExemplo`; só calcula, sem banco nem cotação |
| `/assets`, `/transactions`, `/dividends`, `/goals`, `/reports` | logado | `authGuard` + `somenteLeituraNaDemo` |
| `/portfolio`, `/indicators`, `/news`, `/quotes`, `/rebalance` | logado | `authGuard` (as rotas de `/portfolio`, `/indicators`, `/news` e `/quotes` só leem) |

Casos especiais:

- **Conta de demonstração** (`carteira@portfoliolab.dev`): somente leitura. Toda
  escrita volta 403 com uma mensagem fixa. O token dela leva a claim `demo`, e o
  middleware confere o e-mail no banco quando a claim falta (tokens emitidos
  antes dessa regra). Simular aporte (`POST /rebalance/simulate`) e sincronizar
  proventos (`POST /dividends/sync`, com limite por usuário de 3 a cada 10 min)
  continuam liberados.
- **`/reports`**: o `limitadorRelatorios` e o upload (multer) vêm depois do
  `somenteLeituraNaDemo`, para a demo ser recusada antes de gastar a cota da IA.
- **Fontes externas** nunca derrubam uma rota: falha vira lista ou série vazia
  (Yahoo, CVM, RSS, Banco Central). Ver a tabela de integrações no `CLAUDE.md`.

## Tratamento de erros (já implementado)

Fluxo de um erro esperado:

```
service lança  →  throw new AppError("E-mail já cadastrado", 409)
                       │
Express 5 encaminha automaticamente (rotas async não precisam de try/catch)
                       │
errorHandler responde  →  HTTP 409 { "error": "E-mail já cadastrado" }
```

- `shared/errors/AppError.ts` — erro de domínio com status HTTP
- `shared/middlewares/error-handler.ts` — middleware central, registrado por
  último no `app.ts`; trata `AppError` (status do erro), `ZodError` (400 com
  os campos inválidos) e qualquer outra exceção (500 genérico, sem vazar
  stack trace)

## Convenções do projeto

| Convenção | Motivo |
|-----------|--------|
| `Decimal` para dinheiro, nunca `Float` | ponto flutuante binário erra centavos (0.1 + 0.2 ≠ 0.3) |
| Posição da carteira **derivada** das transações | fonte única de verdade; impossível ficar inconsistente |
| Banco em `snake_case`, código em `camelCase` (via `@map`) | cada mundo na sua convenção |
| DTOs de entrada validados com Zod na borda | dado inválido nunca chega ao service |
| ESM com `moduleResolution: NodeNext` | imports relativos levam `.js` (padrão do Node moderno) |
| Variáveis de ambiente validadas no boot (`config/env.ts`) | falha rápida e clara se faltar configuração |

## Decisões arquiteturais registradas

| Decisão | Alternativa rejeitada | Por quê |
|---------|----------------------|---------|
| Express 5 com camadas manuais | NestJS | objetivo é APRENDER os padrões; NestJS os automatiza (migração futura fica fácil) |
| JWT em cookie `HttpOnly` | token no `localStorage` | imune a roubo por XSS; o navegador envia sozinho |
| PostgreSQL via Docker | instalação nativa | ambiente reproduzível e descartável |
| Enum `AssetType` extensível | tabela de tipos | simplicidade agora; `CRIPTO`/`INTERNACIONAL` entram com uma migration |
| Conta demo pública e somente leitura | demo gravável com reset diário | qualquer visitante entra com um clique; sem escrita não há vandalismo nem gasto da cota da IA |
| Histórico de IFIX, SMLL e IDIV gravado dia a dia (`index_points`) | série inventada ou ETF como aproximação | o Yahoo só entrega o valor de hoje para esses índices; o gráfico cresce com o tempo e nunca mostra dado falso |
| Banco Central em fila serial, com o último valor bom em memória | chamadas paralelas | o SGS cai e bloqueia em rajada; a fila evita a rajada e o último valor evita a página vazia |

## Frontend

Next.js com App Router, organização também por feature:

- `app/(site)/` — site público, aberto a quem está logado ou não: página
  inicial, `ativos/` (ações, FIIs, ETFs e índices) e `aprender/`
- `app/(auth)/` — login e registro
- `app/(app)/` — área logada (dashboard, carteira, simulação, relatórios,
  indicadores, notícias), com o mesmo cabeçalho do site e as abas da carteira
- `components/` — `ui/` (peças básicas), `site/` (cabeçalho, rodapé, faixa da
  demo), `ativos/`, `indices/` e `aprender/`
- `components/movimento/`, `lib/movimento.ts` e os tokens de `globals.css` — o kit de movimento
  (entrada ao rolar, número que conta, minigráfico, explicação que abre, pausa do fundo); todo
  movimento do site passa por ele, sem `prefers-reduced-motion` (decisão do dono)
- `lib/api.ts` — cliente HTTP único do navegador
- `proxy.ts` — manda para o login quem não tem cookie de sessão, guardando a
  página pedida em `?next=` (validado em `lib/navegacao.ts`, que só aceita
  caminho da mesma origem). Era `middleware.ts` até o Next 16 renomeá-lo

### Como o frontend chama o backend

Há dois caminhos, e não se misturam:

| Quem chama | Caminho | Por quê |
|------------|---------|---------|
| Navegador (`lib/api.ts`) | `/api/*`, que o Next reescreve para o backend (`next.config.ts`) | mesma origem: não há CORS e o cookie `SameSite=Strict` funciona |
| Servidor do Next (`lib/ativos-api.ts`, `lib/indices-api.ts`) | direto em `API_URL` | `/api` relativo só existe no navegador; são páginas públicas sem cookie |

No caminho do servidor, a resposta fica 2 minutos no cache do Next
(`ATIVOS_REVALIDAR_S`), e o backend tem os próprios caches (cotações em
minutos, CVM e Banco Central em horas). Todas as páginas que leem esses dados
usam `revalidate = 0`, para não congelar no HTML um estado de "API fora".

A página inicial carrega os números do mês em streaming: a seção aparece de
imediato com a referência fixa e troca pelos números ao vivo se a API responder
em até 5 segundos.

Um `401` fora do login derruba a sessão (`encerrarSessao`) e leva ao
`/login?expirada=1`. Quem clicou em "Sair" não passa por isso: o marcador de
saída em `api.ts` evita que uma chamada atrasada da página, já sem cookie,
mande a pessoa para o aviso de sessão expirada.
