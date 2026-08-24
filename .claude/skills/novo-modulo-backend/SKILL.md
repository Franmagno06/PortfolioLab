---
name: novo-modulo-backend
description: Cria um módulo novo no backend seguindo a convenção em camadas do projeto (routes → controller → service → repository → schemas + teste). Use ao adicionar um domínio novo em src/modules/, ou ao completar um módulo existente que está sem alguma camada ou sem teste.
---

# Criar um módulo no padrão do PortfolioLab

Referência canônica: `backend/src/modules/auth/`. Leia esses cinco arquivos antes
de escrever — eles definem o estilo, não só a estrutura.

## Estrutura

```
backend/src/modules/<nome>/
├── <nome>.routes.ts       # verbo + caminho → controller
├── <nome>.controller.ts   # fronteira HTTP: parse, chama service, formata
├── <nome>.service.ts      # regra de negócio pura (sem req/res)
├── <nome>.repository.ts   # único lugar que fala com Prisma
├── <nome>.schemas.ts      # DTOs de entrada validados com Zod
└── <nome>.service.test.ts # unitário da regra pura
    <nome>.test.ts         # integração da rota (quando houver rota nova)
```

Use o singular do domínio no plural: `transactions`, `dividends`, `goals`.

## Os moldes

**routes** — só mapeamento. O `authGuard` não vai aqui: ele é aplicado no mount
em `app.ts`, e vale para todas as subrotas.

```ts
import { Router } from "express";
import { <nome>Controller } from "./<nome>.controller.js";

export const <nome>Routes = Router();

<nome>Routes.get("/", <nome>Controller.list);
<nome>Routes.post("/", <nome>Controller.create);
```

**controller** — três linhas por handler. Sem try/catch: no Express 5 o erro de
rota async chega sozinho ao `errorHandler`.

```ts
import type { Request, Response } from "express";
import { create<Nome>Schema } from "./<nome>.schemas.js";
import { <nome>Service } from "./<nome>.service.js";

export const <nome>Controller = {
  async create(req: Request, res: Response) {
    const input = create<Nome>Schema.parse(req.body);
    const resultado = await <nome>Service.create(req.userId as string, input);
    res.status(201).json(resultado);
  },
};
```

**service** — recebe `userId` como parâmetro, nunca lê da request. Falha
esperada é `AppError` com o status certo.

```ts
import { AppError } from "../../shared/errors/AppError.js";
import type { Create<Nome>Input } from "./<nome>.schemas.js";
import { <nome>Repository } from "./<nome>.repository.js";

export const <nome>Service = {
  async create(userId: string, input: Create<Nome>Input) {
    // regra de negócio aqui
    return <nome>Repository.create({ userId, ...input });
  },
};
```

**repository** — só consultas. **Toda** consulta de dado de usuário filtra por
`userId`; para buscar por id, use `findFirst({ where: { id, userId } })`, nunca
`findUnique({ where: { id } })` — senão um usuário lê o registro de outro.

**schemas** — Zod, com mensagem em português. Ticker sempre normalizado:

```ts
ticker: z.string().min(1, "Ticker é obrigatório").transform((s) => s.trim().toUpperCase()),
```

## Registrar no app

Em `backend/src/app.ts`, junto das outras rotas protegidas e **antes** do
`errorHandler`:

```ts
app.use("/<nome>", authGuard, <nome>Routes);
```

Rota pública (sem `authGuard`) só se houver motivo explícito — hoje apenas
`/auth` e `/health`.

## Testes — obrigatórios, não opcionais

Um módulo sem teste não está pronto. Dois níveis:

**Unitário** da função pura, sem banco. Modelo:
`portfolio/portfolio.service.test.ts` e `rebalance/rebalance.service.test.ts`.
Cubra os casos-limite, não só o caminho feliz: entrada vazia, valor zero,
empate, ordem invertida.

**Integração** da rota, com Supertest. Modelo: `auth/auth.test.ts`. Regras:
- e-mail único por arquivo — `vitest-<dominio>-${randomUUID()}@portfoliolab.dev`
- `afterAll` apaga **só** o que este arquivo criou (os arquivos rodam em
  paralelo; um `deleteMany` largo colide com as outras suítes)
- sempre um caso "bloqueia sem login com 401"

Antes de rodar a suíte, use a skill `rodar-testes-seguro` — os testes de
integração escrevem no banco de `DATABASE_URL`, que aponta para produção.

## Antes de considerar pronto

1. `cd backend && npx tsc --noEmit` — limpo.
2. Nenhum import de `prisma` fora do repository.
3. Nenhum `req`/`res` no service.
4. Todo import relativo termina em `.js`.
5. Rode o agente `revisor-camadas` sobre o módulo novo.
6. Se o módulo mexe com dinheiro, quantidade ou percentual, rode também o
   agente `auditor-financeiro`.
