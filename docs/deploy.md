# Plano de deploy

Estado levantado em **28/10/2026**, só com leitura nas contas ligadas ao projeto.

| Peça | Onde deve ficar | Situação hoje |
|---|---|---|
| Banco | Supabase, projeto `portfoliolab` (`sa-east-1`, Postgres 17) | **pronto**: ativo e saudável, as 12 migrations aplicadas, RLS ligado em todas as tabelas |
| API (`backend/`) | Render, web service | **não existe**: o workspace do Render só tem `circula-api`, de outro repositório e suspenso |
| Site (`frontend/`) | Vercel | **não existe**: o time `francismagno` na Vercel não tem nenhum projeto |
| CI | GitHub Actions | verde na `main` (backend e frontend) |

Ou seja: o banco de produção está pronto e nada aponta para ele ainda. O que falta é criar os dois serviços e
ligar um ao outro. Como a `main` ainda não publica nada sozinha, o primeiro deploy é feito à mão, na ordem abaixo.

## Decisões que são suas

1. **Plano pago ou gratuito no Render.** No gratuito a API dorme depois de 15 min sem acesso, e a primeira
   requisição leva de 30 a 60 s para acordar. A home aguenta isso (mostra a referência fixa e troca pelos números
   reais quando a API responde), mas o login e a carteira ficam lentos na primeira visita. O plano Starter
   não dorme. Recomendação: Starter quando houver usuários de verdade; gratuito para a fase de portfólio.
2. **Região.** O banco está em São Paulo, e o Render não tem região na América do Sul. A mais próxima é
   Virginia (`us-east`). Cada consulta da API ao banco atravessa ~120 ms de ida e volta, e uma tela que faz
   várias consultas sente isso. Alternativa sem esse custo: hospedar a API em São Paulo (por exemplo Fly.io,
   região `gru`). Recomendação: começar no Render em Virginia, medir, e só mudar se a latência incomodar.
3. **Plano do Supabase.** No gratuito o projeto hiberna depois de ~1 semana sem uso, e a API passa a responder
   `503` até alguém reativar no painel. Um acesso regular (o próprio uso, ou um cron batendo em `/health`) evita.
4. **Domínio.** Sem domínio próprio, o site fica em `*.vercel.app` e a API em `*.onrender.com`.

## Passo a passo do primeiro deploy

### 0. Antes de tudo

- [ ] CI verde na `main` (hoje: verde).
- [ ] `git ls-files | grep "\.env"` mostra só `backend/.env.example` e `backend/.env.supabase.example`.
- [ ] Gerar o segredo da sessão: `openssl rand -base64 32` (a API recusa subir em produção com menos de 32
      caracteres ou com o valor de desenvolvimento).

### 1. API no Render (web service)

| Campo | Valor |
|---|---|
| Repositório / branch | `Franmagno06/PortfolioLab`, `main`, deploy automático por commit |
| Root directory | `backend` |
| Build command | `npm ci --include=dev && npx prisma generate && npm run build` (com `NODE_ENV=production` no ambiente, o `npm ci` pularia o TypeScript e o Prisma, que são devDependencies, e o build quebraria) |
| Start command | `npm start` |
| Health check path | `/health` (faz `SELECT 1`; banco hibernado vira `503`) |
| Região | Virginia (ver decisão 2) |

Variáveis de ambiente:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` (liga o cookie `Secure`, a checagem do `JWT_SECRET` e o aquecimento do catálogo) |
| `DATABASE_URL` | connection string do Supabase, **Session pooler** (porta 5432), em *Connect → ORM → Prisma* |
| `JWT_SECRET` | o segredo do passo 0 |
| `GEMINI_API_KEY` | opcional: sem ela só a tela de Relatórios responde `503` com a instrução |
| `GEMINI_MODEL` | opcional (padrão `gemini-3.6-flash`) |

O `PORT` vem do Render. A migration **não** roda no deploy: ela é manual (`npm run supabase:migrate`) e vai
**antes** do push que a contém (skill `deploy-producao`). Hoje não há nenhuma pendente.

Conferir depois de subir: o log imprime `🗄️ Banco: SUPABASE (produção)` e `GET /health` devolve
`{"status":"ok","database":"ok"}`.

### 2. Site na Vercel

| Campo | Valor |
|---|---|
| Repositório / branch | o mesmo, `main` |
| Root directory | `frontend` |
| Framework | Next.js (build e start padrão) |
| Variável `API_URL` | o endereço público da API, ex.: `https://portfoliolab-api.onrender.com` (sem barra no fim) |

Sem `API_URL` o front tenta `localhost:3333`, e todas as páginas que dependem da API ficam no estado de "não
conseguimos buscar agora". O navegador nunca fala direto com a API: tudo passa pelo `/api/*` do próprio site,
que o Next reescreve para `API_URL`. Por isso o cookie `SameSite=Strict` funciona e não há CORS a configurar.

### 3. Conta de demonstração em produção

O botão "Ver a demonstração" da home entra na conta `carteira@portfoliolab.dev`. Ela é criada (ou recriada) com
`npm run supabase:demo`, que apaga e refaz **só** essa conta. É escrita no banco de produção: rodar só com o seu OK.

### 4. Conferência depois do deploy

- [ ] Home abre e o bento "Ativos e índices" mostra os números do dia (não "Referência fixa"), com o minigráfico.
- [ ] Uma ficha de ação, uma de FII, uma de ETF e uma de índice abrem com preço e gráfico.
- [ ] Login da demo, carteira, dashboard e simulação; escrita da demo recusada com 403.
- [ ] Cadastro e login de uma conta nova; logout.
- [ ] Relatórios: com `GEMINI_API_KEY`, uma análise de PDF de `relatorios-para-teste/`.
- [ ] Cabeçalhos de segurança no site (CSP, HSTS, X-Frame-Options) e na API (helmet).
- [ ] Limite de requisições: ver o item "IP do visitante" abaixo.

## Pendências técnicas para fechar antes ou logo depois do primeiro deploy

| Prioridade | Item | Por quê |
|---|---|---|
| **Alta** | **IP do visitante nos limitadores.** A API usa `trust proxy = 1`. Atrás de Vercel → Render, o visitante chega por dois proxies, e o IP que a API enxerga tende a ser o do servidor do Next, igual para todo mundo. Aí o teto global (500 por 15 min) e o de login (10 por 15 min) passam a valer para o site inteiro, e um pico derruba o login de todos. | Conferir no primeiro deploy (logar `req.ip` de duas redes diferentes) e, se for o caso, ajustar a contagem de proxies por variável de ambiente. |
| Alta | **Dependências do backend.** `npm audit` aponta 4 altas que só saem com versão maior: `zod` 3 → 4 (memória ao validar coleções grandes; a API já limita o corpo JSON a 100 KB) e o CLI do Prisma (usado no build e na migration, não nas requisições). | Tarefa própria, com a bateria completa de testes. O frontend está sem vulnerabilidades. |
| Média | **Índices nas chaves estrangeiras** `dividends.asset_id`, `asset_goals.asset_id` e `reports.asset_id` (apontado pelo conselheiro de desempenho do Supabase). | Migration aditiva (`CREATE INDEX`), segura; vai para o Supabase antes do push que a contém. |
| Média | **Dinheiro somado em `number`** no resumo da carteira (`portfolio.service.ts`) e em partes do dashboard. | Contra a convenção do projeto (dinheiro é `Decimal`). Revisar com a skill `auditar-calculo-financeiro`. |
| Baixa | Limitadores em memória. | Corretos com **uma** instância da API. Com mais de uma, cada instância conta sozinha; aí precisam de um armazenamento compartilhado. |
| Baixa | Job de indicadores (`npm run job:indicadores`). | Opcional: a atualização já é preguiçosa a cada leitura. Se quiser, um Cron Job do Render 1 vez por dia. |

## Depois do primeiro deploy

Cada push na `main` publica sozinho a API (Render) e o site (Vercel). A única coisa manual continua sendo a
migration: ela vai para o Supabase **antes** do push que a contém. O roteiro de cada publicação está na skill
`deploy-producao`.
