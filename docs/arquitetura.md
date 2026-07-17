# Arquitetura do PortfolioLab

## Visão geral do monorepo

```
├── backend/    # API REST — Node.js + TypeScript + Express + Prisma
├── frontend/   # Next.js (entra no Sprint 5)
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

Módulos previstos: `auth`, `assets`, `transactions`, `portfolio`, `goals`,
`dividends`, `rebalance`.

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

## Frontend (a partir do Sprint 5)

Next.js com App Router, organização também por feature:

- `app/(auth)/` — rotas públicas (login, registro)
- `app/(app)/` — rotas protegidas (dashboard, carteira, simulação)
- `components/` — `ui/` (shadcn), `charts/`, `tables/`, `forms/`
- `lib/api.ts` — cliente HTTP único para falar com o backend
- `middleware.ts` — bloqueia rotas protegidas sem cookie de sessão

O design segue o [protótipo no Figma](https://www.figma.com/design/G153Uuy3Gwt3I0SNarOn6f).
