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

- [x] CRUD de `Transaction` (compra/venda) e `Dividend`
- [x] Validação de venda: não é possível vender mais do que se possui
- [x] `PortfolioService`: preço médio ponderado, quantidade atual, valor aplicado, lucro/prejuízo
- [x] `GET /portfolio/summary` — patrimônio total e alocação atual por classe
- [x] Consulta de ativos e busca por ticker (`GET /assets`, `GET /assets/:ticker`)
- [x] 14 testes novos: 8 unitários do preço médio + 6 de integração do fluxo completo

## ⚖️ Sprint 4 — Motor de Rebalanceamento (coração do produto)

**Objetivo:** dado R$ 1.500, o sistema diz o que comprar.

- [x] CRUD de `AssetGoal` (pesos-alvo, validar soma ≤ 100%)
- [x] `RebalanceService`: algoritmo guloso — ordena por maior déficit (`peso_alvo − peso_atual`), aloca em unidades inteiras
- [x] Testes unitários: aporte insuficiente para 1 cota, carteira vazia, todos acima da meta, empate de déficit
- [x] Documentar complexidade: O(n log n) da ordenação + O(n) da alocação — ver [algoritmo-rebalanceamento.md](algoritmo-rebalanceamento.md)
- [x] 14 testes novos (8 unitários do algoritmo + 6 de integração) — 37 no total

## 🎨 Sprint 5 — Frontend: fundação e auth

- [x] Next.js 16 (App Router) + Tailwind v4 — shadcn/ui adiado para quando tabelas/diálogos precisarem (evitar dependência antes da hora)
- [x] Telas de login/registro consumindo a API (com auto-login após registro)
- [x] `proxy.ts` protegendo rotas autenticadas (convenção nova do Next 16, ex-`middleware.ts`)
- [x] Rewrite `/api/*` → backend: sem CORS e cookie funcionando naturalmente
- [x] Layout base com a sidebar do [protótipo Figma](https://www.figma.com/design/G153Uuy3Gwt3I0SNarOn6f)
- [x] Dashboard inicial com dados reais: cards de patrimônio/lucro/proventos e barras de alocação por classe

## 📊 Sprint 6 — Dashboard e Carteira (telas 1 e 2 do Figma)

- [x] Recharts: rosca (alocação por classe) e barras (proventos mês a mês); exposição setorial fica para quando houver dados de setor por posição
- [x] Tabela de ativos completa: preço médio, resultado colorido, % da carteira com barras
- [x] Identidade visual "editorial financeiro": Space Grotesk + JetBrains Mono (números tabulares), navy/papel/esmeralda, animações de entrada escalonadas, logomarca SVG

## 🧮 Sprint 7 — Calculadora de Aportes (tela 3 do Figma)

- [x] Formulário de simulação + resultado com prioridades e comparação antes/depois (barras com marcador de meta)
- [x] Editor de metas de alocação na própria tela (soma validada, adicionar/editar)
- [x] Registro de transações (compra/venda) direto na Carteira, com validação da API na tela
- [x] Registro de proventos e histórico na Carteira

## 🤖 Sprint 8 — Módulo IA de Relatórios

- [x] Upload de PDF (`multer` em memória, limite 10 MB) e extração de texto (`unpdf`)
- [x] Integração com a API do Claude (`@anthropic-ai/sdk`, modelo `claude-opus-4-8`): resumo executivo, alertas com severidade (vacância, emissões, dividendos) e indicadores citados
- [x] **Structured outputs** (JSON Schema): a análise volta como JSON válido garantido pela API
- [x] **Prompt caching** no chat: o texto do relatório fica em cache entre perguntas (~90% mais barato)
- [x] Chat "Pergunte ao Relatório" com histórico mantido no cliente
- [x] Tabela `reports` no banco (texto extraído + análise em JSON)
- [x] Tela `/relatorios`: upload, lista, resumo, alertas coloridos e chat

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
