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

A API sobe em `http://localhost:3333` — teste com `GET /health`.

Usuário de demonstração criado pelo seed: `demo@portfoliolab.dev` / senha `123456`.

Para inspecionar o banco visualmente: `npm run db:studio`.

> **Nota sobre imports:** o projeto usa ES Modules com `moduleResolution: NodeNext`, então imports relativos levam extensão `.js` mesmo em arquivos `.ts` (ex: `import { app } from "./app.js"`). É o comportamento padrão do Node moderno.

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
