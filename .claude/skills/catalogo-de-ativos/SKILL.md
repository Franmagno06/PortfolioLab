---
name: catalogo-de-ativos
description: Adiciona, troca ou remove um ticker do catálogo curado das páginas públicas de Ativos (ações, FIIs, ETFs), mantendo em sincronia as sete cópias espalhadas pelo backend, pelo front e pelo E2E. Use quando um ativo mudar de ticker, sair de negociação, ou quando o usuário pedir para incluir/trocar uma ação, FII ou ETF nas páginas /ativos, mesmo que ele não mencione o catálogo.
---

# Mexer no catálogo de ativos sem deixar uma cópia para trás

O catálogo é a **fronteira de segurança** das rotas públicas `/ativos`: só ticker dele chega a
Yahoo, CVM e feeds de notícia. Por isso a lista vive em vários lugares, e um que fique
desatualizado vira 404 numa página, logo quebrado, ou teste vermelho. A troca ELET3/JBSS3 →
AXIA3/CMIG4 (commit `b414639`) é o exemplo real; veja com `git show b414639 --stat`.

## 1. Descubra os pontos de contato (não confie nesta lista de memória)

```bash
grep -rln "<TICKER_ANTIGO_OU_UM_VIZINHO>" backend/src backend/scripts frontend/src frontend/e2e frontend/public
```

Use um ticker vizinho do mesmo tipo (ex.: `TAEE11` para ação, `MXRF11` para FII, `BOVA11` para
ETF) se o ativo é novo. Todo arquivo que aparece precisa de uma decisão consciente.

## 2. Checklist por tipo

Todos os tipos:
- `backend/src/modules/ativos/ativos.catalogo.ts` — entrada com dados levantados à mão
  (setor/tipo/segmento). A ordem é fixa e **não é ranking** (Resolução CVM 20): não reordene por
  "melhor", só substitua no lugar.
- `backend/src/modules/ativos/ativos.descricoes.ts` — o "O que é". Um teste exige uma por
  ticker e **proíbe palavras de recomendação** ("compre", "vale a pena"...).
- `frontend/src/lib/ativos-catalogo.ts` — cópia de ticker e nome. O teste do front lê o arquivo do
  backend e falha se divergirem.
- `frontend/e2e/ativos/stub-api.mjs` — a API de mentira do E2E precisa conhecer o ticker.
- Testes que fixam contagem: `ativos.catalogo.test.ts` (`toHaveLength(15)`) e
  `frontend/src/lib/ativos-catalogo.test.ts`. Se o total mudou, atualize o número e o
  `CLAUDE.md` ("15 ações, 15 FIIs e 10 ETFs").

Só ação:
- `frontend/public/logos/<TICKER>.svg` e a lista `ACOES_COM_LOGO` em `frontend/src/lib/ativos-logos.ts`
  (há um teste que confere os dois). Fonte: `icons.brapi.dev/icons/<TICKER>.svg`. O CSP só aceita
  imagem de `'self'`, então não aponte para domínio externo. Remova o SVG do ticker que saiu.

Só FII:
- Tipo (Tijolo/Papel/Híbrido/FoF) conferido contra a **composição real** no Informe Mensal da CVM,
  não contra o "segmento" do cadastro (o MXRF11 consta lá como "Logística"). Sem logo: FII usa
  ícone por tipo.

Só ETF:
- Sem banco de indicadores e **sem taxa de administração nem cotistas**. Não coloque número de taxa
  na mão: não há fonte aberta confiável.

Ticker → CNPJ:
- Confira se o ticker existe em `backend/src/modules/assets/tabela-cnpj.json`. Se for IPO ou
  fundo novo e faltar, rode `npx tsx scripts/gerar-tabela-cnpj.ts` (baixa da CVM) e commite o JSON.
  Ticker recém-trocado (mudança de razão social) costuma faltar até a CVM atualizar o FCA.

## 3. Verifique

- O ticker novo precisa responder nas três pontas: `GET /ativos/<tipo>/<TICKER>` (200), um ticker
  fora do catálogo (404 **sem** chamada externa) e a página do front.
- Rode `rodar-testes-seguro`. Mexeu em tela ou stub → inclua `npm run test:e2e:ativos`.
- Se o ativo mudou de nome/ticker, pense em quem tinha o antigo na carteira: `Asset` e
  transações guardam o ticker em texto. **Não reescreva histórico** de usuários por causa de uma
  troca no catálogo; isso é decisão do dono dos dados.

## Modelo sugerido

Sonnet: é mecânico e o teste de divergência pega o erro. Suba para Opus só se tocar na lógica
de `ativos.service.ts`, não só nos dados.
