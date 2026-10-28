# Página inicial nova e camada de movimento — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um kit único de movimento e explicação (padrões A–F) aplicado com constância no site inteiro, e uma página inicial nova centrada em aprender.

**Architecture:** tokens e utilitários de movimento em `globals.css`, funções puras em `src/lib/movimento.ts` e cinco componentes de cliente pequenos em `src/components/movimento/`. As páginas continuam Server Components e só envolvem trechos com essas peças. Três fases, cada uma publicável sozinha: (1) kit + home, (2) site público, (3) área logada.

**Tech Stack:** Next 16 (App Router), React 19, Tailwind v4, Recharts 3, Vitest + Testing Library (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-ux-movimento-e-home-design.md` (aprovado em 20/10/2026). Ler a seção 5 (valores de cada padrão), 5.1 (onde cada padrão entra), 8 (decisões do Claude) e 10 (decisões do dono) antes de cada tarefa.

**Branch:** `feat/ux-movimento` (já existe, com as skills do Emil Kowalski instaladas).

## Global Constraints

- Ler `frontend/AGENTS.md` e consultar `frontend/node_modules/next/dist/docs/` antes de código de framework. Componente de cliente **não recebe função** vinda do servidor: passe dados e nomes de formato, nunca `formatar={...}`.
- Formatação de número, moeda e data só por `src/lib/format.ts`. API só por `src/lib/api.ts` (navegador) ou `src/lib/*-api.ts` (servidor).
- Regras de conteúdo (`docs/aprender-conteudo.md`): nada de recomendação ("barato", "caro", "compre", "melhores", "oportunidade"); número de mercado com fonte e data; todo exemplo numérico conferido por teste.
- Tokens exatos (spec §5): `--duracao-rapida: 160ms`, `--duracao-media: 260ms`, `--duracao-lenta: 900ms`, `--duracao-grafico: 1100ms`, `--curva: cubic-bezier(.2,.8,.2,1)`. Nenhuma curva ou duração escrita à mão fora deles.
- Animar só `transform`, `opacity` e o traço de SVG (`stroke-dashoffset`). Nada de animar `width`, `height`, `top`, `left` ou `margin`.
- **Sem tratamento de "reduzir movimento"** (decisão do dono, spec §5): nenhum `prefers-reduced-motion` no código novo, e os existentes saem na Tarefa 1. **Continua obrigatório** o botão de pausa do movimento contínuo do topo (WCAG 2.2.2).
- Hover sempre acompanhado de `:focus-visible`; alvos de toque ≥ 44 px; sem rolagem horizontal a 390 px.
- Sem biblioteca nova (nada de Framer Motion, GSAP ou similares).
- Skills: antes de escrever JSX, `frontend-design` e `web-design-guidelines`; para construir movimento, `animate`; antes de cada checkpoint, `animation-performance` e `review-animations`; para o celular, `mobile-native`.
- Testes com banco só no Docker (`rodar-testes-seguro`); nunca `.env.supabase`.
- Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Fronteira servidor/cliente:** passar função ou componente para um componente de cliente quebra o build do Next 16. Coberto pelo `npm run build` de cada checkpoint e pelas assinaturas da Tarefa 3, que só aceitam dados.
2. **Leitor de tela e número que conta:** quem usa leitor de tela deve ouvir só o valor final, nunca os intermediários. Teste na Tarefa 3 (`numero-que-conta`).
3. **Explicação fechada:** o conteúdo de uma explicação fechada não pode ser lido nem focado por teclado (`inert`). Teste na Tarefa 3 (`explicacao-que-abre`).
4. **Toque no celular:** a explicação que o hover revela no bento precisa estar sempre visível no celular. Teste E2E a 390 px na Tarefa 6.
5. **Honestidade dos números:** com a referência fixa (API fora), o bento não mostra minigráfico nem mistura fixo com ao vivo. Teste na Tarefa 6 (`numerosDoBento(null)`).

---

## Fase 1 — Kit de movimento e página inicial

### Task 1: Tokens e utilitários de movimento em `globals.css`

**Files:**
- Modify: `frontend/src/app/globals.css` (blocos de movimento, hoje entre `@keyframes fade-up` e o `@media (prefers-reduced-motion: reduce)`)
- Test: `frontend/src/app/movimento-css.test.ts` (novo)

**Interfaces:**
- Produces (classes CSS que as tarefas seguintes usam):
  - `.interativo` (padrão A): transição de `transform`, `box-shadow` e `border-color` com `--duracao-media`/`--curva`; em `:hover` e `:focus-visible`: `translateY(-3px)`, sombra `0 10px 24px -12px` na cor da tinta a ~33%, borda um tom mais escuro; em `:active`: `translateY(-1px) scale(.995)`. Filho `.seta` anda `translateX(4px)` no mesmo gatilho.
  - `.revelar` / `.revelar.visivel` (padrão C): estado inicial `opacity: 0; transform: translateY(16px)`, transição de 600 ms com `--curva`, atraso por `transition-delay: var(--atraso, 0ms)`.
  - Tokens `--duracao-rapida`, `--duracao-media`, `--duracao-lenta`, `--duracao-grafico`, `--curva`.

- [ ] **Step 1: Teste que falha.** `movimento-css.test.ts` lê `globals.css` como texto (`fs.readFileSync`) e afirma:

```ts
expect(css).not.toMatch(/prefers-reduced-motion/);
for (const t of ["--duracao-rapida: 160ms", "--duracao-media: 260ms", "--duracao-lenta: 900ms", "--duracao-grafico: 1100ms", "--curva: cubic-bezier(.2,.8,.2,1)"]) expect(css).toContain(t);
expect(css).toMatch(/\.interativo:hover/);
expect(css).toMatch(/\.interativo:focus-visible/);
expect(css).toMatch(/\.revelar\.visivel/);
```

- [ ] **Step 2:** `cd frontend && npx vitest run src/app/movimento-css.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Remover os três blocos de `prefers-reduced-motion`: o `scroll-behavior: smooth` e a `.abrir-menu` passam a valer sempre; o bloco `reduce` é apagado. As classes `.reveal`, `.reveal-2..4` e `.grow-bar` existentes passam a usar os tokens (`--curva` e durações), sem mudar o efeito.
- [ ] **Step 4:** Mesmo comando → PASS; `npm run lint` e `npm run typecheck` limpos.
- [ ] **Step 5: Commit** `feat(movimento): tokens, cartão interativo e revelar no globals.css; sai o reduzir movimento`.

### Task 2: Funções puras de movimento

**Files:**
- Create: `frontend/src/lib/movimento.ts`
- Test: `frontend/src/lib/movimento.test.ts`

**Interfaces:**
- Produces:
  - `DURACAO_GRAFICO_MS = 1100`, `DURACAO_CONTAGEM_MS = 1100` (constantes que espelham os tokens).
  - `desacelerar(t: number): number`: curva cúbica de saída, `1 - (1 - t)^3`, com `t` limitado a [0, 1].
  - `valorNaContagem(final: number, decorridoMs: number, duracaoMs = DURACAO_CONTAGEM_MS): number`.
  - `caminhoDoMinigrafico(valores: number[], largura: number, altura: number): string`: atributo `d` de um `<path>` SVG; `""` se houver menos de 2 valores; série constante desenhada no meio da altura.

- [ ] **Step 1: Testes que falham**

```ts
it("desacelerar começa em 0, termina em 1 e passa da metade antes do meio", () => {
  expect(desacelerar(0)).toBe(0); expect(desacelerar(1)).toBe(1); expect(desacelerar(0.5)).toBeCloseTo(0.875);
  expect(desacelerar(-1)).toBe(0); expect(desacelerar(2)).toBe(1);
});
it("valorNaContagem termina exatamente no valor final", () => {
  expect(valorNaContagem(208296, 1100)).toBe(208296); expect(valorNaContagem(208296, 5000)).toBe(208296);
  expect(valorNaContagem(208296, 0)).toBe(0);
});
it("caminhoDoMinigrafico", () => {
  expect(caminhoDoMinigrafico([], 100, 40)).toBe(""); expect(caminhoDoMinigrafico([5], 100, 40)).toBe("");
  expect(caminhoDoMinigrafico([1, 2, 3], 100, 40)).toBe("M0,40 L50,20 L100,0");
  expect(caminhoDoMinigrafico([7, 7], 100, 40)).toBe("M0,20 L100,20");
});
```

- [ ] **Step 2:** `npx vitest run src/lib/movimento.test.ts` → FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(movimento): funções puras de contagem e minigráfico`.

### Task 3: Componentes de cliente do kit

**Files:**
- Create: `frontend/src/components/movimento/revelar.tsx`, `numero-que-conta.tsx`, `explicacao-que-abre.tsx`, `grafico-de-fundo.tsx`, `minigrafico.tsx`
- Test: um `*.test.tsx` por componente, com `// @vitest-environment jsdom` (mesmo padrão de `components/site/aviso-demo.test.tsx`); `IntersectionObserver` simulado no teste.

**Interfaces:**
- Consumes: classes da Tarefa 1; `desacelerar`, `valorNaContagem`, `caminhoDoMinigrafico` da Tarefa 2.
- Produces (todos `"use client"`, props só de dados):
  - `<Revelar atrasoMs?: number className?: string>{children}</Revelar>`: `div` com `.revelar`; ao ficar 30% visível adiciona `.visivel` **uma vez** e para de observar. `atrasoMs` vira `--atraso`.
  - `<NumeroQueConta valor: number formato: "inteiro" | "pontos" | "percentual" | "brl" casas?: number />`: o span visível conta de 0 ao valor quando 50% visível (1,1 s, `desacelerar`), com `aria-hidden`; um span `sr-only` sempre traz o valor final formatado. Formatação via `format.ts`.
  - `<ExplicacaoQueAbre id: string rotulo: ReactNode valor?: ReactNode resumo: ReactNode>{corpo}</ExplicacaoQueAbre>`: linha inteira é `<button aria-expanded aria-controls={id}>` com rótulo, valor e seta; `resumo` fica **sempre visível** fora do botão; o corpo abre por `grid-template-rows: 0fr → 1fr` em `--duracao-media` e, fechado, tem `inert` e `aria-hidden="true"`.
  - `<GraficoDeFundo />`: duas linhas SVG (opacidades ~0,28 e ~0,18, deslocamento lateral de ~60 px em 14 s e 19 s, ida e volta, `aria-hidden`) e um botão "Pausar animação"/"Retomar animação" com `aria-pressed` que pausa as duas por `animation-play-state`.
  - `<Minigrafico valores: number[] largura?: number altura?: number rotulo: string />`: `svg` com `role="img"` e `aria-label={rotulo}`; o traço se desenha (`stroke-dasharray`/`stroke-dashoffset`, `--duracao-grafico`) uma vez quando 50% visível; com menos de 2 valores não renderiza nada.

- [ ] **Step 1: Testes que falham** (nomes e asserções obrigatórios):
  - `revelar`: "fica sem .visivel até entrar na tela"; "ganha .visivel ao entrar e não perde ao sair"; "atrasoMs vira a variável --atraso".
  - `numero-que-conta`: "o leitor de tela recebe só o valor final desde o início" (`sr-only` contém `208.296` antes de qualquer tempo passar; o span visível tem `aria-hidden="true"`); "ao terminar, o número visível é o valor final" (timers falsos, avançar 1100 ms); "formato percentual usa vírgula" (`4.58` → `4,58%`).
  - `explicacao-que-abre`: "fechada, o corpo é inert e aria-hidden e o resumo aparece"; "clicar abre, troca aria-expanded e tira o inert"; "aria-controls aponta para o id do corpo".
  - `grafico-de-fundo`: "o botão alterna entre Pausar e Retomar e muda aria-pressed"; "pausado, as linhas recebem animation-play-state paused".
  - `minigrafico`: "não renderiza com menos de 2 valores"; "tem role img e o rótulo"; "o path usa o d de caminhoDoMinigrafico".
- [ ] **Step 2:** `npx vitest run src/components/movimento` → FAIL. **Step 3:** implementar (carregar `animate` e `web-design-guidelines` antes). **Step 4:** PASS; `npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** `feat(movimento): componentes Revelar, NumeroQueConta, ExplicacaoQueAbre, GraficoDeFundo e Minigrafico`.

### Task 4: Dados da home: exemplo do TAEE11 numa data só, artigos e bento

> Tarefa de conteúdo com número de mercado: **Opus**, regra do `CLAUDE.md`.

**Files:**
- Modify: `frontend/src/lib/site-dados.ts`, `frontend/src/lib/site-dados.test.ts`, `frontend/src/lib/aprender/exemplos.test.ts`, e os consumidores de `ATIVO_DE_EXEMPLO`: `src/app/(site)/aprender/como-calculamos/page.tsx`, `src/app/(site)/aprender/indicadores/page.tsx`, `src/content/aprender/indicadores.ts`, `src/components/site/ativo-anotado.tsx`
- Create: `frontend/src/lib/home-dados.ts`, `frontend/src/lib/home-dados.test.ts`

**Interfaces:**
- Produces:
  - `ATIVO_DE_EXEMPLO` atualizado inteiro para **uma única data** (a do dia da implementação), lido da ficha do site: `GET /ativos/acoes/TAEE11` do backend local (Yahoo + cálculo do job), com os campos atuais **mais** `lucroPorAcao`, `valorPatrimonialPorAcao`, `margemLiquida` e `dividaEbitda` (`null` se a ficha não trouxer). O campo `fechamento` traz a data nova. Nenhum valor de outra data.
  - Em `home-dados.ts`: `artigosParaComecar(artigos: ResumoDeArtigo[], destaque: string | undefined, quantos = 3): ResumoDeArtigo[]` (os mais recentes por `atualizadoEm`, sem o destaque).
  - `numerosDoBento(dados: DadosDosIndices | null): { numeros: NumerosDoMes; minigraficoIbovespa: number[] | null }`. `numeros` vem de `numerosDoMes`. O minigráfico usa o último fechamento de cada um dos 12 últimos meses de `dados.pontos.ibovespa`, e é `null` quando `numeros.aoVivo` é falso ou houver menos de 2 meses.
  - `QUANTIDADE_DE_FICHAS = { acoes: ACOES.length, fiis: FIIS.length, etfs: ETFS.length }`.

- [ ] **Step 1: Testes que falham**
  - `site-dados.test`: as contas do exemplo batem com tolerância de arredondamento: `preco / lucroPorAcao ≈ pl`, `preco / valorPatrimonialPorAcao ≈ pvp`, e `fechamento` é a única data citada.
  - `exemplos.test`: os exemplos que citam o TAEE11 conferem com os valores novos. Atualizar as asserções existentes; não remover nenhuma.
  - `home-dados.test`: `artigosParaComecar` devolve 3 itens, nenhum é o destaque e estão em ordem decrescente de data. `numerosDoBento(null)` tem `aoVivo === false` e `minigraficoIbovespa === null`. `numerosDoBento(DADOS_DE_EXEMPLO)` traz 12 valores no minigráfico, o último igual ao último ponto do Ibovespa da fixture. Com só 1 mês de dados, o minigráfico é `null`. `QUANTIDADE_DE_FICHAS` é `{ acoes: 15, fiis: 15, etfs: 10 }`.
- [ ] **Step 2:** FAIL. **Step 3:** subir o backend local (`cd backend && npx tsx scripts/garantir-banco-local.ts`, depois `npm run dev`), ler a ficha do TAEE11, implementar, atualizar os textos de Aprender que citam o exemplo e parar o backend no fim. **Step 4:** `npx vitest run src/lib` → PASS.
- [ ] **Step 5: Commit** `feat(home): exemplo do TAEE11 numa data só e dados das seções da nova home`.

### Task 5: Topo e "Comece por aqui"

**Files:**
- Modify: `frontend/src/app/(site)/page.tsx`, `frontend/e2e/site.spec.ts`, `frontend/src/lib/site-dados.ts` (remover `TRILHAS`)
- Delete: `frontend/src/components/site/folha-do-aporte.tsx` (só a home o usa; conferir com `grep` antes)

**Interfaces:**
- Consumes: `GraficoDeFundo`, `Revelar`, `.interativo` (Tarefas 1 e 3); `artigosParaComecar` (Tarefa 4); `listarArtigos`, `artigoEmDestaque` de `lib/aprender/artigos.ts`; `CardArtigo` e `ArtigoEmDestaque` de `components/aprender`.
- Produces: a home começa por `<section aria-labelledby="titulo-topo">` (h1 `Entenda o que você compra antes de investir.`, CTA primário `Começar pelos artigos` → `ROTAS.aprender`, secundários `BotaoDemo` e "Criar minha conta") e `<section id="comece-por-aqui" aria-labelledby="titulo-comece">` com o artigo em destaque, 3 cartões e links "Ver todos os artigos" e "Glossário". A folha do aporte e as trilhas saem.

- [ ] **Step 1: E2E que falham** (`site.spec.ts`): trocar a asserção do h1 (linhas 25 e 162) para `"Entenda o que você compra"`; trocar o teste "a folha do topo mostra o aporte de outubro" por "o topo leva aos artigos": o link "Começar pelos artigos" tem `href` `/aprender`, e o botão "Pausar animação" alterna para "Retomar animação"; novo teste "comece por aqui mostra artigos reais": 3 cartões com link para `/aprender/<slug>` e o link "Ver todos os artigos".
- [ ] **Step 2:** `npx playwright test e2e/site.spec.ts` → FAIL (banco LOCAL; portas 3000/3333 livres).
- [ ] **Step 3:** Implementar (carregar `frontend-design` antes). As seções antigas que as Tarefas 6–8 substituem ficam no lugar por enquanto.
- [ ] **Step 4:** E2E da home → PASS; `npm run typecheck && npm run lint && npm test`.
- [ ] **Step 5: Commit** `feat(home): topo centrado em aprender e Comece por aqui com os artigos reais`.

### Task 6: Bento "Ativos e índices"

**Files:**
- Create: `frontend/src/components/site/bento-ativos-indices.tsx` (servidor) e `frontend/src/components/site/bento-ativos-indices.test.tsx`
- Modify: `frontend/src/app/(site)/page.tsx` (remove a seção "Os números de…" e põe o bento no lugar, sob o mesmo `<Suspense>` de hoje), `frontend/src/components/site/numeros-do-mes.tsx` (o conteúdo vira o bento; manter `NumerosDoMesFixos` e `NumerosDoMesAoVivo` como entradas do `Suspense`), `frontend/e2e/site.spec.ts`

**Interfaces:**
- Consumes: `numerosDoBento`, `QUANTIDADE_DE_FICHAS` (Tarefa 4); `Minigrafico`, `NumeroQueConta`, `Revelar`, `.interativo` (Tarefas 1 e 3); `lerDadosDosIndices({ prazoMs: 5000 })`.
- Produces: `<BentoAtivosIndices dados={ReturnType<typeof numerosDoBento>} />` dentro de `<section id="ativos-e-indices" aria-labelledby="titulo-ativos-indices">`, com estes quadros:
  - Ibovespa 2×2, fundo na cor da tinta, `NumeroQueConta` (formato `pontos`), variação no mês e `Minigrafico` (só quando houver);
  - Selic, IPCA 12 meses, juro real, IFIX;
  - Ações, FIIs e ETFs, com a quantidade de fichas e link para a lista.

  Cada quadro é um link `.interativo` com a explicação de uma frase que sobe no hover/foco (spec §5.D). No celular (abaixo de `md`): 2 colunas e a explicação sempre visível. A linha de fonte segue as regras atuais: ao vivo cita Banco Central, IBGE e B3 via Yahoo, com data e atraso de 15 min; na referência fixa diz "Referência fixa de {data}, não atualizada ao vivo".

- [ ] **Step 1: Testes que falham** (RTL): "ao vivo mostra o minigráfico do Ibovespa"; "na referência fixa não há minigráfico e a fonte diz referência fixa"; "os quadros de Ações, FIIs e ETFs mostram 15, 15 e 10 e levam às listas". E2E: "o bento a 390px não rola para o lado e mostra a explicação sem hover", com `page.setViewportSize({ width: 390, height: 844 })` e `scrollWidth <= clientWidth`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (unitário e E2E da home).
- [ ] **Step 5: Commit** `feat(home): ativos e índices num bento com os números do mês ao vivo`.

### Task 7: "Como ler um ativo" com explicações que se abrem

**Files:**
- Modify: `frontend/src/components/site/ativo-anotado.tsx` (reescrever `AtivoAnotado`; `PainelDeCriterios` continua), `frontend/src/app/(site)/page.tsx`
- Test: `frontend/src/components/site/ativo-anotado.test.tsx` (novo)

**Interfaces:**
- Consumes: `ExplicacaoQueAbre` (Tarefa 3); `ATIVO_DE_EXEMPLO` (Tarefa 4); de `lib/indicadores-explicados.ts`: `DICAS`, `ARMADILHAS`, `leituraPl`, `leituraPvpAcao`, `leituraDy`, `leituraRoe` e `leituraMargem` ou `leituraDivida`.
- Produces: `<section id="como-ler-um-ativo">` com o cabeçalho do TAEE11 (preço, data, fonte) e uma `ExplicacaoQueAbre` por indicador: P/L, P/VP, DY, ROE e margem líquida (ou dívida/EBITDA, se a margem vier `null`).
  - Sempre visíveis: o valor e a frase de `leitura*`.
  - Ao abrir: a conta com os números do exemplo (ex.: `preço ÷ lucro por ação = P/L`), a explicação de `DICAS` e a armadilha de `ARMADILHAS` quando houver.
  - **Régua só no P/VP**: "abaixo / acima do patrimônio contábil", com o marcador na posição de `pvp` relativa a 1,0. Nenhum texto com "barato" ou "caro".

  Ao lado, `PainelDeCriterios` com o link "Ver os indicadores da minha carteira".

- [ ] **Step 1: Testes que falham**:
  - "mostra os cinco indicadores com valor e frase sempre visíveis";
  - "abrir o P/L mostra a conta preço ÷ lucro por ação com os números do exemplo";
  - "só o P/VP tem régua";
  - "nenhum texto da seção diz barato, caro, compre ou oportunidade" (regex sobre `container.textContent`, case-insensitive);
  - "o painel de critérios continua com o link da carteira".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(home): como ler um ativo com explicações que se abrem`.

### Task 8: "Organize a sua carteira" com o desafio compacto, e limpeza da home

**Files:**
- Modify: `frontend/src/app/(site)/page.tsx`, `frontend/src/components/site/desafio-aporte.tsx` (só a moldura: largura e espaçamento compactos; a lógica não muda), `frontend/e2e/site.spec.ts`, `frontend/src/lib/navegacao.ts` (se algum link mudar), `frontend/src/lib/site-dados.ts` (remover o que ficou sem uso)

**Interfaces:**
- Consumes: `DesafioAporte`, `CARTEIRA_DE_NOVEMBRO`, `APORTE_DO_DESAFIO`, `BotaoDemo`, `Revelar`, `.interativo`.
- Produces: `<section id="organize-a-carteira">` (título "Organize a sua carteira") com três cartões `.interativo` (aporte do mês → `ROTAS.simulacao`, carteira e preço médio → `ROTAS.dashboard`, relatórios com IA → `ROTAS.relatorios`), o desafio compacto dentro de `<div id="desafio">` (âncora preservada) e a chamada da demonstração.
  - Saem as seções "Agora é com você", "Cada número vem com a explicação ao lado" (substituída na Tarefa 7), "O que você faz no PortfolioLab" e "Comece pela carteira de demonstração".
  - Ordem final da página: topo, Comece por aqui, Ativos e índices, Como ler um ativo, Organize a sua carteira.
  - Todas as seções abaixo da primeira dobra entram com `Revelar` (cascata de 90 ms nos grupos de cartões).

- [ ] **Step 1: E2E que falham:** os testes do desafio em `site.spec.ts` (linhas 67–122) continuam e precisam passar com `goto("/#desafio")`; novo "a home tem as cinco seções na ordem" (ids na ordem acima); novo "o menu Aprender ainda leva ao desafio".
- [ ] **Step 2:** FAIL. **Step 3:** implementar e remover o código morto (`grep` por `TRILHAS`, `FERRAMENTAS`, `FolhaDoAporte`, `DEFINICOES`). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(home): organize a sua carteira com o desafio compacto; home em cinco seções`.

### Task 9: Checkpoint da Fase 1

- [ ] **Step 1:** carregar `animation-performance` e `review-animations` e rodá-las sobre o diff da Fase 1. Corrigir os achados de severidade alta (curva errada, propriedade cara, animação em ação frequente).
- [ ] **Step 2:** `rodar-testes-seguro` completo: backend (`prisma validate`, `tsc`, `npm test`), frontend (`typecheck`, `lint`, `npm test`, `build`), `npx playwright test` e `npm run test:e2e:ativos`.
- [ ] **Step 3:** capturas a 1440 e 390 px da home (script descartável na pasta temporária, apagado depois) e conferência visual contra a spec §5–6.
- [ ] **Step 4: Commit** das correções: `fix(movimento): ajustes da revisão de movimento da fase 1`.

---

## Fase 2 — Site público

### Task 10: Padrão A nas listas e cartões públicos, no login e no cadastro

**Files:**
- Modify: `frontend/src/components/aprender/card-artigo.tsx`, `artigo-em-destaque.tsx`, `lista-de-artigos.tsx` (filtros), `glossario.tsx` (itens com link), `frontend/src/app/(site)/aprender/page.tsx` (atalhos de "Consulta rápida"), `frontend/src/components/ativos/lista-de-ativos.tsx`, `frontend/src/components/indices/card-de-indice.tsx`, `ordenar-indices.tsx` (chips), `frontend/src/components/ui/botao.tsx`
- Test: `frontend/src/components/movimento/constancia.test.tsx` (novo)

**Interfaces:**
- Consumes: `.interativo` e `.seta` (Tarefa 1).
- Produces:
  - `Botao` ganha resposta ao toque/clique: `:active` com `scale(.98)` em `--duracao-rapida`, e hover/foco com a transição de cor nos tokens. Ela vale no login, no cadastro e em todo o site.
  - Cartões e links de entrada usam `.interativo`; setas de "Ler o artigo", "Ver gráfico" e "Abrir" ganham `.seta`.

- [ ] **Step 1: Teste que falha.** `constancia.test.tsx` renderiza `CardArtigo`, `ArtigoEmDestaque`, `CardDeIndice` e um item de `ListaDeAcoes` e afirma que o elemento clicável tem a classe `interativo` e que a seta tem `seta`. Também afirma que `Botao` tem a classe de `:active` definida no componente.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; E2E `test:e2e:ativos` e `site.spec` sem regressão.
- [ ] **Step 5: Commit** `feat(movimento): cartões e botões do site público com a mesma microinteração`.

### Task 11: Padrão B nos gráficos e no destaque das fichas

**Files:**
- Modify: `frontend/src/components/ativos/grafico-de-preco.tsx`, `frontend/src/components/indices/grafico-de-area.tsx`, `grafico-de-barras.tsx`, `frontend/src/components/indices/painel-do-indice.tsx` (ou onde mora o número do topo da ficha de índice), o cabeçalho de preço da ficha de ativo (`frontend/src/components/ativos/pecas.tsx` ou `blocos-da-ficha.tsx`, onde estiver)

**Interfaces:**
- Consumes: `DURACAO_GRAFICO_MS` (Tarefa 2); `NumeroQueConta` (Tarefa 3).
- Produces: os 5 `isAnimationActive={false}` viram `isAnimationActive` com `animationDuration={DURACAO_GRAFICO_MS}` e `animationEasing="ease-out"`. O número do topo da ficha de índice e o preço da ficha de ativo usam `NumeroQueConta` (formatos `pontos`/`percentual` e `brl`).

- [ ] **Step 1: Teste que falha:** um teste em `src/components/movimento/constancia.test.tsx` lê os arquivos dos três gráficos como texto e afirma que nenhum contém `isAnimationActive={false}` e que todos importam `DURACAO_GRAFICO_MS`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; E2E `test:e2e:ativos` (os testes que leem o número do topo continuam passando, porque o `sr-only` traz o valor final; ajustar o seletor se algum lia o texto visível).
- [ ] **Step 5: Commit** `feat(movimento): gráficos das fichas se desenham e o destaque conta`.

### Task 12: Padrão C nas fichas e na lista de artigos

**Files:**
- Modify: `frontend/src/app/(site)/ativos/acoes/[ticker]/page.tsx`, `fiis/[ticker]/page.tsx`, `etfs/[ticker]/page.tsx`, `indices/[slug]/page.tsx`, `frontend/src/components/aprender/lista-de-artigos.tsx`

**Interfaces:**
- Consumes: `Revelar` (Tarefa 3).
- Produces: nas fichas, os blocos abaixo da primeira dobra (indicadores, resultados, proventos, notícias, relatórios, tabelas) ficam envolvidos em `Revelar`; o cabeçalho e o primeiro bloco **nunca**. Na lista de artigos, os grupos de cartões entram em cascata de 90 ms.

- [ ] **Step 1: Teste E2E que falha** (em `ativos.spec.ts`, com o stub): "a ficha mostra o cabeçalho sem esperar animação" (o h1 e o preço ficam visíveis logo no carregamento) e "o bloco de indicadores aparece ao rolar até ele".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS em `npm run test:e2e:ativos`.
- [ ] **Step 5: Commit** `feat(movimento): fichas e lista de artigos revelam os blocos ao rolar`.

### Task 13: Padrão F nas fichas e em "Indicadores explicados"

**Files:**
- Modify: `frontend/src/components/ativos/indicadores-da-ficha.tsx` (`Indicador`, `Armadilha`), `frontend/src/app/(site)/aprender/indicadores/page.tsx`
- Test: `frontend/src/components/ativos/indicadores-da-ficha.test.tsx` (novo ou existente)

**Interfaces:**
- Consumes: `ExplicacaoQueAbre` (Tarefa 3); `DICAS`, `ARMADILHAS`.
- Produces:
  - Nas fichas, cada `Indicador` mostra sempre o valor e a frase de leitura; o corpo que se abre traz a explicação de `DICAS`, a armadilha do indicador quando houver (sai do bloco solto que fica sempre aberto hoje) e o link "Saiba mais". Nenhum número novo é calculado na ficha.
  - Em "Indicadores explicados", cada indicador vira uma `ExplicacaoQueAbre` com a fórmula e o exemplo atuais no corpo. O resumo de uma linha fica sempre visível.

- [ ] **Step 1: Testes que falham:** "o valor e a frase do indicador ficam visíveis fechado"; "a armadilha aparece só ao abrir"; "o link Saiba mais continua lá"; E2E dos ativos ajustado para abrir o indicador antes de ler a armadilha.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (unitário e `test:e2e:ativos`).
- [ ] **Step 5: Commit** `feat(movimento): indicadores das fichas e da aba Aprender com explicações que se abrem`.

### Task 14: Checkpoint da Fase 2

Igual à Tarefa 9, sobre o diff da Fase 2, com `mobile-native` incluída na revisão das fichas no celular.

---

## Fase 3 — Área logada

> Estado complexo no dashboard: **Opus** (regra do `CLAUDE.md`).

### Task 15: Padrões A, B e F na área logada

**Files:**
- Modify: `frontend/src/components/site/abas-da-carteira.tsx`, `frontend/src/app/(app)/dashboard/page.tsx`, `frontend/src/app/(app)/carteira/page.tsx`, `frontend/src/app/(app)/indicadores/page.tsx`, `frontend/src/app/(app)/noticias/page.tsx`, `frontend/src/components/historico-transacoes.tsx`, `frontend/src/components/proventos-card.tsx`

**Interfaces:**
- Consumes: `.interativo`, `.seta`, `DURACAO_GRAFICO_MS`, `NumeroQueConta`, `ExplicacaoQueAbre`.
- Produces:
  - **A:** abas, cartões e links clicáveis da área logada com `.interativo` e botões com o `Botao` da Tarefa 10. As linhas da tabela de posições e do histórico **não** sobem, para não distrair a leitura: só ganham fundo no hover, nos tokens.
  - **B:** gráficos do Recharts do dashboard com `animationDuration={DURACAO_GRAFICO_MS}`; o patrimônio total usa `NumeroQueConta` (formato `brl`).
  - **F:** a tela de Indicadores da carteira explica cada indicador com `ExplicacaoQueAbre`.
  - A entrada `.reveal` do dashboard continua como está (já nos tokens). Nenhuma entrada animada nova na área logada.

- [ ] **Step 1: Testes que falham:** em `constancia.test.tsx`, as abas têm `interativo`; um teste do patrimônio total afirma que o `sr-only` traz o valor final em reais; o E2E `area-logada.spec.ts` e o `historico-transacoes.spec.ts` continuam passando.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (unitário e `npx playwright test`).
- [ ] **Step 5: Commit** `feat(movimento): área logada com a mesma microinteração, gráficos e explicações`.

### Task 16: Checkpoint final e documentação

- [ ] **Step 1:** `review-animations` e `animation-performance` sobre a branch inteira; corrigir os achados de severidade alta.
- [ ] **Step 2:** `rodar-testes-seguro` completo (backend, frontend, build, os dois E2E).
- [ ] **Step 3:** `CLAUDE.md` (seção Frontend): uma regra curta, "movimento só com o kit (`globals.css` tokens, `lib/movimento.ts`, `components/movimento/`); nada de curva ou duração à mão; sem `prefers-reduced-motion` (decisão do dono); botão de pausa em movimento contínuo". Em `docs/arquitetura.md`, uma linha na seção Frontend apontando para o kit.
- [ ] **Step 4: Commit** `docs: kit de movimento no CLAUDE.md e na arquitetura`.
