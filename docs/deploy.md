# Plano de deploy

Plano decidido pelo dono em **12/11/2026**: tudo em plano gratuito.

| Peça | Onde | Plano | Situação em 12/11/2026 (só leitura nas contas) |
|---|---|---|---|
| Banco | Supabase, projeto `portfoliolab` (`sa-east-1`, Postgres 17) | Free | ativo; **12 de 13 migrations** aplicadas (falta `20261030135000_add_fk_asset_id_indexes`); RLS ligado nas 12 tabelas, sem policy; `anon`/`authenticated` ainda com GRANT; `index_points` vazia (o backfill nunca rodou); 7 usuários, 21 transações, 11 relatórios antigos, `cvm_summaries` vazia |
| API (`backend/`) | Render, web service Node | **Free** | **não existe**. O Render tem um workspace só ("Workspace de projetos"); a última leitura dos serviços (28/10) mostrava só `circula-api`, de outro repositório, suspenso |
| Site (`frontend/`) | Vercel | **Hobby** | **não existe**: o time `francismagno` não tem nenhum projeto |
| CI | GitHub Actions | — | roda em todo PR e push na `main` (backend com Postgres 16 e frontend) |

**Docker não é usado em produção.** O Render roda o Node direto (`runtime: node`, `npm start`), e a Vercel faz o
build do Next. O `backend/docker-compose.yml` é só o Postgres do desenvolvimento local e dos testes.

A API continua um processo Express comum (`src/server.ts` com `listen`), sempre no ar enquanto o Render não a
põe para dormir. Nada aqui é serverless.

O serviço do Render está descrito em [`render.yaml`](../render.yaml) (Blueprint), com os nomes das variáveis e
nenhum valor secreto. O arquivo não cria nada sozinho: vale quando alguém cria o Blueprint no painel.

A tabela acima é a última leitura das contas (12/11/2026). A revisão de 13/11/2026 não abriu nenhuma conta nem
chamou serviço externo: o que segue sobre o código foi conferido no repositório.

## O que ainda falta para o primeiro deploy

Nada no código impede o deploy. A memória da CVM, que era o bloqueio, está corrigida (seção seguinte). O que
falta são passos do dono e duas pendências que convém decidir antes de abrir o site ao público:

1. **Passos do dono, com OK explícito** (P1 a P8, mais abaixo): migration pendente no Supabase, criar o serviço
   no Render e o projeto na Vercel, conta demo, histórico dos índices e o monitor do `/health`.
2. **Teto de login compartilhado** (pendência "IP do visitante"): com a cadeia Vercel → Render e
   `TRUST_PROXY=1`, os limitadores podem enxergar um IP só para todo mundo. Dez tentativas erradas de login em
   15 min, de qualquer pessoa, travariam o login (e o botão da demo) do site inteiro. Conferir no primeiro deploy,
   antes de divulgar o endereço.
3. **CI verde na `main`** (item 0 abaixo). O CI roda typecheck, testes e build; esta revisão rodou só o que não
   escreve em banco (tsc, `prisma validate`, lint e typecheck do front, todos limpos).

## Memória da leitura da CVM: corrigido (era o bloqueio do plano gratuito)

O Render gratuito (e o Starter pago) tem **512 MB**. Antes da correção, a primeira ficha de ação com dado vencido
derrubava o processo por falta de memória, e o mesmo valia para um relatório de ação em `/relatorios`.

**A causa.** `lerCsvsDoZip` (`modules/reports/cvm.provider.ts`) decodificava cada CSV inteiro do zip numa string (o
BPP individual do ITR de 2025 tem 93 MB descompactado), e o Node guarda strings grandes fora do heap ("external").
Por isso `--max-old-space-size` não resolvia: o `heapUsed` nunca passou de 20 MB.

**A correção.** `lerCsvsDoZip(zip, nomes, cnpj)` procura o CNPJ nos bytes (`Buffer.indexOf`) e decodifica só o
cabeçalho e as linhas que o contêm; o CNPJ é ASCII e o latin1 tem um byte por caractere, então a busca em bytes acha
exatamente as linhas que a busca no texto achava. Os CSVs são descompactados um de cada vez (antes, os quatro de um
documento ficavam em memória juntos). `montarDadosAcao`, `montarDadosFii` e `linhasComCnpj` não mudaram: recebem um
CSV menor no mesmo formato. `buscarPatrimonioDeClasses` (vários CNPJs, 16 MB) continua lendo o arquivo inteiro.
Junto, dois tetos defensivos: zip acima de 128 MB não é aceito (o maior real tem 32 MB) e CSV que declara mais de
256 MB descompactado é ignorado sem ser descompactado (o fflate aloca o tamanho declarado de uma vez).

**Prova de que os números não mudaram.** Sobre os zips reais da CVM baixados em 12/11/2026 (ITR 2025 e 2026, DFP
2025, Informe Mensal de FII 2026), a leitura nova contra a antiga (CSV inteiro decodificado, como antes): as 15 ações
do catálogo em 7 trimestres (1T25 a 3T26) e os 15 FIIs em 10 meses de 2026, **255 comparações, 255 idênticas**
(o JSON inteiro de `DadosAcao`/`DadosFii`, 1.920 contas de ações). `cvm.leitura.test.ts` repete a comparação com
zips sintéticos e os casos de borda (`
`, sem quebra no fim, `;` entre aspas, CNPJ noutra coluna, CNPJ sem
máscara, arquivo só com cabeçalho, vazio). `VERSAO_DA_ANALISE` não sobe: o texto não muda.

**Medido em 12/11/2026, Node 24, nesta máquina** (Windows; o pico é o `PeakWorkingSet` do processo, o equivalente ao
RSS máximo):

| Cenário | Antes | Depois |
|---|---|---|
| Um ITR só (o que `POST /reports` faz), script isolado, zip do disco | 415 MB, 0,6 s | **204 MB**, 0,3 s |
| Ficha de PETR4 com dado vencido (7 trimestres), script isolado | 1.614 MB, 4,2 s | **280 MB**, 2,6 s |
| Catálogo inteiro (15 ações, 15 FIIs, ETFs), script isolado | 1.793 MB, 61 s | **308 MB**, 32 s |
| API de verdade (`node dist/server.js`), parada | ~145 MB (medição anterior) | 91 MB, 133 MB de pico na subida |
| API: 3 fichas de ação, 2 de FII e 1 de ETF com dado vencido, downloads reais | 1.649 MB só na primeira | **317 MB** de pico |
| API: aquecimento do catálogo inteiro (40 ativos), downloads reais | — | **362 MB** de pico, ~95 s de CPU, 268 MB no fim |

Sobram ~150 MB de folga no pior caso medido. O que fica em memória depois são os zips compactados no cache de
`baixarZipCvm` (6 h): ITR 2026 (22 MB), ITR 2025 (32 MB), DFP 2025 (13 MB), Informe de FII (1 MB) e o cadastro de
classes (7 MB). No 3º trimestre de cada ano o ITR do ano corrente cresce até o tamanho do de 2025.

**As duas filas (`naFilaDaCvm` no `reports` e a fila pesada de `ativos.snapshots.ts`) continuam separadas.** Elas não
somam memória de leitura: depois do download, `buscarDadosAcao` e `buscarDadosFii` leem e montam o dado sem nenhum
`await`, então duas leituras nunca se intercalam, seja qual for a fila. O que pode coincidir são dois downloads (até
32 MB cada) e o lixo da leitura anterior que o coletor ainda não recolheu, e uma fila só não mudaria isso. Se o
primeiro deploy mostrar reinício por memória, o próximo passo é limitar o cache de zips (um ano por documento), não
unir as filas.

**Já feito nesta branch.** A variável `AQUECER_CATALOGO` (padrão `true`, que mantém o comportamento de antes)
desliga o aquecimento do catálogo ao subir. O `render.yaml` a põe em `false`, mesmo com a memória corrigida. Motivos:

- Com 0,1 CPU, os ~100 s de CPU que o aquecimento gasta nesta máquina viram muitos minutos de processador ocupado a
  cada vez que o serviço acorda ou reinicia, e as requisições esperam atrás.
- A memória cabe (362 MB de pico, medido acima), mas não sobra muita folga para as visitas que chegam no meio.
- As fichas continuam se renovando por visita, uma de cada vez, e a fotografia fica 24 h no banco
  (`asset_snapshots`). Sem o aquecimento, só o primeiro visitante de cada ficha espera a CVM, e no máximo 8 s.

`AQUECER_CATALOGO=false` desliga também o aquecimento das séries de índices (`indicesService.aquecer`, em
`server.ts`): mesmo sendo só rede (Banco Central, Yahoo e B3), com 0,1 CPU ele estourava os 5 s do health check
logo depois da subida, e o Render reiniciava o serviço. As séries continuam preguiçosas: o primeiro
`GET /indices/dados` monta e guarda cada uma, e o histórico da B3 entra em segundo plano.

## Limites do Render gratuito

Conferido em 12/11/2026 em [render.com/docs/free](https://render.com/docs/free) e na
[especificação do Blueprint](https://render.com/docs/blueprint-spec):

| Limite | Valor | O que isso faz com o PortfolioLab |
|---|---|---|
| CPU e RAM | 0,1 CPU, 512 MB | ver a seção da memória acima; leitura da CVM é CPU síncrona e fica ~10 vezes mais lenta |
| Sono | dorme depois de **15 min** sem tráfego de entrada; acordar leva "cerca de um minuto" | primeira requisição depois do sono espera; ver "Contra o sono" |
| Horas | **750 h/mês por workspace**; acabou, o serviço é suspenso até o mês seguinte | um serviço acordado o mês inteiro gasta até 744 h: cabe, se for o **único** serviço gratuito acordado no workspace |
| Reinício | "o Render pode reiniciar um serviço gratuito a qualquer momento" | caches em memória (Yahoo, zips da CVM, séries do SGS) se perdem; o que importa está no banco (`asset_snapshots`, `index_points`) |
| Disco | sem disco persistente | o app não grava arquivo; nada muda |
| Instâncias | uma só, sem escala | os limitadores em memória ficam corretos |
| `preDeployCommand` | só em plano pago | a migration não roda no deploy (ela já é manual) |
| Shell e jobs avulsos | não há | `indices:backfill` e `supabase:migrate` rodam da máquina do dono |
| Portas de saída 25, 465, 587 | bloqueadas | o app não manda e-mail |
| Região | `oregon` (padrão), `ohio`, `virginia`, `frankfurt`, `singapore`; não muda depois | **`virginia`**: o Render não tem América do Sul, e o banco está em São Paulo (~120 ms por ida e volta) |
| Banda e minutos de build | descontam da cota mensal do workspace | conferir no painel de Billing |

**Vercel Hobby** ([limites](https://vercel.com/docs/limits), conferido em 12/11/2026): o rewrite para uma origem
externa (`/api/*` → `API_URL`) espera até **120 s** pelo primeiro byte, em todos os planos. Funções têm até 300 s.
O Hobby é para uso pessoal e não comercial.

## Contra o sono do plano gratuito

**Estratégia: um monitor externo gratuito chama `GET /health` da API a cada 10 a 14 min** (menos que os 15 min do
sono). Por exemplo, um monitor HTTP do UptimeRobot ou um agendamento do cron-job.org. Nada foi criado; é decisão e
conta do dono. O `/health` faz `SELECT 1` no banco, então o mesmo ping:

- impede o Render de pôr a API para dormir, e com isso o cold start some quase sempre;
- mantém o Supabase em uso: o projeto gratuito é pausado depois de uma semana sem atividade;
- avisa quando o banco cai, porque o `/health` responde 503.

Custo: o serviço fica acordado o mês inteiro, até 744 das 750 h do workspace. Se outro serviço gratuito for
criado no mesmo workspace, as horas não fecham. O `/health` passa pelo limitador global (500 por 15 min por IP), e
um ping a cada 10 min gasta 1,5 disso.

**Se a API estiver dormindo mesmo assim** (monitor fora, reinício):

- Home: já tem a reserva. A seção de números chega com `NUMEROS_DO_MES` e o navegador tenta de novo por 25 s.
- Fichas de `/ativos` e páginas de índices: o servidor do Next espera 20 s (`ativos-api.ts`, `indices-api.ts`) e
  mostra "não conseguimos buscar agora". A próxima visita, com a API acordada, vem normal.
- Login, cadastro e área logada: `api()` (`lib/api.ts`) não tem prazo próprio. A requisição espera o Render
  acordar (cerca de 1 min), dentro dos 120 s do rewrite da Vercel.
- **O botão "Ver a demonstração" já avisa**: depois de 4 s sem resposta, mostra "Acordando o servidor gratuito.
  Na primeira visita do dia isso leva até um minuto." (`components/site/botao-demo.tsx`). **O login e o cadastro
  ainda não**: o botão fica parado, sem explicação. Levar o mesmo aviso para eles é mudança de tela (skills
  `frontend-design` e `web-design-guidelines`). Com o ping ligado, quase nunca aparece.

O `proxyTimeout: 120_000` do `next.config.ts` só vale no `next start`/`next dev`. Na Vercel, o rewrite externo é
feito pela CDN, com o mesmo limite de 120 s. Os dois números batem, e nenhuma mudança é necessária. Uma consulta
de relatório muito lenta (download de 20 MB da CVM com 0,1 CPU) pode passar de 120 s e voltar 504; o relatório
continua sendo gravado quando termina, e uma nova consulta o encontra.

## Banco: conexão do Prisma

A API é um processo longo, então a conexão é a do **Session pooler** do Supabase (porta **5432**), que fala IPv4.
A conexão direta (`db.<ref>.supabase.co`) é só IPv6 no plano gratuito, e o Render não documenta saída por IPv6 (os
relatos na comunidade dizem que não há). Formato (sem
valores reais em lugar nenhum do repositório):

```
postgresql://postgres.<ref>:<senha>@aws-<n>-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=5
```

- `connection_limit=5`: o Prisma abre `núcleos × 2 + 1` conexões por padrão, e no Render o número de núcleos que o
  Node enxerga é o da máquina, não o 0,1 CPU do plano. No modo sessão, cada conexão do Prisma ocupa uma do pool do
  Supabase, que é pequeno no plano gratuito e também atende a sua máquina (`supabase:migrate`, Studio). Cinco
  bastam para uma instância.
- Sem `pgbouncer=true`: isso é para o Transaction pooler (6543), que não é o caso.
- A senha vai com percent-encoding se tiver caracteres especiais (`@`, `:`, `/`, `?`, `#`, `%`).
- O `schema.prisma` usa só `url = env("DATABASE_URL")`. Os scripts `supabase:*` leem o `backend/.env.supabase`,
  que hoje usa a conexão direta. Isso funciona da sua máquina, se ela tiver IPv6, mas para o Render vale a do pooler.
  O `backend/.env.supabase.example` mostra o formato do pooler.

## Variáveis de ambiente

**API (Render):**

| Variável | Origem | Observação |
|---|---|---|
| `NODE_ENV` | `production` (no `render.yaml`) | liga o cookie `Secure`, a checagem do `JWT_SECRET` e o aquecimento (se `AQUECER_CATALOGO` deixar) |
| `NODE_VERSION` | `22` (no `render.yaml`) | a mesma versão maior do CI |
| `DATABASE_URL` | **você cola** no painel (`sync: false`) | Session pooler, com `?connection_limit=5` (ver acima) |
| `JWT_SECRET` | **o Render sorteia** (`generateValue: true`, 256 bits em base64, 44 caracteres) | a API recusa subir em produção com menos de 32 caracteres ou com placeholder conhecido. Trocar depois desloga todo mundo |
| `AQUECER_CATALOGO` | `false` (no `render.yaml`) | ver a seção de memória |
| `TRUST_PROXY` | não definir no começo (padrão `1`) | ver "IP do visitante" nas pendências. Precisa ser número: texto derruba o boot |
| `PORT` | o Render define | não colocar |

Não há outra variável que a API leia (`config/env.ts`). Segredo de IA, de Yahoo ou de CVM não existe: as fontes
são públicas.

**Site (Vercel):**

| Variável | Valor |
|---|---|
| `API_URL` | endereço público da API, ex. `https://portfoliolab-api.onrender.com`, sem barra no fim. Em Production (e Preview, se for usar) |
| `ATIVOS_REVALIDAR_S` | não definir (padrão 120 s de cache das leituras feitas no servidor). Só o E2E põe `0` |

`NEXT_DIST_DIR` também é só do E2E. O `NODE_ENV` a Vercel define sozinha.

O navegador nunca fala direto com a API: o Next reescreve `/api/*` para `API_URL`, então tudo fica na mesma
origem, o cookie `SameSite=Strict` funciona e não há CORS a configurar. As páginas de ativos e índices também leem
`API_URL` no servidor do Next. Sem `API_URL`, o front tenta `localhost:3333` e essas páginas ficam sem dado.

**`API_URL` entra no build.** Na Vercel, o `rewrites()` do `next.config.ts` é avaliado no build e vai para o
manifesto de rotas que a CDN aplica, então o destino de `/api/*` fica fixo em cada deploy. Definiu ou trocou `API_URL` depois do primeiro build? Faça um redeploy na Vercel,
ou o login e a área logada continuam apontando para o endereço antigo (ou para `localhost:3333`). As páginas de
ativos e índices leem a variável em tempo de execução e não têm esse problema.

**Desenvolvimento local.** O `backend/.env.example` vem com `JWT_SECRET=""`. Vazio não é "ausente": o padrão
`dev-secret` de `env.ts` só vale quando a variável não existe, e a string vazia reprova o `min(1)`. Copiado sem
mexer, o `.env` faz a API recusar subir também em desenvolvimento. Preencha com `openssl rand -base64 32` ou
apague a linha.

**Cache da CDN da Vercel.** Projetos criados depois de 06/04/2026 respeitam o `Cache-Control` que a origem externa
manda nos rewrites. A API só manda `public, max-age=60` em `/ativos` e `/indices`, que são públicas. As rotas com
login não mandam `Cache-Control` e não são guardadas. Se algum dia uma rota com login mandar `public`, a CDN
serviria a resposta de uma pessoa para outra: nunca faça isso.

## Passo a passo do primeiro deploy

### 0. Antes de tudo (não escreve em lugar nenhum)

- [x] Aplicar a correção de memória da CVM (seção "Memória da leitura da CVM"), com os testes do `reports` e do `ativos`.
- [ ] CI verde na `main`.
- [ ] `git ls-files | grep "\.env"` mostra só `backend/.env.example` e `backend/.env.supabase.example`.
- [ ] O `backend/.env.supabase` local ainda tem uma `GEMINI_API_KEY` de quando os relatórios usavam IA. O app não lê
      mais essa variável: apague a linha e revogue a chave no Google AI Studio.

### 1. Decisões e ações do dono

1. **Workspace do Render**: só existe um, "Workspace de projetos". Confirmar que é nele que a API entra, e que
   nenhum outro serviço gratuito vai ficar acordado ali (as 750 h são do workspace).
2. **Time da Vercel**: só existe `francismagno`. Confirmar.
3. **Monitor do `/health`**: escolher o serviço (UptimeRobot, cron-job.org…) e criar depois que a API existir.
4. **Domínio**: sem domínio próprio, o site fica em `*.vercel.app` e a API em `*.onrender.com`.
5. **Revogar os GRANTs de `anon`/`authenticated`** (opcional, recomendado): ver passo P2 abaixo.
6. Dar o OK, passo a passo, para cada item da seção seguinte.

## Passos que escrevem na produção, só com OK do dono

Nada abaixo foi executado. Cada passo é uma escrita e espera um "pode" explícito.

**P1. Migration `20261030135000_add_fk_asset_id_indexes`** (aditiva: três `CREATE INDEX` em `asset_goals`, `reports` e
`dividends`, nas colunas `asset_id`). Tabelas pequenas (dezenas de linhas), então o bloqueio de escrita do
`CREATE INDEX` dura milissegundos. Da pasta `backend/`:

```bash
node --env-file=.env.supabase node_modules/prisma/build/index.js migrate status   # leitura: mostra o host e 1 pendente
npm run supabase:migrate                                                            # escrita
node --env-file=.env.supabase node_modules/prisma/build/index.js migrate status   # "Database schema is up to date"
```

Pode ir antes do código: nada no código depende desses índices.

**P2. (Opcional) Revogar os GRANTs de `anon` e `authenticated`.** Hoje só o RLS impede a Data API do Supabase de ler
as tabelas, inclusive `users`. O script, com a conferência prévia de que o papel da `DATABASE_URL` é dono das tabelas
ou tem BYPASSRLS, está em
[`backend/prisma/manual/revogar-grants-anon-authenticated.sql`](../backend/prisma/manual/revogar-grants-anon-authenticated.sql).
Ele fica fora de `prisma/migrations` de propósito: `anon` e `authenticated` não existem no Docker nem no CI, e assim ele
não vai junto num `supabase:migrate`. Ele aborta sozinho se for rodado no lugar errado. Não foi executado em banco
nenhum (a criação de papéis de teste no Docker compartilhado não foi autorizada). O comando e a conferência estão no
cabeçalho do arquivo. Depois: `get_advisors` de segurança no Supabase.

**P3. Criar o web service no Render** (workspace confirmado pelo dono). Pelo Blueprint (`render.yaml`) ou à mão, com
os mesmos campos:

| Campo | Valor |
|---|---|
| Repositório / branch | `Franmagno06/PortfolioLab`, `main` |
| Nome | `portfoliolab-api` |
| Runtime | Node |
| Plano | Free |
| Região | Virginia (`virginia`) |
| Root directory | `backend` |
| Build command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |
| Auto-deploy | a cada commit, com filtro `backend/**` |
| Variáveis | as da tabela "API (Render)" acima: `DATABASE_URL` colada no painel, `JWT_SECRET` sorteado |

**P4. Primeiro deploy da API e conferência.** O deploy sai sozinho quando o serviço é criado. Conferir, só lendo:

- [ ] O log de subida tem `🚀 API rodando` e `🗄️  Banco: SUPABASE (produção) — aws-…pooler.supabase.com:5432/postgres`.
      Se aparecer `LOCAL`, `REMOTO` ou `db.…supabase.co`, a `DATABASE_URL` está errada.
- [ ] `curl -s https://<servico>.onrender.com/health` devolve `{"status":"ok","service":"portfoliolab-api","database":"ok"}`.
- [ ] Nenhum `P2021`/`P2022` no log (se aparecer, alguma migration não foi aplicada: P1).
- [ ] Uma ficha de ação (`/ativos/acoes/PETR4`) e, nas métricas do Render, a memória abaixo de 512 MB.

**P5. Criar o projeto na Vercel** (time confirmado pelo dono):

| Campo | Valor |
|---|---|
| Repositório / branch | o mesmo, `main` |
| Root Directory | `frontend` |
| Framework | Next.js (build e start padrão) |
| `API_URL` | a URL do passo P4, sem barra no fim, em Production (e Preview, se for usar) |

**P6. Conta de demonstração.** `npm run supabase:demo` apaga e refaz **só** a conta `carteira@portfoliolab.dev`.
Os relatórios dela vêm de `reportsService.consultar`, o mesmo caminho da rota, e vão para o cache compartilhado
`cvm_summaries`. Rodar da sua máquina (não no Render).

**P7. Histórico dos índices.** `npm run indices:backfill` lê o `.env` (Docker). Contra a produção, o próprio script
indica: `npx tsx --env-file=.env.supabase scripts/backfill-indices.ts`. Ele preenche `index_points` com o histórico da
B3 desde 2011; a tabela só cresce (`createMany` com `skipDuplicates`). Sem ele, a API busca o histórico em segundo
plano na primeira leitura, mas com 0,1 CPU e sujeita a reinício; da sua máquina é mais rápido e certo. A primeira
linha que o script imprime é o banco de destino: tem de ser `SUPABASE (produção)`.

**P8. Monitor do `/health`**, a cada 10 a 14 min, na conta escolhida pelo dono.

### Conferência do site depois do deploy

- [ ] Home abre e "Ativos e índices" mostra os números do dia (não "Referência fixa"), com o minigráfico.
- [ ] Uma ficha de ação, uma de FII, uma de ETF e uma de índice abrem com preço e gráfico.
- [ ] Login da demo, carteira, dashboard e simulação; escrita da demo recusada com 403.
- [ ] Cadastro e login de uma conta nova; logout. O cookie `token` vem com `Secure`, `HttpOnly` e `SameSite=Strict`.
- [ ] Relatórios: numa conta comum, buscar `BBAS3` traz o último ITR, e a memória do Render continua abaixo de 512 MB.
- [ ] Cabeçalhos de segurança no site (CSP, HSTS, X-Frame-Options) e na API (helmet).
- [ ] IP do visitante nos limitadores (pendência abaixo).
- [ ] As páginas públicas respondem `Cache-Control: public, max-age=60` (`curl -sI https://<site>/api/indices/dados`)
      e uma rota logada não traz `Cache-Control: public` (`curl -sI https://<site>/api/auth/me` volta 401 sem ele).
- [ ] Uma transação numa conta comum: compra, venda e exclusão, e a posição da carteira bate.

### Como verificar depois, sem escrever nada

| O quê | Como |
|---|---|
| API no ar e banco respondendo | `curl -s https://<api>.onrender.com/health` |
| Qual banco a API usa | log de subida do Render: `🗄️  Banco: SUPABASE (produção) — …pooler.supabase.com:5432/postgres` |
| Migration aplicada | ausência de `P2021`/`P2022` no log; `migrate status` da sua máquina (leitura) |
| Memória | métricas do Render: pico abaixo de 512 MB depois de abrir uma ficha de ação com dado vencido e um relatório |
| Rewrite do site | `curl -s https://<site>/api/health` devolve o mesmo JSON do `/health` da API |
| Índices | `curl -s https://<site>/api/indices/dados` com `selicMensal` e `pontos.ibovespa` não vazios |
| Sono | o monitor do `/health` registra 200 a cada 10 a 14 min |

## Pendências técnicas

| Prioridade | Item | Por quê / como |
|---|---|---|
| Feito | Memória da leitura da CVM | corrigida; conferir a memória nas métricas do Render no primeiro deploy (P4) |
| **Alta** | **IP do visitante nos limitadores.** A Vercel manda o IP do visitante em `x-forwarded-for` para a origem externa (documentado), e o proxy do Render acrescenta o IP da Vercel. Com `TRUST_PROXY=1` (padrão), a API enxerga o IP da Vercel, que é de todos, e o teto de login (10 por 15 min) vira do site inteiro. | No primeiro deploy, logar `req.ip` e `x-forwarded-for` (sem cookies) de duas redes diferentes. Se a cadeia for visitante → Vercel → Render, `TRUST_PROXY=2` dá o IP real. Atenção: com 2, quem chamar o `*.onrender.com` direto pode forjar o IP. Para fechar isso, a Vercel pode mandar um cabeçalho secreto no rewrite e a API recusar quem não o tiver: mudança própria, com a skill `security-and-hardening` |
| Alta | **Dependências do backend.** Em 13/11/2026, `npm audit --omit=dev` aponta 5 (4 altas, 1 baixa): `zod` < 4.6.6 (só sai com a versão 4), `fast-xml-parser` ≤ 5.11.2 e `deepmerge-ts` via CLI do Prisma (saem com `npm audit fix`). O frontend não tem nenhuma. | Tarefa própria, com a bateria completa de testes |
| Média | **Aviso de "acordando o servidor"** no login e no cadastro (a demo já tem) | seção "Contra o sono" |
| Média | **Dinheiro somado em `number`** no resumo da carteira (`portfolio.service.ts:getSummary` soma valores já arredondados), na soma das metas (`goals.service.ts`) e em partes do dashboard | Contra a convenção do projeto. Revisar com `auditar-calculo-financeiro` |
| Média | **Rotas lentas no Render gratuito.** `GET /indicators` renova os indicadores vencidos ali mesmo, um ativo por vez; `POST /dividends/sync` consulta o Yahoo um ativo por vez (até 8 s cada); `POST /reports` espera a fila da CVM sem prazo. Com muitos ativos, as três podem passar dos 120 s do rewrite da Vercel e voltar 504 | O mesmo molde das fichas de Ativos: prazo curto na rota (`comLimiteDeTempo`), a busca segue em segundo plano e grava, e a resposta sai com o que já existe |
| Baixa | Limitadores em memória | Corretos com uma instância, que é o único caso no plano gratuito |
| Baixa | Job de indicadores (`npm run job:indicadores`) | Opcional: a atualização já é preguiçosa. o Cron Job do Render é cobrado (não entra no gratuito); se quiser, rode da sua máquina |

## Depois do primeiro deploy

Cada push na `main` publica sozinho a API (Render, só se mudou algo em `backend/`) e o site (Vercel). A única coisa
manual continua sendo a migration: ela vai para o Supabase **antes** do push que a contém. O roteiro de cada
publicação está na skill `deploy-producao`.
