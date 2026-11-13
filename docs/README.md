# Documentação do PortfolioLab

As regras do dia a dia (os dois bancos, as camadas, dinheiro em `Decimal`, o que nunca rodar contra a produção)
estão no [`CLAUDE.md`](../CLAUDE.md) da raiz. O [`README.md`](../README.md) da raiz apresenta o projeto e ensina a
subir o ambiente. Esta pasta guarda o resto.

## Referência do código

| Documento | Para quê |
|---|---|
| [arquitetura.md](arquitetura.md) | como as peças se encaixam: módulos, ordem do `app.ts`, integrações, filas, caches, tabelas e decisões |
| [api.md](api.md) | todas as rotas do backend: método, login, demo, corpo, resposta, erros e limitadores |
| [frontend.md](frontend.md) | App Router, `proxy.ts`, os clientes da API, `format.ts`, kit de movimento, aba Aprender e os testes |
| [algoritmo-rebalanceamento.md](algoritmo-rebalanceamento.md) | o algoritmo do aporte: passos, complexidade e limitações |

## Produção

| Documento | Para quê |
|---|---|
| [deploy.md](deploy.md) | Render gratuito + Vercel Hobby + Supabase: estado, variáveis, passo a passo, conferência e pendências |

O roteiro de cada publicação está na skill `deploy-producao` (`.claude/skills/`).

## Conteúdo e desenho

| Documento | Para quê |
|---|---|
| [aprender-conteudo.md](aprender-conteudo.md) | como escrever um artigo da aba Aprender: frontmatter, blocos do MDX, regras de conteúdo |
| [conteudo-educacional-base.md](conteudo-educacional-base.md) | a pesquisa de outubro/2026 que originou os artigos, com o que ainda está por escrever |
| [ux-movimento.md](ux-movimento.md) | o desenho da página inicial e do kit de movimento (implementado em 28/10/2026) |

## Histórico

| Documento | Para quê |
|---|---|
| [roadmap.md](roadmap.md) | os 9 sprints, do schema ao deploy, e os próximos passos |
| [auditoria.html](auditoria.html) | a auditoria de 22/08/2026, com os 24 achados já corrigidos. Os comentários "Achado N" do código apontam para ela |
