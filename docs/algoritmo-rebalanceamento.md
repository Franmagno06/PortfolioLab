# Algoritmo de Rebalanceamento por Aporte

> Implementação: [`calcularAporte`](../backend/src/modules/rebalance/rebalance.service.ts) · Testes: `rebalance.service.test.ts`

## O problema

Com o tempo, a carteira sai das metas: ativos que valorizaram passam a pesar
mais do que deveriam, e os que caíram pesam menos. Existem duas formas de
corrigir:

1. **Vender o excesso e comprar o que falta** — gera imposto sobre o lucro e
   custos de transação;
2. **Direcionar os aportes novos para o que está abaixo da meta** — sem
   vender nada. É o que este algoritmo faz.

## A estratégia gulosa

```
entrada: ativos com meta (preço, posição atual, meta %), valor do aporte
saída:   lista de compras em unidades inteiras

1. patrimônio final = patrimônio atual + aporte
2. para cada ativo:  déficit (R$) = meta% × patrimônio final − posição atual
3. ordenar por déficit decrescente                     ← O(n log n)
   (empates: menor preço primeiro, depois ticker)
4. para cada ativo na ordem:                           ← O(n)
     se déficit ≤ 0: pular (acima da meta não recebe)
     orçamento = min(déficit, dinheiro restante)
     quantidade = ⌊orçamento ÷ preço⌋      ← unidades inteiras
     comprar, subtrair do restante
```

## Por que é "guloso"?

Em cada passo o algoritmo faz a escolha **localmente ótima** — atacar o maior
déficit primeiro — sem nunca voltar atrás. Não há garantia matemática de que o
aproveitamento do dinheiro seja o máximo possível (isso seria uma variação do
*problema da mochila*, que é NP-difícil), mas para o objetivo real —
**aproximar a carteira das metas** — a heurística é excelente e roda em
milissegundos.

## Análise de complexidade

| Etapa | Custo |
|-------|-------|
| Calcular déficits | O(n) |
| Ordenar por déficit | **O(n log n)** ← domina |
| Alocar comprando | O(n) |
| **Total** | **O(n log n)** |

Para uma carteira típica (n < 50 ativos), o tempo é irrelevante; a análise
importa como exercício: se um dia o algoritmo rodasse para milhares de
carteiras em lote, a ordenação continuaria sendo o gargalo teórico.

## Exemplo com a carteira demo

Aporte de **R$ 200** com carteira vazia e metas MXRF11 60% / BOVA11 40%:

| Ativo | Meta | Déficit | Preço | Compra | Custo |
|-------|------|---------|-------|--------|-------|
| MXRF11 | 60% | R$ 120,00 | R$ 10,85 | ⌊120÷10,85⌋ = **11 cotas** | R$ 119,35 |
| BOVA11 | 40% | R$ 80,00 | R$ 110,00 | ⌊80÷110⌋ = **0** | — |

Sobram R$ 80,65 para o próximo aporte. Repare no comportamento honesto do
algoritmo: ele **não** compra BOVA11 com o dinheiro que sobrou, porque uma cota
(R$ 110) custaria mais que o déficit do ativo (R$ 80) — compraria excesso.

## Decisões e limitações documentadas

- **Unidades inteiras** (`floor`): B3 negocia ações/FIIs/ETFs em unidades.
  Simplificação assumida: Tesouro Direto aceita frações, mas tratamos tudo
  como inteiro nesta fase.
- **Desempate determinístico**: mesmo déficit → menor preço primeiro (mais
  granularidade de compra), depois ordem alfabética. Resultados reproduzíveis
  são essenciais para testes.
- **Aritmética com `Decimal`**: divisões como `108,50 ÷ 10,85` em `float`
  binário podem dar `9.9999…` e o `floor` viraria 9 em vez de 10 — um erro de
  uma cota inteira. Com `Decimal` isso não acontece.
- **Ativos sem meta** contam no patrimônio total, mas não recebem aporte.
