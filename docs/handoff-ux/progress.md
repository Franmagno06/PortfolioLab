# SDD ledger — plan: docs/superpowers/plans/2026-10-20-ux-movimento-e-home.md

Branch: feat/ux-movimento. Start HEAD: 7d099f0. Spec: docs/superpowers/specs/2026-10-20-ux-movimento-e-home-design.md (aprovado). Tasks 1-16 numéricas (task-brief ok).
Contexto comum a todo implementador: .superpowers/sdd/2026-10-20-ux-movimento-e-home/constraints.md (Goal/Arquitetura/Global Constraints/Review Focus).
Fases: 1 = T1-9 (kit+home), 2 = T10-14 (público), 3 = T15-16 (logada).

## Pre-flight scan
| Par / tarefa | Produz x consome | Achado |
|---|---|---|
| T1 -> T3,10,15 | classes .interativo/.seta/.revelar + tokens | consistente |
| T2 -> T3,4,6,11 | desacelerar, valorNaContagem, caminhoDoMinigrafico, DURACAO_GRAFICO_MS | consistente |
| T3 -> T5,6,7,11,12,13,15 | Revelar, NumeroQueConta, ExplicacaoQueAbre, GraficoDeFundo, Minigrafico | consistente; props só de dados |
| T4 -> T5,6,7 | ATIVO_DE_EXEMPLO novo, artigosParaComecar, numerosDoBento, QUANTIDADE_DE_FICHAS | consistente |
| T5,6,7,8 | todos editam (site)/page.tsx e site.spec.ts | sequenciais; ok |
| T5 deleta folha-do-aporte | T8 usa DesafioAporte (não a folha) | ok |
| T6 numeros-do-mes.tsx | testes existentes numeros-do-mes.test.tsx | implementador atualiza; ok |
| T10 Botao | T15 depende do Botao da T10 | ordem ok |
| T11 e T6 | NumeroQueConta usa format.ts | ok |
| T12/T13 | tocam páginas de ficha e E2E dos ativos (stub) | sequenciais; ok |
| cada tarefa internamente | testes x arquivos | ok (T4 consome backend local rodando) |

Ruling: R1 — Modelos por tarefa: T3 (kit base reutilizado no site todo), T4 (número de mercado/conteúdo) e T15 (estado do dashboard) em Opus; demais em Sonnet; revisores Sonnet, Opus em T3/T4/T15; checkpoints e revisão final Opus — CLAUDE.md pede Opus para conteúdo com número de mercado e estado complexo; kit errado se replica — custo se errado: gasto maior.
Ruling: R2 — Porta 3333: o backend de auditoria (PID 15188/21172, iniciado 17:50 por mim) segue ocupando a porta e o sistema de permissões negou encerrá-lo. T4 USA esse backend (banco local) para ler a ficha do TAEE11. As tarefas com Playwright principal (T5+) exigem a porta livre: se ainda estiver ocupada na hora, o implementador roda só o que não precisa dela (vitest, tsc, lint, build, test:e2e:ativos) e relata o E2E principal como NÃO executado; eu peço ao usuário para liberar e rodo no checkpoint. — custo se errado: E2E principal só roda no checkpoint.

Task 1: review -> Needs fixes. Important: (1) `motion-reduce:transition-none` sobrou em components/site/desafio-aporte.tsx:177; (2) teste-guarda só lê globals.css (não pega o resto de src).
Task 1: minor (deferred): `.interativo` + overflow-hidden no pai corta sombra (T6/T8: não pôr direto dentro de overflow-hidden); desafio-aporte.tsx anima `width` (transition-[width]) -> T8 deve trocar por scaleX com tokens; teste só confere strings.
Ruling: R3 — fix round 1 da Task 1 inclui, além dos 2 Important: `.interativo:has(:focus-visible)` (cartão com link dentro reage ao foco do teclado), `@media (scripting: none)` mostrando `.revelar`, e novo token `--duracao-entrada: 600ms` usado por `.revelar` e `.reveal`, e `.abrir-menu` passa a `var(--duracao-rapida) var(--curva)` — a regra do plano é "nenhuma duração/curva à mão fora dos tokens"; Revelar (T3) deve tornar visível de imediato se não houver IntersectionObserver — custo se errado: pequena diferença visual (menu 120->160ms).
Task 1: fix round 1/5 (implementer: all addressed; pending re-review; commits 6a6af05..8885b15)
Task 1: fix round 1/5 (3 addressed, 0 open; commits 6a6af05..8885b15)
Task 1: minor (deferred): `.interativo:has(:focus-visible)` no mesmo seletor-lista: navegador sem :has() (Firefox <121) derrubaria a regra inteira — aceito (suporte amplo); guarda do teste cobre só src (não e2e); atraso da cascata .reveal-2..4 fica à mão (é deslocamento, não duração).
Task 1: complete (commits 7d099f0..8885b15, review clean after 1 fix round)

Task 2: review -> Needs fixes. Important: (1) NaN vaza de desacelerar/valorNaContagem (Math.max/min com NaN; duração NaN passa o guard <=0); (2) testes da contagem fracos (sem final negativo/fracionário, tempo negativo, NaN, monotonia; título "não passa do valor final no meio" não afirma nada).
Task 2: minor (deferred -> inclui no fix): -0 quando final negativo e tempo <=0 (normalizar); comentário do espaçamento de x ao descartar não finitos; sem teste de valores negativos/largura 0/altura 0 no caminho.
Task 2: fix round 1/5 (implementer: addressed; pending re-review; commits 8e6c110..21c4e96)
Task 2: fix round 1/5 (3 addressed, 0 open; commits 8e6c110..21c4e96)
Task 2: minor (deferred): caminhoDoMinigrafico não protege largura/altura NaN; comentário longo.
Task 2: complete (commits 8885b15..21c4e96, review clean after 1 fix round)

Task 3: review (opus) -> Needs fixes. Important: (1) NumeroQueConta: número já visível no 1º paint mostra final -> pisca 0 -> conta (viola "sem flash de 0"); (2) Minigrafico: mesma regressão (linha cheia -> some -> redesenha); (3) botão de pausa do GraficoDeFundo pode ficar sob o conteúdo do topo e virar inclicável (WCAG 2.2.2); (4) aria-pressed + rótulo que muda ("Retomar, pressionado") desinforma.
Task 3: minor (deferred/incluídos no fix): rotulo/valor ReactNode dentro de <button> (documentar só texto); hover:bg grudado em toque (aceito); possível ponto redondo no início do traço (dasharray 1 2); `linear` da deriva à mão (aceito, é movimento constante); Revelar não deve envolver o topo/LCP (documentar); observador-falso.ts importa vitest dentro de src (aceito).
Ruling: R4 — fix round 1 da Task 3: (a) NumeroQueConta e Minigrafico só animam se o elemento foi visto FORA da tela primeiro (o hook expõe `passouPorFora`); número/linha já visíveis no 1º paint ficam no valor final, sem animar (coerente com "a primeira dobra nunca espera animação", spec §5.1) — custo: números do topo da página não contam, só os que entram ao rolar; (b) botão de pausa com `z-20` e comentário de uso atualizado; (c) GraficoDeFundo: REMOVER aria-pressed e manter o rótulo "Pausar animação"/"Retomar animação" (padrão APG: rótulo que muda não leva aria-pressed; a spec diz "alterna para Retomar"); (d) docs: rotulo/valor só texto; Revelar não envolve topo/LCP; (e) `stroke-dasharray: 1 2` em .tracar-espera se o ponto redondo for plausível.
Task 3: fix round 1/5 (implementer: 4 Important + minors addressed; pending re-review; commits e027790..5050d10)
Task 3: fix round 1/5 (5 addressed, 1 open — novo Important vindo do fix: leitura que intersecta mas fica abaixo do limiar (ex.: 40% visível, limiar 0.5) marca passouPorFora=true e traz de volta o piscar/redesenho na faixa da dobra; commits e027790..5050d10)
Ruling: R5 — fix round 2 da Task 3: `passouPorFora` só vira true quando a leitura NÃO intersecta (`!isIntersecting`); elemento parcialmente visível no 1º paint fica estático no valor final/linha cheia; Minigrafico aplica `tracar-espera` só quando fora && passouPorFora; teste com 1ª leitura 0.4 (NumeroQueConta e Minigrafico) — custo: elemento cortado na dobra nunca anima.
Task 3: fix round 2/5 (implementer: addressed; pending re-review; commits 5050d10..7c8cb57)
Task 3: fix round 2/5 (1 addressed, 0 open; commits 5050d10..7c8cb57)
Task 3: minor (deferred): JSDoc de usar-visibilidade.ts com linha longa; elemento alto demais (> viewport) que só cruza o limiar final não é afetado; área preenchida e ponto final do minigráfico (spec §5.B) ainda NÃO construídos (fora do contrato da T3) — decidir na T6/T11 se entram; sensação do movimento ainda não vista em navegador real.
Task 3: complete (commits 21c4e96..7c8cb57, review clean after 2 fix rounds)

## PAUSA PEDIDA PELO USUÁRIO (20/10/2026, após a Task 3)
Retomar na Task 4 (Opus, dados da home: exemplo do TAEE11 numa data só; pede o backend local no ar — a porta 3333 pode ainda estar ocupada pelo backend da auditoria PID 15188/21172; T4 pode usá-lo). Antes das tarefas com Playwright principal (T5+), a porta 3333 precisa estar livre.
Tarefas concluídas: 1, 2, 3. Pendentes: 4-16. Branch feat/ux-movimento (HEAD 7c8cb57). Rulings R1-R5 acima.
Ledger: retomada em 20:04; T4 usa o backend local em :3333

Task 4: review (opus) -> Needs fixes. Important: components/site/ativo-anotado.tsx (consumidor na home) ainda mostra "R$ 3,01" (brl arredonda 3,0065), "6,6%" (percentual 1 casa) e "20,9%" ao lado de "Gerou R$ 20,86" — mistura arredondamentos e contradiz artigos/indicadores.ts/como-calculamos (sem teste do componente).
Task 4: minor: R$ com 4 casas montado à mão (`R$ ${numero(v,4)}`, espaço normal) em como-calculamos/page.tsx:143 e content/aprender/indicadores.ts:476 -> helper em format.ts; dividendYieldPct recebe "centavos" fracionários (documentar); DY de como-calculamos sem data/fonte; lacunas de teste de home-dados (empate, mês faltando, não finito, menos artigos que `quantos`); stub E2E ainda com valores antigos do TAEE11 (aceito); palavras antigas fora do escopo ("cara ou barata?", "bom sinal", "pechincha") em pl-e-pvp.mdx/roe-margem/indicadores.ts:484 (pré-existentes, NÃO tocadas) -> registrar p/ revisão editorial futura.
Ruling: R6 — fix round 1 da Task 4 corrige o Important + minors 2,3(doc),4,6; NÃO muda `artigosParaComecar` (segue "mais recentes", como no plano); o risco editorial do bump de atualizadoEm (a seção iniciante poderia abrir com artigos de análise de ações) é tratado na T5: a home filtra/ordena por categoria "antes de investir" e "renda fixa" primeiro ao escolher os 3 cartões — custo se errado: ajuste de seleção na T5.
Task 4: fix round 1/5 (implementer: addressed; pending re-review; commits 96cbf04..73d69ee)
Task 4: fix round 1/5 (all addressed, 0 open; commits 96cbf04..73d69ee)
Task 4: minor (deferred): regra "mês faltando → null" em numerosDoBento é aperto documentado além do brief (sparkline some sem sinal se a série vier esparsa); teste compara NBSP literal em regex (trocar por escape \u00a0 se for mexer); stub E2E dos ativos ainda com valores antigos do TAEE11; palavras antigas fora do escopo (cara ou barata/bom sinal/pechincha) para revisão editorial.
Task 4: complete (commits 7c8cb57..73d69ee, review clean after 1 fix round)
Ruling: R7 — Docker Desktop está desligado (o sistema não permite ligá-lo) e o Playwright principal sobe um backend que exige o banco; T5-T8 escrevem e atualizam os E2E (verificados só com `npx playwright test --list` e leitura cuidadosa), rodam vitest/RTL/typecheck/lint/build e `test:e2e:ativos` (sem Docker, se tocarem nas fichas), e RELATAM o E2E principal como NÃO executado; o E2E principal roda no checkpoint T9 (pedir ao usuário que abra o Docker) — custo se errado: falhas de E2E só aparecem no checkpoint.
Ruling: R8 — seleção dos 3 cartões de "Comece por aqui" (T5): preferir artigos das categorias iniciantes ("antes de investir", "renda fixa") antes de completar com as demais, por data; o destaque da home continua o `artigoEmDestaque()` — o bump de atualizadoEm da T4 não deve fazer a seção de iniciantes abrir só com análise de ações.

Task 5: review -> Needs fixes. Important: (1) numeros-do-mes.tsx:35 ainda com `lg:pt-[168px]` (folga da folha removida): ~264px vazios sob o topo no desktop; (2) hierarquia de títulos: ArtigoEmDestaque (h2) vira irmão da seção "Comece por aqui" e os cards h3 ficam filhos do destaque -> destaque deve ser h3 na home (prop `nivelDoTitulo`).
Task 5: minor: botão de pausa vem antes do h1 na ordem do foco (aceito, controle WCAG 2.2.2); `.interativo` na seção do destaque sugere clicabilidade que não existe (só o botão clica) -> tirar do painel; teste de linguagem só olha o topo (estender a barato/caro e à seção Comece por aqui); E2E NÃO executados (R7).
Ruling: R9 — fix round 1 da Task 5: reduz o padding do topo de numeros-do-mes (e NumerosDoMesFixos) para o ritmo das outras seções (T6 reescreve a seção, mas não pode ficar regressão visual entre as tarefas); ArtigoEmDestaque ganha `nivelDoTitulo?: "h2"|"h3"` (padrão h2) e a home usa h3; `.interativo` sai do painel do destaque (a seta anda quando o botão recebe hover/foco); teste de linguagem estendido.
Task 5: fix round 1/5 (implementer: addressed; pending re-review; commits f5b74cb..08a53d8)
Task 5: fix round 1/5 (4 addressed, 0 open; commits f5b74cb..08a53d8)
Task 5: minor (deferred): E2E do site NÃO executados (R7); espaçamento/contraste do topo não visto em navegador real; hover:bg-ink-lift do link do destaque troca sem transição (igual ao CTA do topo).
Task 5: complete (commits 73d69ee..08a53d8, review clean after 1 fix round)
Task 6: minor (deferred -> T9): contraste de `text-loss` (#d94f5c) sobre o quadro navy do Ibovespa ~4,4:1 (< 4,5) -> usar coral mais claro nesse quadro; comentário numerado "2." duplicado em page.tsx:118; Suspense troca fixo->ao vivo remonta os `Revelar` (re-entrada breve, padrão conhecido); "Juro real" liga à página da Selic (documentado e testado); E2E do bento NÃO executados (R7).
Task 6: complete (commits 08a53d8..4fd6b16, review clean, sem rodada de correção)

Task 7: review (opus) -> Needs fixes. Important: (1) jargão de desenvolvedor na home, 2x: `fonte` do exemplo = "Yahoo Finance, calculado como o job de indicadores calcula"; (2) ROE 20,86% contradiz os números logo acima (4,75/23,40 = 20,30%): o ROE vem pronto do Yahoo (financialData.returnOnEquity) com base própria; (3) TAEE11 é Unit, mas as contas dizem "por ação" (lucro/patrimônio são por Unit); (4) faltam os links da spec §6.4 (ficha do TAEE11 e Indicadores explicados).
Task 7: minor: régua do P/VP sem rótulos de escala 0/1,0/3+, rótulo "abaixo" cruza o tique de 1,0, "1,0" solto 36px abaixo do tique, P/VP negativo leria "abaixo"; fórmula repetida (caixa Conta + 1ª frase de DICAS — DICAS é compartilhado com a ficha, não mexer); KIT: nome do botão do ExplicacaoQueAbre sem espaço ("Preço/lucro (P/L)9,66") e resumo sem aria-describedby; o implementador NÃO leu as skills de design antes do JSX (o revisor as leu).
Ruling: R10 — fix round 1 da Task 7: (1) `fonte` vira "Yahoo Finance; indicadores calculados pelo PortfolioLab" (atualiza como-calculamos e testes) e a home mostra a fonte UMA vez; (2) corpo do ROE: fórmula + resultado + frase "O ROE vem pronto do Yahoo Finance, com a base de cálculo dele; por isso não coincide exatamente com a razão dos valores por Unit mostrados acima." (verificável: quotes.provider.ts lê financialData.returnOnEquity); (3) contas rotuladas "por Unit" + uma linha explicando a Unit com o texto já existente de DICAS.especie, SEM afirmar "3 ações" (não há fonte no repositório); (4) links "Ver a ficha do TAEE11" (/ativos/acoes/TAEE11) e "Indicadores explicados" no cabeçalho/rodapé da seção; régua: rótulos 0 · 1,0 · 3+, rótulos "abaixo/acima" ancorados ao tique de 1,0, tique rotulado junto; KIT: espaço entre rótulo e valor no nome acessível do botão do ExplicacaoQueAbre + teste — custo se errado: ajuste de copy.
Task 7: fix round 1/5 (implementer: addressed; pending re-review; commits 67ef27a..7b841a7; implementador só folheou as skills de design de novo)
Task 7: fix round 1/5 (5 addressed, 1 open + 1 novo Important: Unit só genérica, a página nunca diz que TAEE11 é Unit; E2E `site.spec.ts:73` ainda espera "preço ÷ lucro por ação = P/L" e vai falhar; commits 67ef27a..7b841a7)
Ruling: R11 — fix round 2 da Task 7: frase "O TAEE11 é uma Unit. {DICAS.especie.texto}" (backed por ativos-catalogo.ts "Taesa Unit"); E2E:73 → "preço ÷ lucro por Unit = P/L"; nota do ROE diz "mostrados nas contas do P/L e do P/VP" (os valores estão em corpos fechados); título do teste ativo-anotado.test.tsx:54 ajustado — lição: o implementador não rodou E2E (Docker off) e errou o seletor; checar seletores de E2E por grep a cada mudança de texto.
Task 7: fix round 2/5 (implementer: addressed; pending re-review; commits 7b841a7..a614a85)
Task 7: fix round 2/5 (3 addressed + 1 open: regex sem barra `/d+ ações/` em ativo-anotado.test.tsx:177 deixava a guarda inócua; commits 7b841a7..a614a85)
Task 7: fix round 3/5 (1 addressed, 0 open — diff de 8 linhas conferido pelo controlador; commit 9eb3434)
Task 7: minor (deferred): ROE/margem sem contas completas (o exemplo não tem lucro/patrimônio/receita; honesto); fórmula repetida (caixa Conta + 1ª frase de DICAS compartilhada com a ficha); trilho da régua bg-mute/40 ~1,75:1 (decorativo; tique e marcador carregam a informação); E2E "abrir o P/L mostra a conta" NÃO executado (R7); LIÇÃO: ferramentas do implementador podem comer barras invertidas em heredocs — conferir regex com \d/\s nos testes novos (Edit tool).
Task 7: complete (commits 4fd6b16..9eb3434, review clean after 3 fix rounds)

## ENCERRAMENTO PEDIDO PELO USUÁRIO (21/10/2026) — "Finalize por aqui"
Tarefas concluídas e aprovadas: 1, 2, 3, 4, 5, 6, 7 (HEAD 9eb3434 em feat/ux-movimento, árvore limpa). A Task 8 foi despachada mas PARADA antes de qualquer alteração (agente lendo as skills): reinício do zero.
Pendentes: 8 (Organize a sua carteira + limpeza da home + desafio com scaleX em vez de width), 9 (checkpoint da fase 1), 10-14 (fase 2: site público), 15-16 (fase 3: área logada + docs). Rulings R1-R11 acima.
Pré-requisitos para retomar: Docker Desktop ligado (E2E principal, `npm run db:local`), portas 3000/3333 livres. NENHUM E2E principal das tasks 5, 6, 7 foi executado (R7): rodar `npx playwright test` no checkpoint T9 e corrigir o que quebrar (seletores foram só lidos).
Menores diferidos que o checkpoint T9 deve tratar: contraste de `text-loss` sobre o navy do bento (~4,4:1); comentário "2." duplicado em page.tsx:118; stub E2E dos ativos com valores antigos do TAEE11; palavras antigas "cara ou barata/bom sinal/pechincha" (revisão editorial); trilho da régua P/VP; área preenchida e ponto final do minigráfico (spec §5.B) não construídos; sensação do movimento nunca vista em navegador real (olhar a home a 1440 e 390 px no T9).

## RETOMADA (28/10/2026): Docker ainda DESLIGADO (R7 continua valendo); despachando Task 8 do zero.
Task 8: minor (deferred -> T9): títulos dos 3 cartões de "Organize a sua carteira" são <span>, não h3 (saída h2 -> h3 do desafio, sem heading por cartão): trocar por h3 dentro do <a>; ponta direita da barra do desafio ficou reta com scaleX (aceito); teste "vem depois de" em page.test.tsx frágil (o E2E das cinco seções cobre); E2E novos NÃO executados (R7).
Task 8: complete (commits 9eb3434..9ff2ca8, review clean, sem rodada de correção). A ordem da home foi corrigida nesta tarefa (o bento vinha antes de "Comece por aqui" desde a T6).
Fase 1 pronta menos o checkpoint T9. HEAD 9ff2ca8.

## TRANSFERÊNCIA PARA SESSÃO EM NUVEM (28/10/2026)
O usuário pediu que a sessão em nuvem continue a partir da Task 9. Pacote em docs/handoff-ux/ (LEIA-ME.md, progress.md, constraints.md) + spec e plano adicionados à força (git add -f) na branch feat/ux-movimento; branch enviada ao origin.

## SESSÃO EM NUVEM (28/10/2026): Tasks 9 a 16 concluídas (HEAD b92e0c5 em feat/ux-movimento)
Pronto para o dono revisar; nada foi mergeado na main, nenhum deploy. Cada tarefa teve revisão independente (agente Opus, somente leitura) e as correções entraram em commits `fix(movimento)`. A Task 15 foi implementada por agente Opus (regra do CLAUDE.md: estado complexo do dashboard).

**O que foi decidido na execução**
- `Revelar` reescrito: o HTML do servidor já é o conteúdo final; só o que o observador viu inteiramente fora da tela ganha `.revelar-espera` (escondido 16px abaixo) e a transição roda ao tirar a classe. Resolve a primeira dobra, âncoras e a troca do Suspense da home. Substitui o `.revelar` com opacidade 0 de partida; `@media print` mostra tudo.
- `.interativo`: `:hover` só em `(hover: hover) and (pointer: fine)`; foco de teclado sempre; `:active` em `--duracao-rapida`; no toque afunda (`scale(.98)`) sem subir; cartão levantado ou com balão da Dica aberto sobe de z-index (`:has([role="tooltip"]:not([hidden]))`). `.interativo-aba`: aba da carteira só muda a cor do traço. `.toque`: botões, chips, letras (afunda ao toque, só se clicável). `.linha-de-tabela`: só fundo. `.cascata`: atraso por coluna (1, 2 ou 3).
- Tailwind `transition-*` agora usa os tokens (`--default-transition-duration/-timing-function` no `@theme`). `-webkit-tap-highlight-color: transparent` no `html`.
- Gráficos Recharts: série com `DURACAO_GRAFICO_MS` e `CURVA` (espelho de `--curva` em `lib/movimento.ts`); Tooltip sem animação. Gráficos de índice e a pizza do dashboard desenham só na entrada (`desenhou` + `onAnimationEnd`), trocar período/filtro é instantâneo. Ponto final do gráfico de preço só depois da linha.
- Fichas: `NumeroQueConta` no preço e no valor de hoje da taxa; `Secao` envolve o card em `Revelar` (o bloco do preço, `revelar={false}`); indicadores com `ExplicacaoQueAbre` ("Entender melhor", só onde há armadilha ou link; o "?" fica fora do botão); /aprender/indicadores com fórmula e exemplo numa explicação fechada.
- Área logada: abas, cartões e links com `.interativo`; indicadores da carteira ganharam a seção "O que cada indicador mede" (desvio do plano: a tela é uma tabela, não há valor único por indicador).
- Bug achado no checkpoint 2: a tabela `sr-only` do gráfico de preço alargava a ficha a 471px num celular de 390px; agora fica num recipiente `relative overflow-hidden`, com E2E nas três fichas.
- Teste de notícias do CI vermelho era bug de código (regex sem `\`), corrigido na branch separada `fix/ci-vermelho` junto com o typecheck do frontend (`next typegen` antes do `tsc`). Ficaram na `fix/ci-vermelho`, que é esta branch mais esses 2 commits; o PR para a main leva tudo junto.

**O que NÃO foi verificado**
- Sensação do movimento em aparelho real (iOS e Android): hover preso, `:active`, clarão do toque, queda de quadros do Recharts na montagem (anima por JS), sincronia do número com a linha, layout shift ao abrir explicações no Safari. A conferência visual foi em Chromium headless a 1440 e 390 px (home, ficha de ação, indicadores).
- O E2E principal rodou contra um Postgres 16 nativo local (o Docker não existe na sandbox) e com Chromium via symlinks (versão 1194 no lugar da 1234); `NODE_USE_ENV_PROXY=1` foi necessário para o Node alcançar o Yahoo/BCB. `npm run db:local` nunca foi executado.
- `site.spec.ts` (bento) já falhou uma vez por "strict mode" (cópia escondida do streaming do Suspense) e `area-logada.spec.ts` "as abas rolam" falhou uma vez numa rodada completa e passou isolada e em reruns: flakes não explicados a fundo.
- `ativos.repository.test.ts` ("visitas simultâneas…") falhou em 2 de 6 rodadas completas do backend e passa isolada: concorrência no banco compartilhado, não tocado nesta branch.

**Menores diferidos (para o dono decidir)**
- `.reveal` do dashboard (600ms, atrasos escritos à mão, cobre a primeira dobra) segue como o plano mandou; contradiz a regra "primeira dobra nunca espera" (registrado no CLAUDE.md).
- `Botao` tamanhos `md` (36px) e `sm` (28px) abaixo de 44px; só alguns usos receberam `min-h-11`. Mexer em todos muda o layout de telas logadas.
- O patrimônio total do dashboard usa `NumeroQueConta` mas na prática nunca conta (está na primeira dobra e é renderizado no cliente depois do fetch); o mesmo vale para o preço e o valor de hoje nas fichas.
- Dinheiro somado em `number` no backend (`portfolio.service.ts` resumo) e no front (`agruparPorMes` do dashboard, totais da carteira): lógica antiga, fora do escopo, merece tarefa com `auditar-calculo-financeiro`.
- Testes de classe/CSS por regex em `movimento-css.test.ts` e `constancia.test.tsx` provam a presença do código, não o comportamento; os de comportamento são `revelar`, `minigrafico`, `numero-que-conta`, `secao`, `indicadores-da-ficha`, `pecas-da-ficha`, `cabecalho-do-ativo`, `dashboard/page.test`.
- Dois sistemas de escalonamento (`atrasoMs={i*90}` na home e `.cascata` na lista de artigos).
- Revisão editorial das palavras antigas "cara ou barata/bom sinal/pechincha" (R-anterior) não foi feita nesta sessão.
