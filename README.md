# PortfolioLab

Plataforma web de gestão de carteira de investimentos (Ações, FIIs, ETFs e Renda Fixa) com calculadora inteligente de rebalanceamento de aportes e análise de relatórios gerenciais com IA.

> **Aviso:** projeto educacional e de portfólio. Nada aqui constitui recomendação profissional de compra ou venda de ativos.

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Backend | Node.js, TypeScript (strict), Express 5, Prisma ORM, Zod |
| Banco de Dados | PostgreSQL 16 (Docker) |
| Frontend (Sprint 5+) | Next.js, Tailwind CSS, shadcn/ui, Recharts |
| IA (Sprint 8) | Análise de relatórios gerenciais em PDF via LLM |

## Como rodar o backend

Pré-requisito: Node.js 20+.

### Banco de dados — duas opções

**Opção A — Supabase (recomendada, já configurada):** o projeto `portfoliolab`
existe no Supabase (região São Paulo) com schema aplicado e dados de exemplo.
Basta copiar a connection string (Dashboard → Connect → ORM → Prisma, usando o
**Session pooler**) para a variável `DATABASE_URL` no arquivo `backend/.env`.

> Com o Supabase, o schema já está aplicado — não rode `db:migrate`. Para
> futuras mudanças de schema, use `npx prisma db push`.

**Opção B — PostgreSQL local via Docker:**

```bash
cd backend
docker compose up -d     # sobe o PostgreSQL
npm run db:migrate       # cria as tabelas
npm run db:seed          # popula com dados de exemplo
```

### Iniciar a API

```bash
cd backend
npm install
npm run dev
```

## Como rodar o frontend

Com a API rodando (passo acima), abra **outro terminal**:

```bash
cd frontend
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) — login demo:
`demo@portfoliolab.dev` / `123456`. O frontend fala com a API via rewrite
(`/api/*` → `localhost:3333`), então os dois precisam estar rodando.

A API sobe em `http://localhost:3333` — teste com `GET /health`.

Usuário de demonstração criado pelo seed: `demo@portfoliolab.dev` / senha `123456`.

Para inspecionar o banco visualmente: `npm run db:studio`.

> **Nota sobre imports:** o projeto usa ES Modules com `moduleResolution: NodeNext`, então imports relativos levam extensão `.js` mesmo em arquivos `.ts` (ex: `import { app } from "./app.js"`). É o comportamento padrão do Node moderno.

## Endpoints da API

Rotas com 🔒 exigem login (cookie de sessão). Teste com o Thunder Client no VS Code.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status da API |
| POST | `/auth/register` | Criar conta (`name`, `email`, `password`) |
| POST | `/auth/login` | Login — grava cookie HttpOnly |
| POST | `/auth/logout` | Sai da sessão |
| GET 🔒 | `/auth/me` | Perfil do usuário logado |
| GET 🔒 | `/assets` | Lista os ativos disponíveis |
| GET 🔒 | `/assets/:ticker` | Busca ativo por ticker |
| POST 🔒 | `/transactions` | Registrar compra/venda (`ticker`, `kind`, `quantity`, `unitPrice`, `fee?`, `executedAt`) |
| GET 🔒 | `/transactions` | Histórico de transações |
| DELETE 🔒 | `/transactions/:id` | Apagar transação |
| POST 🔒 | `/dividends` | Registrar provento (`ticker`, `amount`, `paidAt`) |
| GET 🔒 | `/dividends` | Histórico de proventos |
| DELETE 🔒 | `/dividends/:id` | Apagar provento |
| GET 🔒 | `/portfolio` | Posição consolidada: quantidade, preço médio, lucro por ativo |
| GET 🔒 | `/portfolio/summary` | Patrimônio total, lucro e alocação % por classe |
| GET 🔒 | `/goals` | Metas de alocação e soma total |
| PUT 🔒 | `/goals` | Criar/atualizar meta (`ticker`, `targetWeight`) — soma ≤ 100% |
| DELETE 🔒 | `/goals/:ticker` | Remover meta |
| POST 🔒 | `/rebalance/simulate` | Simular aporte (`amount`): o que comprar para rebalancear |
| POST 🔒 | `/reports` | Enviar PDF (campo `file`) → análise com IA: resumo, alertas, indicadores |
| GET 🔒 | `/reports` | Relatórios já analisados |
| POST 🔒 | `/reports/:id/ask` | Chat "Pergunte ao Relatório" (`question`, `history?`) |
| DELETE 🔒 | `/reports/:id` | Apagar relatório |

> O módulo de IA requer `ANTHROPIC_API_KEY` no `backend/.env`
> (crie em [console.anthropic.com](https://console.anthropic.com)). Sem a chave,
> o restante da plataforma funciona normalmente.

## Documentação

- [Roadmap de desenvolvimento](docs/roadmap.md) — plano completo em 8 sprints
- [Protótipo no Figma](https://www.figma.com/design/G153Uuy3Gwt3I0SNarOn6f) — 4 telas: Dashboard, Carteira, Simulação e Indicadores

## Estrutura

```
├── backend/          # API Node.js + TypeScript + Prisma
│   ├── prisma/       # schema, migrations e seed
│   └── src/
│       ├── config/   # validação de variáveis de ambiente
│       ├── database/ # cliente Prisma (singleton)
│       ├── modules/  # domínios: auth, assets, portfolio, rebalance...
│       └── shared/   # middlewares, erros e utilitários
├── frontend/         # Next.js (a partir do Sprint 5)
└── docs/             # roadmap e decisões técnicas
```
