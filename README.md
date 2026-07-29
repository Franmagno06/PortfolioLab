# PortfolioLab

Plataforma web de gestão de carteira de investimentos (Ações, FIIs, ETFs e Renda
Fixa) com calculadora de rebalanceamento de aportes e análise de relatórios
gerenciais por IA.

> **Aviso:** projeto educacional e de portfólio. Nada aqui constitui recomendação
> profissional de compra ou venda de ativos.

## O que o projeto faz

| Módulo | O que resolve |
|--------|---------------|
| **Carteira** | Posição consolidada calculada a partir das transações — preço médio ponderado, lucro/prejuízo e alocação por classe, com **cotações ao vivo da B3** |
| **Simulação de aportes** | Dado um valor, calcula **o que comprar** para aproximar a carteira das metas de alocação |
| **Relatórios com IA** | Envie o PDF de um relatório gerencial (FII) ou release trimestral (ação) e receba resumo executivo, alertas por severidade e indicadores — com chat para tirar dúvidas sobre o documento |
| **Notícias** | Feed de mercado que destaca automaticamente o que cita ativos da sua carteira |

## Destaques técnicos

- **Preço médio ponderado** seguindo a regra da Receita Federal (compras
  recalculam o PM incluindo taxas; vendas reduzem quantidade sem alterá-lo),
  com `Decimal` em vez de `float` para não perder centavos em dízimas.
- **Algoritmo guloso de rebalanceamento** — ordena por maior déficit
  (`O(n log n)`) e aloca em unidades inteiras (`O(n)`). Documentado com exemplo
  numérico e análise de complexidade em
  [docs/algoritmo-rebalanceamento.md](docs/algoritmo-rebalanceamento.md).
- **Saída estruturada da IA** via JSON Schema — a análise vem em formato
  garantido pela API, sem parsing de texto livre.
- **Auditoria de alucinação**: `scripts/verificar-analise.mjs` confere se cada
  número citado pela IA existe mesmo no PDF original.
- **Catálogo que cresce sozinho** — ao registrar uma transação com um ticker
  desconhecido, o ativo é criado a partir da cotação real, com a classe
  deduzida do nome. Não há lista fixa: qualquer ação ou FII da B3 serve.
- **Arquitetura em camadas** (Routes → Controller → Service → Repository) com
  TypeScript estrito e 54 testes automatizados.

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Backend | Node.js, TypeScript (strict), Express 5, Prisma ORM, Zod |
| Banco de dados | PostgreSQL 16 (Supabase ou Docker local) |
| Frontend | Next.js 16 (App Router), Tailwind CSS, Recharts |
| Cotações | Yahoo Finance (gratuita, sem chave) — ações e FIIs da B3 |
| IA | Google Gemini (`@google/genai`) + `unpdf` para extração de PDF |
| Testes | Vitest + Supertest |

## Como rodar

Pré-requisito: **Node.js 20+**.

### 1. Banco de dados

Escolha uma das opções:

**Supabase (nuvem, sem instalar nada)** — crie um projeto gratuito em
[supabase.com](https://supabase.com), copie a connection string em
*Connect → ORM → Prisma* (use o **Session pooler**) e aplique o schema:

```bash
cd backend
cp .env.example .env      # cole a connection string em DATABASE_URL
npm install
npx prisma db push        # cria as tabelas
npm run db:seed           # popula com carteira de exemplo
```

**PostgreSQL local via Docker:**

```bash
cd backend
cp .env.example .env      # a DATABASE_URL local já vem preenchida
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
```

### 2. Backend

```bash
cd backend
npm run dev               # http://localhost:3333
```

Teste com `GET /health`. Para inspecionar o banco visualmente: `npm run db:studio`.

### 3. Frontend

Em **outro terminal**:

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

Login do seed: `demo@portfoliolab.dev` / `123456`.

O frontend faz proxy de `/api/*` para o backend, então os dois precisam estar no ar.

### 4. Módulo de IA (opcional)

Crie uma chave em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
e coloque em `backend/.env`:

```env
GEMINI_API_KEY="sua-chave"
```

Sem a chave, todo o resto funciona normalmente — só a tela de Relatórios
responde `503` com a instrução.

## Endpoints da API

Rotas com 🔒 exigem login (cookie HttpOnly).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status da API |
| POST | `/auth/register` | Criar conta (`name`, `email`, `password`) |
| POST | `/auth/login` | Login — grava cookie HttpOnly |
| POST | `/auth/logout` | Encerra a sessão |
| GET 🔒 | `/auth/me` | Perfil do usuário logado |
| GET 🔒 | `/assets` · `/assets/:ticker` | Ativos já cadastrados / busca por ticker |
| GET 🔒 | `/quotes/:ticker` | Cotação ao vivo na B3 (nome, preço e classe) sem cadastrar |
| POST 🔒 | `/transactions` | Registrar compra/venda (`ticker`, `kind`, `quantity`, `unitPrice`, `fee?`, `executedAt`) |
| GET 🔒 | `/transactions` | Histórico de transações |
| DELETE 🔒 | `/transactions/:id` | Apagar transação |
| POST 🔒 | `/dividends` | Registrar provento (`ticker`, `amount`, `paidAt`) |
| GET 🔒 | `/dividends` | Histórico de proventos |
| DELETE 🔒 | `/dividends/:id` | Apagar provento |
| GET 🔒 | `/portfolio` | Posição consolidada por ativo |
| GET 🔒 | `/portfolio/summary` | Patrimônio, lucro e alocação por classe |
| GET 🔒 | `/goals` | Metas de alocação e soma total |
| PUT 🔒 | `/goals` | Criar/atualizar meta (`ticker`, `targetWeight`) — soma ≤ 100% |
| DELETE 🔒 | `/goals/:ticker` | Remover meta |
| POST 🔒 | `/rebalance/simulate` | Simular aporte (`amount`) |
| GET 🔒 | `/news` | Notícias, separando as que citam ativos da carteira |
| POST 🔒 | `/reports` | Enviar PDF (campo `file`) → análise por IA |
| GET 🔒 | `/reports` | Relatórios já analisados |
| POST 🔒 | `/reports/:id/ask` | Chat "Pergunte ao Relatório" (`question`, `history?`) |
| DELETE 🔒 | `/reports/:id` | Apagar relatório |

## Testes

```bash
cd backend
npm test          # 44 testes
npm run typecheck
```

## Problemas comuns

**"Erro interno do servidor" no login**

Se você usa Supabase no plano gratuito, o projeto **hiberna após ~1 semana sem
uso** e a API passa a responder `503`. Reative em *Restore project* no painel do
Supabase (leva 2 a 4 minutos). Para diagnosticar em etapas:

```bash
cd backend
node scripts/debug-login.mjs   # testa banco → senha → JWT separadamente
```

**Páginas do frontend dando 404**

Cache do Next.js corrompido — acontece quando um build de produção e o servidor
de desenvolvimento se misturam na mesma pasta `.next`:

```bash
cd frontend && rm -rf .next && npm run dev
```

**Conferir se a IA inventou algum número**

```bash
cd backend
node scripts/verificar-analise.mjs <pdf> "valor1" "valor2" ...
node scripts/medir-pdf.mjs <pdf>       # páginas, caracteres e tokens
```

## Documentação

- [Roadmap](docs/roadmap.md) — os 9 sprints, do schema ao módulo de IA
- [Arquitetura](docs/arquitetura.md) — camadas e decisões técnicas
- [Algoritmo de rebalanceamento](docs/algoritmo-rebalanceamento.md) — estratégia, complexidade e limitações
- [Guia de deploy](docs/deploy.md) — variáveis de ambiente e checklist
- [Protótipo no Figma](https://www.figma.com/design/G153Uuy3Gwt3I0SNarOn6f)

## Estrutura

```
├── backend/              # API Node.js + TypeScript + Prisma
│   ├── prisma/           # schema, migrations e seed
│   ├── scripts/          # diagnóstico: conexão, medição e auditoria de PDF
│   └── src/
│       ├── config/       # validação das variáveis de ambiente (Zod)
│       ├── database/     # cliente Prisma (singleton)
│       ├── modules/      # auth, assets, transactions, dividends,
│       │                 # portfolio, goals, rebalance, reports, news
│       └── shared/       # middlewares, erros e utilitários
├── frontend/             # Next.js (App Router)
│   └── src/
│       ├── app/(auth)/   # login e registro
│       ├── app/(app)/    # dashboard, carteira, simulação, relatórios, notícias
│       ├── components/   # sidebar e formulários
│       └── lib/          # cliente HTTP e formatação
├── docs/                 # roadmap, arquitetura, algoritmo e deploy
└── relatorios-para-teste/# PDFs reais para testar o módulo de IA
```

## Licença

MIT — veja [LICENSE](LICENSE).
