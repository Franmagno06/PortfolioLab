# PortfolioLab — Página inicial nova e camada de movimento (design)

Data: 20/10/2026. Origem: conversa de brainstorming com o dono do projeto, com uma vitrine de padrões
aprovada no navegador (padrões A a F). Este documento descreve **o quê** e **por quê**; o **como**
passo a passo vem depois, no plano.

## 1. Intenção

O site está bem construído, mas **parado**: nada responde ao mouse além de troca de cor, os gráficos
aparecem prontos (a animação do Recharts está desligada de propósito com `isAnimationActive={false}`)
e a página inicial ficou para trás do produto.

Duas mudanças de rumo, nas palavras do dono:

1. **A ideia principal agora é aprender** conceitos de investimento: o que é um ativo, como ler um
   indicador. O gerenciamento da carteira (aporte, preço médio, proventos) **continua** e não pode ser
   descartado, mas passa a ser a segunda ideia, e não a porta de entrada.
2. **O site precisa ser mais vivo e interativo**: efeito ao passar o mouse, gráficos que aparecem,
   gráfico ao fundo. Movimento calmo e com propósito, que ajude a entender, não enfeite.

O dono também quer **aprender UX junto**: cada padrão aplicado deve ficar explicado (no código e no
relatório de cada tarefa) com o porquê e quando atrapalha, no mesmo espírito da vitrine.

## 2. Objetivos

- Página inicial reorganizada em torno de **aprender**, com conteúdo **atual** (os 14 artigos reais,
  os números do mês ao vivo, as fichas).
- Os seis padrões aprovados (A a F, seção 5) aplicados nos lugares descritos.
- **Constância em todo o site** (pedido explícito do dono): os padrões não podem deixar uma página mais
  fluida e mais fácil de entender e as outras para trás. O mesmo vocabulário de movimento e de
  explicação vale para o site público, o login/cadastro e a área logada (seção 5.1).
- Nenhuma piora de acessibilidade, desempenho ou honestidade dos números.

## 3. Não objetivos

- Não mudar a estrutura (layout, fluxos, dados) das telas da área logada nem das fichas: elas recebem os
  padrões, não um redesenho. A única tela redesenhada é a página inicial.
- Não trocar a identidade visual (cores, fontes, tokens de `globals.css`), nem adotar modo escuro.
- Não mexer em backend, API, banco ou regras de dinheiro.
- Não reescrever o conteúdo dos artigos da aba Aprender.

## 4. Anti-objetivos (o que faria isto fracassar mesmo funcionando)

- Movimento chamativo, que distrai da leitura, ou "tudo pulando": se tudo se mexe, nada se destaca.
- Animação que esconde ou atrasa informação (conteúdo que demora a aparecer parece página quebrada).
- Número que muda durante a animação e termina diferente do dado real, ou leitor de tela que anuncia
  os números intermediários de uma contagem.
- Página mais pesada a ponto de piorar o carregamento no celular ou causar "pulos" de layout.
- Texto com tom de recomendação ("compre", "melhores", "oportunidade"), proibido pelas regras de
  conteúdo do projeto.

## 5. Os padrões aprovados e onde entram

Referência: a vitrine aprovada pelo dono (já apagada a pedido dele). Os valores que ela usava e que valem
para a implementação:

- Tokens: rápido **160 ms**, médio **260 ms**, lento **0,9 s** (gráfico 1,1 s); curva única
  `cubic-bezier(.2,.8,.2,1)`.
- A: sobe **3 px** (`translateY(-3px)`), sombra `0 10px 24px -12px` na cor da tinta a ~33%, borda um tom
  mais escuro; seta anda **4 px**; no clique `translateY(-1px) scale(.995)`. Vale para `:hover` e
  `:focus-visible`.
- B: traço do SVG desenhado com `stroke-dasharray/dashoffset` em 1,1 s; área preenchida aparece junto
  (opacidade); ponto final surge ao terminar; contagem com desaceleração (cúbica) em 1,1 s; dispara uma vez
  ao ficar ~50% visível. No Recharts, a animação nativa com duração equivalente.
- C: sobe **16 px** e aparece em 600 ms; cascata de **90 ms**; dispara a ~30% visível.
- D: quadros com raio 14 px; o destaque (Ibovespa) ocupa 2×2 em tela larga com fundo na cor da tinta;
  no hover o quadro sobe 2 px e a explicação sobe 6 px e aparece; no celular, 2 colunas e explicação
  sempre visível.
- E: duas linhas, opacidade ~0,28 e ~0,18, deslocamento lateral de ~60 px em 14 s e 19 s, ida e volta;
  botão "Pausar animação" no canto (alterna para "Retomar").
- F: botão da linha inteira com `aria-expanded`; a altura abre por `grid-template-rows: 0fr → 1fr` em
  260 ms; a seta gira 180°; o marcador da régua desliza em 700 ms.

**A. Microinteração no cartão.** Ao passar o mouse **ou focar com o teclado**, o cartão sobe ~3 px,
ganha sombra suave e a seta do link anda ~4 px; no clique, afunda levemente. ~260 ms. Entra em: cartões
de artigo (`card-artigo`, `artigo-em-destaque`), cartões da listagem de ativos, cartões de índices,
atalhos de "Consulta rápida" e os cartões novos da home. Só em elementos clicáveis.

**B. Gráfico que se desenha e número que conta.** A linha corre da esquerda para a direita em ~1 s e o
número principal conta até o valor, **uma vez**, quando entra na tela. Entra em: gráficos das fichas de
ativo e de índice (`grafico-de-preco`, `grafico-de-area`, `grafico-de-barras`), os gráficos do dashboard
(só ligar a animação, sem mudar layout) e os destaques numéricos da home. O valor final é sempre o dado
real; leitores de tela recebem só o valor final.

**C. Rolagem que revela.** Seções e grupos de cartões da home entram com leve subida (~16 px) e
aparecimento, em cascata (~90 ms entre cartões), quando chegam à tela. Só na home. Nunca em texto longo.

**D. Grade bento em "Ativos e índices".** Mosaico de quadros de tamanhos diferentes que **junta os
números do mês e as fichas** (pedido do dono): Ibovespa em destaque grande com minigráfico, Selic, IPCA,
juro real, IFIX, e quadros de entrada para Ações, FIIs e ETFs com a quantidade de fichas. Ao passar o
mouse, cada quadro revela o que o número quer dizer; **no celular a explicação fica sempre visível**.

**E. Topo com gráfico vivo ao fundo.** Linhas de gráfico lentas e discretas (opacidade ~0,2–0,3, ciclos
de 14–19 s) atrás do título da home, com **botão de pausa visível** (obrigatório pela WCAG 2.2.2 para
movimento contínuo). Leve o bastante para não pesar no celular.

**F. Explicação que se abre ("Como ler um ativo").** Cada indicador mostra o número e uma frase curta
sempre visíveis; ao abrir, aparecem a conta com os números, uma régua de "mais barato a mais caro" (ou
equivalente) e a armadilha. Entra na seção "Como ler um ativo" da home, que fica mais profunda que hoje.

### 5.1 Constância: onde cada padrão aparece no site inteiro

Para a constância não depender de memória, os padrões viram **peças reutilizáveis** (tokens de duração e
curva em `globals.css`, utilitários de CSS e poucos componentes/ganchos de cliente: cartão interativo,
"revelar ao entrar na tela", número que conta, explicação que se abre). Toda página usa as mesmas peças;
nenhuma reimplementa um efeito por conta própria.

| Padrão | Home | Ativos e Índices (listas e fichas) | Aprender (lista, artigo, glossário, indicadores, como calculamos) | Login e cadastro | Área logada (dashboard, carteira, simulação, relatórios, indicadores, notícias) |
|---|---|---|---|---|---|
| A. Microinteração | todos os cartões e links de entrada | cartões das listas, abas/filtros, links de "Saiba mais" | cartões de artigo, atalhos, itens do glossário | botões e links | cartões e linhas clicáveis, abas, botões |
| B. Gráfico que se desenha / número que conta | destaques e minigráficos | todos os gráficos; número que conta só no destaque do topo da ficha | gráficos dos exemplos, se houver | — | todos os gráficos do Recharts; patrimônio total conta |
| C. Rolagem que revela | todas as seções | blocos das fichas abaixo da primeira dobra (suave) | grupos de cartões da lista | — | — (tela de trabalho, sem entrada animada) |
| D. Grade bento | "Ativos e índices" | — | — | — | — |
| E. Gráfico vivo ao fundo | topo | — | — | — | — |
| F. Explicação que se abre | "Como ler um ativo" | indicadores das fichas (a frase e o número seguem à vista; a conta e a armadilha se abrem) | "Indicadores explicados" | — | tela de Indicadores da carteira |

A primeira dobra de qualquer página nunca espera animação para aparecer. Telas de trabalho (área logada)
usam movimento só como resposta a ações, não como entrada.

**Movimento reduzido: sai (decisão do dono).** O site deixa de tratar a preferência "reduzir movimento" do
sistema: todos veem as mesmas animações. Os blocos `@media (prefers-reduced-motion …)` que existem hoje em
`globals.css` são removidos, e nenhum código novo os adiciona. O Claude recomendou manter (só afeta quem
ligou a opção; o WCAG o classifica como AAA, não como mínimo); o dono decidiu tirar. O que **continua
obrigatório** é o botão de pausa do movimento contínuo do topo (WCAG 2.2.2, nível A).

## 6. A página inicial nova (ordem das seções)

1. **Topo (padrão E).** Título focado em aprender (rascunho do Claude: "Entenda o que você compra antes
   de investir."), um parágrafo curto que cita artigos, fichas e índices e menciona a carteira como
   complemento. Ação principal: **começar pelos artigos** (`/aprender`); secundárias: "Ver a
   demonstração" (botão que já existe) e "Criar minha conta". A **folha do aporte sai do topo**.
2. **Comece por aqui (A, C).** Substitui as 5 trilhas "em breve" (a constante `TRILHAS` deixa de ser
   usada). Mostra o artigo em destaque e alguns artigos reais da aba Aprender, lidos da mesma fonte que a
   aba usa (`lib/aprender/artigos.ts`), com link para todos os artigos e para o glossário.
3. **Ativos e índices (D, B, C).** O bento da seção 5. Os números do mês vêm da mesma fonte ao vivo de
   hoje (`numerosDoMes`/`lerDadosDosIndices`, com streaming e a referência fixa e datada enquanto
   carrega ou se a API falhar). A seção "Os números do mês" separada deixa de existir.
4. **Como ler um ativo (F).** Um ativo de exemplo (TAEE11) com os principais indicadores — P/L, P/VP,
   dividend yield, ROE e pelo menos mais um de margem ou endividamento — cada um como explicação que se
   abre. Os textos vêm de `lib/indicadores-explicados.ts` (as mesmas dicas, armadilhas e frases de leitura
   das fichas), para home e ficha nunca divergirem. Links para a ficha do ativo e para "Indicadores
   explicados".
5. **Organize a sua carteira.** A segunda ideia do site: aporte do mês, preço médio pela regra da Receita,
   proventos e relatórios com IA, com a carteira de demonstração como entrada. Junta o que hoje são "O que
   você faz no PortfolioLab" e a chamada final.

O **desafio do aporte** (`#desafio`, hoje uma seção inteira no meio da home) depende de decisão do dono
(seção 10). O menu "Aprender" e o rodapé apontam para `/#desafio` hoje: o que for decidido precisa manter
esses links funcionando ou atualizá-los.

## 7. Restrições

- **Next 16 com breaking changes**: consultar `frontend/node_modules/next/dist/docs/` antes de código de
  framework (`frontend/AGENTS.md`). A home é Server Component com `revalidate = 0` e streaming sob
  `<Suspense>`; animações vivem em componentes de cliente pequenos, sem transformar a página inteira em
  cliente.
- Formatação de número, moeda e data **só** por `src/lib/format.ts`; acesso à API só por `src/lib/api.ts`
  (navegador) ou `lib/*-api.ts` (servidor).
- Regras de conteúdo de `docs/aprender-conteudo.md`: nada de recomendação; todo número de mercado com
  fonte e data; todo exemplo numérico conferido por teste.
- Acessibilidade: o efeito de hover também no foco por teclado (`:focus-visible`); alvos de toque ≥ 44 px;
  contraste AA com os tokens existentes; botão de pausa no movimento contínuo; explicações que se abrem
  acessíveis (`aria-expanded`, `aria-controls`).
- Desempenho: animar só `transform` e `opacity` (e o desenho de traço SVG); nada de "pulo" de layout;
  movimento contínuo do topo leve no celular.
- Movimento coerente: durações e curvas como **tokens** em `globals.css` (rápido ~160 ms, médio ~260 ms,
  lento ~0,9–1,1 s; uma curva só), para o site ter uma linguagem de movimento única.
- Qualidade: `rodar-testes-seguro` ao fim (typecheck, lint, testes, build, E2E principal e de ativos); os
  E2E que dependem da home atual (trilhas, desafio, seção de números) precisam ser atualizados.
- Skills a carregar antes de escrever JSX: `frontend-design` e `web-design-guidelines` (regra do
  CLAUDE.md); `accessibility` para a revisão.

## 8. Decisões do Claude (o dono pode contestar)

- **Sem biblioteca nova de animação** (nada de Framer Motion/GSAP): CSS (transições, keyframes),
  `IntersectionObserver` e a animação nativa do Recharts bastam e não pesam o carregamento.
- Os números do exemplo "Como ler um ativo" ficam **fixos e datados** (como o exemplo de hoje), com um
  teste que confere as contas; trocar por dados ao vivo da ficha fica para depois.
- Contagem de número só nos destaques grandes (home e cabeçalho de índice), não em tabelas.
- Os cartões da área logada recebem só o padrão A onde já são clicáveis; nada de rolagem que revela lá.
- **A régua do padrão F não diz "barato" nem "caro"** e não usa média do setor: o repositório não tem médias
  de setor com fonte e data, e o projeto evita julgar se um ativo está barato (regra de não recomendação,
  na linha da Resolução CVM 20). A vitrine usou essas palavras só como esboço. A régua só aparece onde
  existe uma referência neutra e verificável (ex.: P/VP em relação a 1,0 = "abaixo / acima do patrimônio
  contábil"); nos outros indicadores fica a conta e a armadilha, sem régua.
- **Números do exemplo TAEE11:** todos de **uma única data**, tirados da mesma fonte que a ficha do ativo
  usa (a API `/ativos/acoes/TAEE11`, Yahoo + cálculos do job), no dia da implementação, com fonte e data
  na tela. Inclui o que a conta aberta precisa (lucro por ação, valor patrimonial por ação, proventos por
  unidade) e o indicador extra (margem líquida ou dívida/EBITDA). Um teste confere cada conta. O
  `ATIVO_DE_EXEMPLO` de 2/10 é atualizado inteiro para a nova data; nada de misturar datas.
- **Ordem de entrega em três fases**, cada uma publicável sozinha e revisada antes da próxima: (1) as peças
  reutilizáveis e a página inicial; (2) o site público (Ativos, Índices, Aprender, login/cadastro);
  (3) a área logada. Assim a constância vem do mesmo kit, e não de copiar efeitos página a página.
- **"Seus critérios" (`PainelDeCriterios`) continua**, ao lado do exemplo em "Como ler um ativo": é a única
  prévia da ideia de decidir com os próprios critérios, que combina com o foco em aprender. O link
  "Ver os indicadores da minha carteira" segue com ele.
- **Quadro do Ibovespa no bento:** ao vivo, mostra o valor e a variação no mês (o que `numerosDoMes` já
  calcula) e um minigráfico dos últimos 12 meses feito com a série ao vivo da mesma resposta da API. Na
  referência fixa, mostra só os números fixos e datados, **sem minigráfico** (nunca misturar fixo com ao
  vivo).

## 9. O que fica para quem constrói

Os textos finais (título do topo, chamadas, frases dos quadros), a quantidade exata de artigos em
"Comece por aqui", a distribuição dos quadros do bento por largura de tela, a forma das linhas do topo,
e a organização dos componentes novos, respeitando as restrições acima.

## 10. Decisões do dono (20/10/2026)

1. **Desafio do aporte:** o dono não escolheu; fica a recomendação do Claude, que ele pode trocar ao ler
   este documento: **continua na home, mais compacto, dentro de "Organize a sua carteira"**, como a
   demonstração viva dessa seção. O id `#desafio` continua existindo, então o menu "Aprender" e o rodapé
   seguem funcionando.
2. **"Reduzir movimento": sai** (seção 5).
3. **Skill do Emil Kowalski instalada** no projeto (8 skills de `emilkowalski/skill`, só markdown, conferidas):
   `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`,
   `animation-performance`, `animation-vocabulary`, `emil-design-eng`, `mobile-native`. Na implementação:
   `animate` para construir cada movimento, `animation-performance` para conferir que só anima propriedades
   baratas, `review-animations` como revisão de cada fase, e `mobile-native` para a sensação no celular.
   Elas pedem tokens únicos de curva e duração, o que já está na seção 7.
