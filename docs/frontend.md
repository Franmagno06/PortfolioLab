# Frontend

Next 16 (App Router) com React 19, Tailwind v4, Recharts e MDX, em `frontend/`. Antes de escrever código de
framework, leia `frontend/AGENTS.md`: esta versão do Next tem mudanças que o modelo não conhece, e a
documentação certa está em `frontend/node_modules/next/dist/docs/`. As regras de movimento, da aba Aprender e
de acesso à API estão no `CLAUDE.md` da raiz; aqui fica o mapa.

## Rotas

Três grupos de rota, cada um com o seu layout. Os parênteses não entram na URL.

### `app/(site)/`: público, logado ou não

| Rota | Arquivo | Como renderiza |
|---|---|---|
| `/` | `(site)/page.tsx` | Server Component, `revalidate = 0`. A seção "Os números de…" chega por streaming sob `<Suspense>` |
| `/ativos/acoes`, `/ativos/fiis`, `/ativos/etfs` | `(site)/ativos/*/page.tsx` | Server Component, `revalidate = 0`, lê `ativos-api.ts` |
| `/ativos/acoes/[ticker]`, `/ativos/fiis/[ticker]`, `/ativos/etfs/[ticker]` | idem | idem; ticker fora do catálogo vira `notFound()` |
| `/ativos/indices` e `/ativos/indices/[slug]` | `(site)/ativos/indices/` | `revalidate = 0`, lê `indices-api.ts`; os 8 slugs (`selic`, `ipca`, `cdi`, `ibovespa`, `ifix`, `smll`, `sp500`, `idiv`) estão em `lib/indices.ts` |
| `/aprender` | `(site)/aprender/page.tsx` | estática, sem backend |
| `/aprender/[slug]` | `(site)/aprender/[slug]/page.tsx` | `generateStaticParams` sobre os artigos `.mdx` |
| `/aprender/glossario`, `/aprender/indicadores`, `/aprender/como-calculamos` | `(site)/aprender/*` | estáticas |

`ativos/` tem `loading.tsx`, `error.tsx` e `not-found.tsx` próprios; `aprender/` e `ativos/indices/` têm o seu
`not-found.tsx`.

### `app/(auth)/`: login e cadastro

`/login` e `/registro`, páginas `"use client"`. Depois de entrar, `proximo-destino.tsx` leva ao `?next=`, que
só é aceito se for caminho da própria origem (`destinoDepoisDoLogin` em `lib/navegacao.ts`; o resto cai em
`/dashboard`).

### `app/(app)/`: área logada

`/dashboard`, `/carteira`, `/simulacao`, `/relatorios`, `/indicadores` e `/noticias`. Todas são `"use client"`
e buscam os dados no navegador por `api()`. O layout (`(app)/layout.tsx`) põe o mesmo cabeçalho do site
(`CabecalhoSite`), as abas da carteira (`AbasDaCarteira`, lista em `ABAS_DA_CARTEIRA`) e a faixa da demo
(`AvisoDemo`). As rotas de todo o app ficam em `ROTAS` (`lib/navegacao.ts`), junto com o menu (`NAVEGACAO`) e o
rodapé (`RODAPE`).

O layout raiz (`app/layout.tsx`) carrega as fontes (Literata, Public Sans e Space Grotesk) e o `globals.css`,
onde estão os tokens de cor e os de movimento.

## `src/proxy.ts`

É o antigo `middleware.ts` (renomeado no Next 16). Faz duas coisas:

1. **Proteção de rota pela presença do cookie `token`.** Não valida o JWT (o front não tem o segredo): quem
   valida é o backend. Sem cookie, qualquer rota fora de `/`, `/ativos[/…]`, `/aprender[/…]`, `/login` e
   `/registro` redireciona para `/login?next=<rota pedida>`. Com cookie, `/login` e `/registro` mandam para
   `/dashboard`, a não ser que a URL traga `?expirada`, o marcador que `lib/api.ts` põe depois de um 401 (sem
   ele, um cookie vencido prendia a pessoa num laço entre login e dashboard).
2. **Content-Security-Policy** em toda resposta de página: `default-src 'self'`, `script-src 'self'
   'unsafe-inline'` (o Next injeta o payload do RSC inline e as páginas são pré-renderizadas, então não há
   nonce), `connect-src 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` fora do dev. Os outros
   cabeçalhos fixos (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) estão em
   `next.config.ts`.

O `matcher` deixa de fora `api`, `_next/static`, `_next/image`, `favicon.ico` e `*.svg`. Ao mexer nele, confira
com `curl -o /dev/null -w "%{http_code}" localhost:3000/dashboard` sem cookie: tem de dar 307.

## Como o front chama o backend

| Cliente | Arquivo | Onde roda | Caminho | Erro |
|---|---|---|---|---|
| `api()` | `lib/api.ts` | navegador | `/api/*`, que o `next.config.ts` reescreve para `API_URL` | lança `ApiError` com a mensagem do backend; 401 fora de `/auth/login` e `/auth/register` derruba a sessão |
| `apiPublica()` | `lib/api.ts` | navegador | `/api/*` | lança `ApiError`, mas nunca mexe na sessão |
| `ativos-api.ts` | `lib/ativos-api.ts` | servidor do Next | `API_URL` direto | `404`/`400` viram `null` (página 404); outro status lança |
| `indices-api.ts` | `lib/indices-api.ts` | servidor do Next | `API_URL` direto | nunca lança: qualquer falha vira `null` |

- **`api()`** manda `Content-Type: application/json`, devolve `undefined` em `204`, e não tem prazo próprio
  (espera o que o rewrite esperar). Num 401 de sessão, `encerrarSessao` chama `/api/auth/logout` (o cookie é
  `HttpOnly`, só o backend o apaga) e troca a página por `/login?expirada=1&next=…`. O marcador `saindo`
  (`iniciarSaida`/`cancelarSaida`) evita que uma chamada atrasada depois do "Sair" leve ao aviso de sessão
  expirada.
- **`apiPublica()`** existe para leituras em que 401 é resposta normal: `GET /auth/me` em
  `lib/sessao-do-visitante.ts` (o botão "Ver a demonstração" não pode logar a demo por cima de uma conta de
  verdade) e a recuperação dos índices da home (`components/site/numeros-do-mes-recuperaveis.tsx`).
- **`ativos-api.ts` e `indices-api.ts`** leem no servidor, com `next: { revalidate: 120 }` (o E2E põe
  `ATIVOS_REVALIDAR_S=0`) e `AbortSignal.timeout(20 s)`. `/api` relativo só existe no navegador, por isso vão
  direto em `API_URL`. Na home, `lerDadosDosIndices({ prazoMs: 5000 })` só encurta a espera: a leitura segue até
  20 s e enche o cache do Next.
- Por passar tudo pela mesma origem, não há CORS e o cookie `SameSite=Strict` funciona. Sem `API_URL`, o
  padrão é `http://localhost:3333`. O `proxyTimeout` de 120 s do `next.config.ts` vale para `next dev`/`next
  start`; na Vercel o limite equivalente é o do rewrite externo.

Outros módulos de `lib/` que valem conhecer:

| Arquivo | O que é |
|---|---|
| `format.ts` | toda formatação de número, moeda, percentual e data (`brl`, `pct`, `percentual`, `dataCurta`, `mesAno`, `tempoRelativo`…) e os nomes e cores das classes de ativo |
| `navegacao.ts` | `ROTAS`, menu, abas, rodapé e o validador do `?next=` |
| `ativos-tipos.ts`, `ativos-catalogo.ts`, `ativos-logos.ts` | tipos do DTO de `/ativos`, cópia dos tickers e nomes do catálogo do backend (um teste confere que não divergem) e os logos locais |
| `indices.ts`, `indices-dados.ts`, `indices-exemplo.ts` | a definição dos 8 índices, as contas das páginas de índices e a série de exemplo (`DADOS_DE_EXEMPLO`, que gera a fixture do E2E) |
| `site-dados.ts`, `home-dados.ts` | os números fixos de reserva da home (`NUMEROS_DO_MES`) e a montagem das seções |
| `carteira-exemplo.ts` | a carteira do desafio do aporte da página inicial |
| `goals.ts`, `alocacao.ts`, `relatorios.ts` | contas de tela da área logada (desvio de meta, maiores posições, agrupamento de relatórios) |
| `simulacao-guardada.ts` | a última simulação, no `sessionStorage` da aba, para voltar à tela |
| `use-busca-ticker.ts` | a busca de ticker com atraso que o formulário de transação e o editor de metas usam (só consulta o que tem cara de código de negociação: `^[A-Z0-9]{3}[A-Z]\d{1,2}$`, o que inclui `B3SA3`) |
| `aprender/` | leitura dos `.mdx` e do frontmatter, tempo de leitura, e os exemplos numéricos conferidos em teste |

## Kit de movimento

As regras estão no `CLAUDE.md` (seção Frontend, "Movimento") e o desenho em [ux-movimento.md](ux-movimento.md).
As peças:

- **Tokens** `--duracao-*` e `--curva` em `app/globals.css`, e as classes `.interativo`, `.toque` e
  `.linha-de-tabela`.
- **`lib/movimento.ts`**: as mesmas durações e a curva em TypeScript, a função de desaceleração, o valor na
  contagem e os caminhos SVG do minigráfico.
- **`components/movimento/`**: `Revelar` (entrada ao rolar, só esconde o que o observador viu fora da tela),
  `NumeroQueConta`, `Minigrafico`, `ExplicacaoQueAbre` (a única que anima `grid-template-rows`),
  `GraficoDeFundo` (movimento contínuo, com botão de pausa), `usar-visibilidade.ts` e o `observador-falso.ts`
  dos testes.
- Dois testes de CSS barram desvio: `app/movimento-css.test.ts` (sem `prefers-reduced-motion`, sem curva ou
  duração escrita à mão) e `app/contraste-css.test.ts`.

## Aba Aprender

Conteúdo fora dos componentes, em `src/content/aprender/`: 18 artigos `.mdx` em `artigos/`, o glossário
(`glossario.ts`, 39 verbetes) e os 9 cartões de indicadores (`indicadores.ts`). Os slugs publicáveis estão em
`SLUGS_PLANEJADOS` (`lib/aprender/tipos.ts`). Os blocos que um artigo pode usar no MDX (`Conta`, `Parcela`,
`Sinal`, `Armadilha`, `Trecho`, `VejaNoSite`, `GraficoArtigo`) ficam em `components/aprender/` e são ligados em
`src/mdx-components.tsx`; o resto da pasta (`EmResumo`, `TabelaDeExemplo`, cards, índice do artigo) é montado
pela página. O `next.config.ts` carrega o MDX com `remark-frontmatter` e `remark-gfm`. As
regras de escrita (fonte e data, nenhuma recomendação, exemplo conferido em `lib/aprender/exemplos.test.ts`)
estão em [aprender-conteudo.md](aprender-conteudo.md).

## Componentes

| Pasta | O que tem |
|---|---|
| `components/ui/` | peças básicas: `Botao`, `Campo`, `Card`, `Tabela`, `Mensagem`, `Skeleton`, `PageHeader`, `EmptyState`, `EtiquetaClasse`, ícones e a marca |
| `components/site/` | cabeçalho, rodapé, abas da carteira, faixa e botão da demo, desafio do aporte, números do mês (e a versão que se recupera no navegador), bento de ativos e índices, régua de P/VP |
| `components/ativos/` | ficha e listagem de ações, FIIs e ETFs (blocos, seções, gráfico de preço, indicadores com dica) |
| `components/indices/` | cards, painel, gráficos de área e de barras, ordenação e peças da ficha de índice |
| `components/aprender/` | blocos do MDX e as peças da aba |
| `components/` (raiz) | `nova-transacao.tsx`, `historico-transacoes.tsx`, `proventos-card.tsx`, usados na carteira |

## Testes

**Unitários (Vitest, jsdom).** `npm test` em `frontend/`. Cada teste fica ao lado do arquivo que testa
(`*.test.ts` / `*.test.tsx`), em `app/`, `components/` e `lib/`. Nenhum toca banco ou backend: os que precisam
da API usam `fetch` simulado. `vitest.config.mts` exclui `e2e/` e sobe o prazo para 20 s. Testes que funcionam
como contrato: `ativos-catalogo.test.ts` (cópia do catálogo do backend), `indices-contrato.test.ts` (chaves de
`/indices/dados` contra o tipo e o backend), `stub-ativos.test.ts` (o stub do E2E), `aprender.test.ts` e
`exemplos.test.ts` (conteúdo).

**E2E (Playwright)**, em `frontend/e2e/`, em duas configurações:

| Configuração | Specs | O que sobe | Comando |
|---|---|---|---|
| `playwright.config.ts` | `site`, `area-logada`, `fluxo-completo`, `historico-transacoes` | o backend de verdade (`npm run dev` em `backend/`, `NODE_ENV=test`, `DATABASE_URL` do Docker local) e o `next dev` na 3000. A home chama o Banco Central e o Yahoo ao vivo | `npx playwright test` |
| `playwright.ativos.config.ts` | `ativos*`, `aprender` | só a API de mentira `e2e/ativos/stub-api.mjs` (porta 3399) e um segundo `next dev` na 3100, com `.next-e2e` e `tsconfig.e2e.json` próprios. Sem backend, Docker, Yahoo nem CVM | `npm run test:e2e:ativos` |

`npm run test:e2e` roda as duas. O E2E principal escreve no Postgres do Docker: antes dele, a skill
`rodar-testes-seguro`. O stub responde `/indices/dados` com `e2e/ativos/indices-dados.json`, gerado por
`npx tsx scripts/gerar-fixture-indices.ts` a partir de `DADOS_DE_EXEMPLO`.

**Bateria sem banco**, a mesma do CI: `npm run typecheck` (`next typegen && tsc --noEmit`), `npm run lint`,
`npm test` e `npm run build`.
