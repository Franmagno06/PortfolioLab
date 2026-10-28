# Retomada do projeto de UX (Tarefa 9 em diante)

Este arquivo é para a sessão (Claude) que vai continuar o trabalho SEM ter visto a conversa anterior. Leia-o inteiro, depois o design e o plano.

## Onde estamos

- Repositório: PortfolioLab (monorepo `backend/` Express + Prisma, `frontend/` Next 16). Leia o `CLAUDE.md` da raiz e o `frontend/AGENTS.md` (o Next 16 tem mudanças que você não conhece: consulte `frontend/node_modules/next/dist/docs/` antes de código de framework).
- Branch de trabalho: **`feat/ux-movimento`** (parte da `main` já publicada). Não faça merge na `main`, não faça push na `main` e não faça deploy: isso é decisão do dono do projeto.
- Objetivo: página inicial nova, centrada em aprender, e uma camada de movimento reutilizável aplicada com constância no site inteiro.
- Documentos (leia nesta ordem):
  1. Design aprovado: `docs/superpowers/specs/2026-10-20-ux-movimento-e-home-design.md`
  2. Plano de 16 tarefas: `docs/superpowers/plans/2026-10-20-ux-movimento-e-home.md` (os títulos são `### Task N (...)`, N de 1 a 16)
  3. Registro das decisões (rulings R1–R11), menores adiados e lições: `docs/handoff-ux/progress.md` (é o ledger do processo; está colado aqui porque a pasta `.superpowers/` é ignorada pelo Git)
  4. Contexto comum a toda tarefa: `docs/handoff-ux/constraints.md`

**Feitas e revisadas: Tarefas 1 a 8** (kit de movimento, dados da home com o TAEE11 de 20/10/2026, topo, Comece por aqui, bento Ativos e índices, Como ler um ativo, Organize a sua carteira). **Faltam: 9 a 16**: checkpoint da fase 1 (9); site público (10 a 14); área logada e documentação (15 e 16).

## O que fazer, em ordem

1. Confira o estado: `git log --oneline -12`, `cd frontend && npm ci && npm test` (esperado: 37 arquivos, ~491 testes verdes), `npm run typecheck`, `npm run lint`, `npm run build`.
2. Reinstale as skills de design (estão no `skills-lock.json`, não no Git): `npx skills experimental_install` na raiz. As que importam: `frontend-design`, `web-design-guidelines`, `animate`, `animation-performance`, `review-animations`, `mobile-native` (Emil Kowalski) e `accessibility`. Se não conseguir instalar, leia as regras de design do próprio plano e aplique o bom senso, dizendo isso no relatório.
3. **Tarefa 9, checkpoint da fase 1** (veja o plano). Ponto crítico: **nenhum E2E principal das Tarefas 5 a 8 foi executado** (o ambiente local do autor não tinha Docker). Se este ambiente tiver Docker/Postgres, rode o E2E principal (`cd backend && npm run db:local`, depois `cd frontend && npx playwright test`) e CORRIJA seletores/textos que quebrarem. Se não tiver, diga claramente que os E2E continuam não executados e siga com `npx playwright test e2e/site.spec.ts --list` e `npm run test:e2e:ativos` (este último não precisa de banco). Os menores adiados para o checkpoint estão no `progress.md` (procure "deferred -> T9"): contraste de `text-loss` sobre o fundo escuro do bento, títulos dos três cartões de "Organize a sua carteira" que devem ser `h3`, comentário duplicado em `page.tsx`, etc.
4. Tarefas 10 a 16 na ordem do plano, cada uma em um commit (ou mais) com testes escritos antes.

## Como trabalhar (o processo que funcionou)

Para cada tarefa: implementar com testes primeiro (veja o vermelho, depois o verde), commitar, **revisar o diff de forma independente** (uma segunda passada, de preferência por outro agente/contexto, conferindo o requisito E a qualidade), corrigir os achados Importantes e só então passar à próxima. Se o plugin `superpowers` estiver disponível, use `superpowers:subagent-driven-development` (implementador por tarefa + revisor por tarefa + revisão final) e `superpowers:requesting-code-review`; se não, faça o mesmo laço à mão. Modelos: tarefas com número de mercado, estado complexo (dashboard, Tarefa 15) ou o kit base ficam com o modelo mais forte; o resto com o intermediário.

## Decisões do dono que valem sempre

- **Sem tratamento de "reduzir movimento"**: nenhum `prefers-reduced-motion`, `motion-reduce:` ou `motion-safe:` em lugar nenhum de `frontend/src` (há um teste-guarda em `frontend/src/app/movimento-css.test.ts` que falha se aparecerem). O **botão de pausa** do movimento contínuo do topo continua obrigatório (WCAG 2.2.2).
- Movimento **só com o kit**: tokens `--duracao-*` e `--curva` em `globals.css`, `frontend/src/lib/movimento.ts`, componentes em `frontend/src/components/movimento/`. Nenhuma duração/curva escrita à mão, nenhuma animação de propriedade de layout (só `transform`, `opacity`, traço de SVG; a abertura da explicação por `grid-template-rows` é a única exceção aprovada).
- Número/minigráfico **só animam se o elemento foi visto fora da tela primeiro** (nada de "piscar o zero" na primeira dobra); `Revelar` nunca envolve o topo da página.
- Régua do P/VP sem "barato/caro". Nenhum texto com "compre", "melhores", "oportunidade", "recomend…" (só o aviso legal "Nada aqui é recomendação de investimento"). Número de mercado sempre com fonte e data (regra em `docs/aprender-conteudo.md`).
- A conta de demonstração é SOMENTE LEITURA: nenhum texto pode prometer que o visitante altera a carteira de exemplo.
- Formatação de número/moeda só por `frontend/src/lib/format.ts`; acesso à API só por `frontend/src/lib/api.ts` (navegador) ou `frontend/src/lib/*-api.ts` (servidor).

## Armadilhas já encontradas

- Ferramentas de linha de comando às vezes **comem barras invertidas em heredocs**: escreva regex de testes (`/\d+ ações/`) com a ferramenta de edição de arquivos e releia depois.
- Toda vez que mudar um texto ou a estrutura de uma seção, **procure por `grep` em `frontend/e2e` e `frontend/src` as asserções que fixavam o texto antigo**: um seletor de E2E já quebrou assim sem ninguém ver, porque o E2E não rodava.
- Implementadores às vezes pulam a leitura das skills de design: leia-as em FULL antes de escrever JSX e confira no review.
- `git add` com caminhos específicos; nunca `git add .`. Mensagens de commit em português.
- Nunca toque em `backend/.env.supabase` nem em nenhum banco que não seja o Postgres local do Docker. Não rode `db:seed`, `prisma migrate reset` nem `db push`.

## Fim

Ao terminar a Tarefa 16, rode a bateria completa (backend: `npx prisma validate`, `npx tsc --noEmit`, `npm test`; frontend: typecheck, lint, `npm test`, `npm run build`, `npx playwright test`, `npm run test:e2e:ativos`), faça uma revisão final da branch inteira e **pare**: o merge na `main` e o deploy são do dono. Registre tudo no `progress.md` (rulings, menores adiados, o que ficou sem verificar).
