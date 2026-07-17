# Roadmap de Desenvolvimento — PortfolioLab

Plano em 8 sprints (1 semana cada), do banco de dados ao módulo de IA. Os itens mais complexos ficam no final para manter a evolução incremental.

## 🏗️ Sprint 1 — Fundações e Banco de Dados

**Objetivo:** rodar `npx prisma migrate dev` com sucesso e ver as 5 tabelas no PostgreSQL.

- [x] Estrutura de pastas do backend com TypeScript estrito
- [x] PostgreSQL local via `docker-compose.yml`
- [x] `schema.prisma` com as 5 entidades: `User`, `Asset`, `Transaction`, `AssetGoal`, `Dividend`
- [x] `seed.ts` com dados de exemplo (mesmos ativos do protótipo Figma)
- [ ] Rodar a primeira migration e o seed

**Decisões técnicas:**
- `Decimal` para valores monetários — nunca `Float` (evita erros de arredondamento binário)
- Posição da carteira é **derivada** das transações, nunca armazenada (fonte única de verdade)
- Enum `AssetType` extensível (CRIPTO, INTERNACIONAL entram sem quebrar nada)
- Nomes de tabelas/colunas em `snake_case` via `@map`/`@@map` (convenção SQL)

## 🔐 Sprint 2 — Autenticação

**Objetivo:** registrar, logar e acessar uma rota protegida via cookie.

- [x] `POST /auth/register` — validação com Zod, hash com bcrypt
- [x] `POST /auth/login` — JWT em cookie `HttpOnly` + `Secure` + `SameSite=Strict`
- [x] `POST /auth/logout` e `GET /auth/me` (rota protegida)
- [x] Middleware `authGuard` que valida o token e injeta `userId` na request
- [x] Testes de integração (Vitest + Supertest): registro duplicado, senha errada, token expirado — 9 testes passando

## 💼 Sprint 3 — API da Carteira

**Objetivo:** consultar a posição consolidada calculada a partir das transações.

- [ ] CRUD de `Transaction` (compra/venda) e `Dividend`
- [ ] `PortfolioService`: preço médio ponderado, quantidade atual, valor aplicado, lucro/prejuízo
- [ ] `GET /portfolio/summary` — patrimônio total e alocação atual por classe

## ⚖️ Sprint 4 — Motor de Rebalanceamento (coração do produto)

**Objetivo:** dado R$ 1.500, o sistema diz o que comprar.

- [ ] CRUD de `AssetGoal` (pesos-alvo, validar soma ≤ 100%)
- [ ] `RebalanceService`: algoritmo guloso — ordena por maior déficit (`peso_alvo − peso_atual`), aloca em unidades inteiras
- [ ] Testes unitários: aporte insuficiente para 1 cota, carteira vazia, todos acima da meta, empate de déficit
- [ ] Documentar complexidade: O(n log n) da ordenação + O(n) da alocação

## 🎨 Sprint 5 — Frontend: fundação e auth

- [ ] Next.js (App Router) + Tailwind + shadcn/ui
- [ ] Telas de login/registro consumindo a API
- [ ] `middleware.ts` protegendo rotas autenticadas
- [ ] Layout base com a sidebar do [protótipo Figma](https://www.figma.com/design/G153Uuy3Gwt3I0SNarOn6f)

## 📊 Sprint 6 — Dashboard e Carteira (telas 1 e 2 do Figma)

- [ ] Recharts: rosca (alocação por classe), barras (proventos mês a mês), setores (exposição setorial)
- [ ] Tabela interativa de ativos com lucro/prejuízo colorido

## 🧮 Sprint 7 — Calculadora de Aportes (tela 3 do Figma)

- [ ] Formulário de simulação + resultado com prioridades e comparação antes/depois
- [ ] Registro de proventos e histórico

## 🤖 Sprint 8 — Módulo IA de Relatórios

- [ ] Upload de PDF (`multer`) e extração de texto (`pdf-parse`)
- [ ] Integração com LLM: resumo executivo, alertas (vacância, emissões, dividendos), chat "Pergunte ao Relatório"

## 📰 Sprint 9 (opcional) — Notícias e Deploy

- [ ] Feed de notícias (API brapi.dev — gratuita para B3)
- [ ] Deploy (backend + banco gerenciado + frontend)

---

## Conexão com as disciplinas do 4º semestre

| Disciplina | Onde aparece |
|-----------|--------------|
| Banco de Dados Relacional | Sprint 1 — modelagem, normalização, migrations, SQL |
| Construção e Análise de Algoritmos | Sprint 4 — algoritmo guloso de rebalanceamento e análise de complexidade |
| Desenvolvimento de Plataformas Web | Sprints 2, 3, 5–7 — API REST, auth, frontend |
| Métodos Quantitativos | Sprints 3 e 6 — preço médio ponderado, alocação percentual, gráficos |
| Projeto e Arquitetura de Sistemas | Todo o projeto — camadas Controller/Service/Repository, SOLID |
