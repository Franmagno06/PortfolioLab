# API do backend

Referência das rotas de `backend/src/modules/*/*.routes.ts`, tirada do código (rotas, `*.schemas.ts`,
controllers e services) em 13/11/2026. Mudou uma rota? Mude aqui também.

A API só fala JSON. Em desenvolvimento ela roda em `http://localhost:3333`; o navegador nunca a chama direto:
passa pelo `/api/*` do Next, que reescreve para `API_URL` (ver [frontend.md](frontend.md)). Nos exemplos abaixo
os caminhos são os do backend, sem o `/api`.

## Convenções que valem para todas as rotas

**Autenticação.** Cookie `token` (JWT HS256, `sub` = id do usuário, validade de 7 dias), gravado pelo
`POST /auth/login` com `HttpOnly`, `SameSite=Strict` e, com `NODE_ENV=production`, `Secure`. Não há cabeçalho
`Authorization`. Rota "logada" passa pelo `authGuard` (`shared/middlewares/auth-guard.ts`): sem cookie,
`401 {"error":"Não autenticado"}`; token inválido ou vencido, `401 {"error":"Sessão inválida ou expirada"}`.
O logout só apaga o cookie: o token continua válido até expirar (não há lista de revogação).

**Conta de demonstração.** Nos prefixos `/assets`, `/transactions`, `/dividends`, `/goals` e `/reports`, o
middleware `somenteLeituraNaDemo` vem depois do `authGuard` e recusa todo método que não seja `GET`, `HEAD` ou
`OPTIONS` quando o token tem a claim `demo: true` (ou, em token sem a claim, quando o e-mail da conta é o da
demo). A resposta é `403` com a mensagem fixa de `MENSAGEM_DA_DEMO` (`shared/conta-demo.ts`). A única escrita
liberada é `POST /dividends/sync`. Os prefixos `/portfolio`, `/indicators`, `/news`, `/quotes` e `/rebalance`
não montam o middleware: só têm `GET`, ou um `POST` que não grava (`/rebalance/simulate`).

**Erros.** Sempre `{"error": "mensagem"}`, montado pelo `errorHandler` (`shared/middlewares/error-handler.ts`):

| Situação | Status | Corpo |
|---|---|---|
| `AppError` lançado pelo service | o do erro | `{ error }` |
| Corpo que não é JSON válido | 400 | `{ error: "Corpo da requisição não é um JSON válido" }` |
| `ZodError` (entrada inválida) | 400 | `{ error: "Dados inválidos", issues: { campo: [mensagens] } }` |
| `PrismaClientInitializationError` (banco fora ou Supabase hibernado) | 503 | `{ error }` com a explicação |
| Qualquer outra exceção, inclusive erro conhecido do Prisma (P2002, P2020) | 500 | `{ error: "Erro interno do servidor" }` |
| Limitador estourado | 429 | `{ error }` com a mensagem do limitador |

**Dinheiro na resposta.** Os services convertem para `number` com 2 casas na saída (`em2Casas`). As listas que
devolvem a linha do Prisma (`GET /assets`, `GET /transactions`, `GET /dividends`) trazem os campos `Decimal`
**como string** (`"38.20"`), porque é assim que o `Decimal` vira JSON. O front trata os dois formatos.

**Paginação.** `GET /transactions`, `GET /dividends` e `GET /reports` aceitam `?limite=` (inteiro de 1 a 100,
padrão 50) e `?cursor=` (uuid do último item da página anterior). Respondem
`{ "itens": [...], "proximoCursor": "uuid" | null }`; `null` é a última página (`shared/paginacao.ts`).

**Ticker.** Onde a entrada é um ticker (`transactions`, `dividends`, `goals`, `/ativos/*/:ticker`), vale o
`tickerSchema` de `shared/ticker.ts`: só letras e dígitos, 4 a 12 caracteres, convertido para maiúsculas.
Exceções, que têm regra própria: `POST /reports` (`^[A-Z0-9]{4,7}$`), `POST /rebalance/exemplo`
(`^[A-Z0-9]{4,7}$`) e `GET /quotes/:ticker` (código de negociação, `^[A-Z0-9]{3}[A-Z]\d{1,2}$`, que aceita `B3SA3`).

## Limitadores de requisição

Todos em memória (`express-rate-limit`), com os cabeçalhos `RateLimit-*` padrão, e desligados com
`NODE_ENV=test`. A chave é o IP (`req.ip`, que depende de `TRUST_PROXY`, ver [deploy.md](deploy.md)), salvo
onde diz "por usuário".

| Limitador | Onde | Teto |
|---|---|---|
| `limitadorAtivos` | `/ativos/*` e `/indices/*` (montados antes do global) | 300 por minuto |
| `limitadorGlobal` | todo o resto, inclusive `/health` | 500 a cada 15 min |
| `limitadorAuth` | `POST /auth/register` e `POST /auth/login` | 10 a cada 15 min |
| `limitadorExemplo` | `POST /rebalance/exemplo` | 30 por minuto |
| `limitadorRelatorios` | `POST /reports` e `POST /reports/cvm` | 20 por hora, por usuário |
| `limitadorSyncDeProventos` | `POST /dividends/sync` | 3 a cada 10 min, por usuário |

## Saúde

### `GET /health`

Público. Faz `SELECT 1` no banco. `200 {"status":"ok","service":"portfoliolab-api","database":"ok"}`, ou
`503 {"status":"degraded",...,"database":"erro"}` com o banco fora. É o health check do Render.

## Autenticação (`/auth`)

| Método e caminho | Login | Corpo | Resposta |
|---|---|---|---|
| `POST /auth/register` | não | `{ name: string ≥ 2, email: e-mail, password: string ≥ 6 }` | `201 { id, name, email }` |
| `POST /auth/login` | não | `{ email, password }` | `200 { user: { id, name, email } }` e o cookie `token` |
| `POST /auth/logout` | não | — | `204`, apaga o cookie |
| `GET /auth/me` | sim | — | `200 { id, name, email, createdAt, demo }` |

Erros: `409 "E-mail já cadastrado"` (inclui o e-mail da demo em qualquer caixa), `401 "E-mail ou senha
incorretos"` (a mesma mensagem para e-mail inexistente e senha errada), `404 "Usuário não encontrado"` no
`/me`. O e-mail não é normalizado: `Ana@x.com` e `ana@x.com` são contas diferentes. A senha vira hash bcrypt
com custo 12. Só a demo recebe a claim `demo: true`; `demo` no `/me` sai do e-mail gravado.

## Carteira

### `GET /assets` (logado)

Os ativos com que o usuário tem algum vínculo (transação, meta ou provento), em ordem de ticker. Cada item é
a linha de `assets`: `{ id, ticker, name, type, sector, currentPrice, priceUpdatedAt, cnpj }`.

### `GET /assets/:ticker` (logado)

O ativo do catálogo global (a tabela `assets` é de todos os usuários). `404` se não existe. Não consulta o
Yahoo e não cadastra nada.

### `POST /transactions` (logado, bloqueado na demo)

Corpo: `{ ticker, kind: "COMPRA" | "VENDA", quantity > 0, unitPrice > 0, fee ≥ 0 (padrão 0), executedAt }`.
`executedAt` passa por `z.coerce.date()`: `"2026-10-01"` vira meia-noite UTC. Os números chegam como `number`,
com teto igual ao da coluna (`quantity` ≤ 9.999.999.999, `unitPrice` ≤ 9.999.999.999,99, `fee` ≤ 999.999,99);
acima disso, `400`.

- Ticker que não está em `assets` é procurado no Yahoo e cadastrado (`quotesService.buscarOuCadastrar`);
  não achado, `404`.
- `VENDA` maior que a posição de hoje: `400 "Quantidade insuficiente..."`. `VENDA` que deixaria a posição
  negativa em algum ponto da linha do tempo (datada antes da compra que a cobre): `400`.
- A validação e a gravação rodam numa transação com trava do par usuário + ativo
  (`pg_advisory_xact_lock`): duas vendas simultâneas da posição inteira dão uma `201` e uma `400`. O
  `DELETE` usa a mesma trava.
- Resposta `201 { id, userId, assetId, kind, quantity, unitPrice, fee, executedAt }`.

### `GET /transactions` (logado)

Página do extrato, da operação mais recente para a mais antiga (`executedAt` e `seq` decrescentes). Cada item
tem os campos acima e `asset: { ticker, name, type }`.

### `DELETE /transactions/:id` (logado, bloqueado na demo)

`204`. `404` se a transação não é do usuário. `409` se apagar deixaria a posição negativa (há venda posterior
que dependia dela).

### `GET /portfolio` (logado)

Posição derivada das transações (preço médio pela regra da Receita, `calcularPosicao`), com o preço resolvido
por `quotesService.resolverPrecos` (Yahoo se o preço gravado tem mais de 15 min, senão o gravado). Posição
zerada não aparece. Lista ordenada pelo maior valor atual:
`[{ ticker, name, type, quantidade, precoMedio, precoAtual, valorAplicado, valorAtual, lucro, lucroPct }]`.

### `GET /portfolio/summary` (logado)

`{ patrimonioTotal, totalAplicado, lucroTotal, lucroPct, totalProventos, totalTaxas, quantidadeAtivos,
alocacaoPorClasse: [{ classe, valor, percentual }] }`. `totalAplicado` e `lucroTotal` são das posições abertas
(não é rentabilidade). `totalTaxas` soma a taxa de toda operação, inclusive de ativos já vendidos.

### `GET /portfolio/evolution` (logado)

Últimos 12 meses, a partir do mês da primeira transação: `[{ mes: "AAAA-MM", aplicado, resultado, patrimonio }]`.
Cada mês fechado usa o fechamento mensal do Yahoo; o mês corrente, o preço de agora.

### `GET /quotes/:ticker` (logado)

Consulta o Yahoo sem cadastrar nada (o formulário de transação e o editor de metas usam). Formato aceito:
o código de negociação da B3 (`CODIGO_DE_NEGOCIACAO_B3` em `shared/ticker.ts`, aceita `B3SA3`), senão
`400`, antes de chamar o Yahoo. O front usa a mesma regra. Ticker que o Yahoo não conhece: `404`. Resposta:
`{ ticker, nome, preco, tipo, fechamentoAnterior, negociadoEm }`.

### Proventos (`/dividends`)

| Método e caminho | Demo | Corpo | Resposta |
|---|---|---|---|
| `POST /dividends` | bloqueado | `{ ticker, amount > 0, paidAt }` | `201` com a linha (`source: "MANUAL"`) |
| `GET /dividends` | — | paginação | página com `asset: { ticker, name }` em cada item |
| `POST /dividends/sync` | **liberado** | — | `200 { ativosConsultados, proventos }` |
| `DELETE /dividends/:id` | bloqueado | — | `204`; `404` se não é do usuário |

O `sync` consulta no Yahoo, um ativo de cada vez (até 8 s cada), os proventos de cada ativo que o usuário já
negociou, recalcula quanto ele recebeu pela posição no dia anterior à data-ex e grava com `source: "PROVEDOR"`
(upsert pela unique `userId, assetId, paidAt, source`). Apaga as linhas `PROVEDOR` que deixaram de ser devidas,
nunca as `MANUAL`. Ativo cuja consulta falha ou volta vazia é pulado sem apagar nada.

### Metas (`/goals`)

| Método e caminho | Demo | Corpo | Resposta |
|---|---|---|---|
| `GET /goals` | — | — | `{ metas: [{ ticker, name, type, targetWeight }], somaTotal }` |
| `PUT /goals` | bloqueado | `{ ticker, targetWeight }` (0 < peso ≤ 100) | o mesmo formato do `GET` |
| `PUT /goals/batch` | bloqueado | `{ metas: [{ ticker, targetWeight }] }` (1 a 50, ticker sem repetir) | o mesmo formato do `GET` |
| `DELETE /goals/:ticker` | bloqueado | — | `204`; `404` se o ativo ou a meta não existe |

A soma das metas não passa de 100% (`400`). O `batch` substitui o conjunto inteiro numa transação do banco
(apaga e recria). Ticker sem cadastro é procurado no Yahoo e cadastrado, como nas transações; não achado,
`404` e nada é gravado.

### `POST /rebalance/simulate` (logado, liberado na demo)

Corpo `{ amount > 0 }`. Exige metas (`400` sem nenhuma). Roda `calcularAporte` (fatia proporcional ao déficit
e depois o troco, em cotas inteiras; ver [algoritmo-rebalanceamento.md](algoritmo-rebalanceamento.md)) sobre os
ativos com meta. Resposta: `{ valorAporte, patrimonioAtual, patrimonioFinal, patrimonioProjetado, compras:
[{ ticker, name, deficit, quantidade, precoUnitario, total }], totalGasto, restante, alocacao: [{ ticker,
alvoPct, atualPct, aposAportePct }], ignorados: [{ ticker, motivo }], patrimonioConsiderado, somaMetas,
foraDaSimulacao: { valor, ativos: [{ ticker, valor }] } }`. Não grava nada.

### `POST /rebalance/exemplo` (público)

O desafio da página inicial. Corpo: `{ amount (0 a 1.000.000), ativos: [{ ticker, nome (1 a 80), preco (até
100.000, no máximo 2 casas), quantidade (inteiro 0 a 1.000.000), meta (0 a 100) }] }`, de 1 a 12 ativos, metas
somando até 100. Responde o mesmo resultado de `calcularAporte` (sem os campos de `patrimonioConsiderado` em
diante). Sem banco e sem cotação.

### `GET /indicators` (logado)

Indicadores das **ações** que o usuário já negociou (FII, ETF e renda fixa ficam de fora), do cache
`asset_indicators`. O que está ausente ou com mais de 24 h é renovado ali mesmo, um ativo de cada vez: Yahoo
(`quoteSummary`), e se ele não responde, cálculo pela CVM a partir da fotografia `CVM_RESULTS` (só ação do
catálogo). Resposta: `[{ ticker, name, pl, pvp, dividendYield, roe, roa, margemLiquida, dividaEbitda,
setorBancario, atualizadoEm }]`, com `null` onde não há dado.

### `GET /news` (logado)

Money Times e Suno (cache de 10 min em memória, sem banco), separados pelos ativos da carteira:
`{ daSuaCarteira: [noticia], mercado: [noticia], atualizadoEm }`, onde `noticia` é `{ titulo, resumo, link,
fonte, publicadoEm, tickers }`. Só links `http(s)` passam (`rss.ts:linkSeguro`).

## Relatórios da CVM (`/reports`)

| Método e caminho | Demo | Corpo | Resposta |
|---|---|---|---|
| `POST /reports` | bloqueado | `{ ticker, periodo? }` | `201` (guardado agora) ou `200` (a conta já tinha) |
| `POST /reports/cvm` | bloqueado | igual | igual (caminho antigo, mesma função) |
| `GET /reports` | — | paginação | página de `{ id, fileName, analysis, source, period, asset, createdAt }` |
| `DELETE /reports/:id` | bloqueado | — | `204`; `404` se não é do usuário |

`periodo` aceita `2026-T1` ou `1T26` (ação) e `2026-03` (FII); vazio conta como ausente. Sem ele, o service
anda para trás até 4 períodos a partir do último encerrado. O relatório é
`{ id, fileName, source: "CVM", period, asset: { ticker, name, type }, createdAt, analysis }`, e `analysis`
segue o tipo `Analise` de `reports/analise.ts` (`versao`, `tipoDocumento`, `blocos`, `destaques`, `alertas`,
`indicadores`, `dataReferencia`, `link`).

Erros: `404` ativo não achado ou período sem documento na CVM; `400` período em formato errado, ativo que não
é ação nem FII, ou sem CNPJ na tabela (`modules/assets/tabela-cnpj.json`); `429` ao passar de 50 relatórios
guardados na conta (`COTA_RELATORIOS`) ou do limitador. A leitura do zip passa pela fila serial `naFilaDaCvm`
e pode levar dezenas de segundos na primeira vez de um período.

## Páginas públicas de Ativos (`/ativos`)

Sem login, com `limitadorAtivos` e `Cache-Control: public, max-age=60`. Só ticker do catálogo curado
(`ativos.catalogo.ts`: 15 ações, 15 FIIs, 10 ETFs) chega às fontes; outro ticker em formato válido dá `404`
antes de qualquer chamada externa, e formato inválido dá `400`.

| Rota | Resposta |
|---|---|
| `GET /ativos/acoes` | `AcaoResumoDto[]`: `{ ticker, nome, setor, especie, preco, variacaoDia, pl, pvp, dy12m, roe }` |
| `GET /ativos/acoes/:ticker` | `AcaoFichaDto`: o resumo, `descricao`, `fechamentoEm`, `banco`, e os blocos `indicadores`, `historico`, `proventos`, `resultados`, `noticias` |
| `GET /ativos/fiis` | `FiiResumoDto[]`: `{ ticker, nome, tipo, segmento, preco, variacaoDia, dy12m, pvp }` |
| `GET /ativos/fiis/:ticker` | `FiiFichaDto`: o resumo, `descricao`, `fechamentoEm`, `indicadores` (DY mensal e 12 m, P/VP, patrimônio, cotistas, taxa de administração, gestão), `informe`, `composicao`, `historico`, `proventos`, `noticias` |
| `GET /ativos/etfs` | `EtfResumoDto[]`: `{ ticker, nome, categoria, indice, preco, variacaoDia, retorno12m, dy12m }` |
| `GET /ativos/etfs/:ticker` | `EtfFichaDto`: o resumo, `descricao`, `fechamentoEm`, `patrimonio`, `historico`, `proventos`, `noticias` |

Cada bloco é `{ estado: "ok" | "desatualizado" | "indisponivel", atualizadoEm, dados }`: uma fonte que falha
nunca derruba a ficha. Os tipos completos estão em `ativos.tipos.ts` (backend) e `ativos-tipos.ts` (front), que
têm de andar juntos com o stub do E2E (`frontend/e2e/ativos/stub-api.mjs`).

## Índices (`/indices`)

### `GET /indices/dados`

Público, `limitadorAtivos`, `Cache-Control: public, max-age=60`. Responde em até ~15 s mesmo com o Banco
Central lento (o que não chegou vai com a última série boa). Formato (`DadosDosIndicesDto`):

```
{
  atualizadoEm, hoje: "AAAA-MM-DD",
  selicMensal, ipcaMensal, cdiMensal, cdiTaxaMensal: [{ data, valor }],
  pontos: { ibovespa, ifix, smll, sp500, idiv: [{ data: "AAAA-MM-DD", valor }] }
}
```

Fontes: SGS 432 (Selic), 433 (IPCA), 4391 e 4389 (CDI); Yahoo para Ibovespa e S&P 500 (histórico desde 2011)
e para o valor do dia de IFIX, SMLL e IDIV, cujo histórico vem de `index_points` e da B3. Mudou o formato?
Confira `frontend/src/lib/indices-contrato.test.ts`, a fixture do E2E e a checagem de formato de
`numeros-do-mes-recuperaveis.tsx`.
