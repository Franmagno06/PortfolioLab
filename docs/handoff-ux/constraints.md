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

