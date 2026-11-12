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

As metas são as que **a própria pessoa** definiu. O algoritmo só calcula; ele não
sugere meta nem escolhe ativo.

## A estratégia: fatia proporcional ao déficit, depois o troco

```
entrada: ativos com meta (preço, posição atual, meta %), valor do aporte
saída:   lista de compras em unidades inteiras

1. patrimônio final = patrimônio atual + aporte
2. para cada ativo:  déficit (R$) = meta% × patrimônio final − posição atual
3. ordenar por déficit decrescente                     ← O(n log n)
   (empates: menor preço primeiro, depois ticker)
   descartar quem está sem preço ou já acima da meta (déficit ≤ 0)

4. PRIMEIRA PASSADA — proporcional ao déficit:
   para cada ativo restante:
     fatia     = aporte × déficit ÷ soma dos déficits
     orçamento = min(fatia, déficit do ativo, dinheiro restante)
     quantidade = ⌊orçamento ÷ preço⌋                    ← unidades inteiras
     comprar, subtrair do restante

5. SEGUNDA PASSADA — o troco:
   repetir:
     entre os ativos cujo déficit restante cabe ao menos uma cota E cujo preço
     cabe no dinheiro restante, escolher o de MAIOR déficit restante
     (mesmo desempate); se não houver, parar
     orçamento = min(déficit restante, dinheiro restante)
     comprar ⌊orçamento ÷ preço⌋ unidades
```

## Por que duas passadas?

**Por que proporcional.** A primeira versão era gulosa: ia do maior déficit para
o menor, dando a cada ativo o que coubesse. Quando o aporte é menor que a soma
dos déficits — o caso normal de quem aporta todo mês — o primeiro da fila levava
quase tudo e os outros ficavam sem nada. Na carteira de demonstração, um único
ativo ficava com 89% de um aporte de R$ 3.000. Com a fatia proporcional, todos
os ativos abaixo da meta andam na direção dela.

**Por que o troco.** Comprar unidades inteiras deixa sobras: uma fatia de R$ 150
numa cota de R$ 100 deixa R$ 50 parados. Somadas, essas sobras compram mais
cotas, e a segunda passada as gasta no ativo que continua mais longe da meta.

**Garantias.** Nenhum ativo recebe mais que o próprio déficit (nunca passa da
meta por causa do aporte), nada é vendido, e o mesmo conjunto de entradas dá
sempre a mesma saída (o desempate é determinístico).

## Análise de complexidade

| Etapa | Custo |
|-------|-------|
| Calcular déficits | O(n) |
| Ordenar por déficit | O(n log n) |
| Primeira passada | O(n) |
| Segunda passada | cada volta custa O(n log n) e compra ao menos uma unidade |

O número de voltas da segunda passada é limitado pelo número de cotas que o troco
consegue pagar, o que é pequeno numa carteira de verdade (n < 50 ativos e uma sobra
de poucas cotas). Para esse tamanho o tempo é irrelevante. A análise é um exercício:
em lote, para milhares de carteiras, a ordenação repetida da segunda passada seria
o ponto a otimizar.

## Exemplo 1: aporte de R$ 1.000 numa carteira de R$ 7.000

Metas: A 50%, B 30%, C 20%. Posições: A R$ 3.000, B R$ 3.000, C R$ 1.000.
Preços: A R$ 30, C R$ 100 (B está acima da meta, o preço dele não entra na conta).

Patrimônio final: R$ 7.000 + R$ 1.000 = R$ 8.000.

| Ativo | Meta | Alvo (R$) | Posição | Déficit |
|-------|------|-----------|---------|---------|
| A | 50% | 4.000 | 3.000 | R$ 1.000 |
| B | 30% | 2.400 | 3.000 | −R$ 600 (acima da meta: não recebe) |
| C | 20% | 1.600 | 1.000 | R$ 600 |

**Primeira passada.** Soma dos déficits que contam: R$ 1.600.

- A: fatia = 1.000 × 1.000 ÷ 1.600 = R$ 625 → ⌊625 ÷ 30⌋ = **20 cotas** (R$ 600)
- C: fatia = 1.000 × 600 ÷ 1.600 = R$ 375 → ⌊375 ÷ 100⌋ = **3 cotas** (R$ 300)

Restam R$ 100.

**Segunda passada.** A ainda tem R$ 400 de déficit restante e a cota custa R$ 30,
cabendo nos R$ 100: compra ⌊100 ÷ 30⌋ = **3 cotas** (R$ 90). C tem R$ 300 de
déficit restante, mas a cota (R$ 100) já não cabe nos R$ 10 que sobraram. Nada mais cabe.

**Resultado:** A compra 23 cotas (R$ 690), C compra 3 cotas (R$ 300), B não compra.
Sobram **R$ 10** para o próximo aporte.

## Exemplo 2: a carteira demo, aporte de R$ 200 com carteira vazia

Metas MXRF11 60% / BOVA11 40%:

| Ativo | Meta | Déficit | Preço | Compra | Custo |
|-------|------|---------|-------|--------|-------|
| MXRF11 | 60% | R$ 120,00 | R$ 10,85 | ⌊120 ÷ 10,85⌋ = **11 cotas** | R$ 119,35 |
| BOVA11 | 40% | R$ 80,00 | R$ 110,00 | ⌊80 ÷ 110⌋ = **0** | — |

Aqui a fatia de cada ativo é igual ao próprio déficit (o aporte é igual à soma dos
déficits). Sobram R$ 80,65. A segunda passada não compra nada: BOVA11 tem R$ 80 de
déficit e a cota custa R$ 110, então **não** compra com o dinheiro que sobrou,
porque passaria da meta.

## Decisões e limitações documentadas

- **Unidades inteiras** (`floor`): B3 negocia ações/FIIs/ETFs em unidades.
  Simplificação assumida: Tesouro Direto aceita frações, mas tratamos tudo
  como inteiro nesta fase.
- **Desempate determinístico**: mesmo déficit → menor preço primeiro (mais
  granularidade de compra), depois ordem alfabética (comparação direta, não
  `localeCompare`, para não depender do ambiente). Resultados reproduzíveis são
  essenciais para testes.
- **Aritmética com `Decimal`**: divisões como `108,50 ÷ 10,85` em `float`
  binário podem dar `9.9999…` e o `floor` viraria 9 em vez de 10 — um erro de
  uma cota inteira. Com `Decimal` isso não acontece.
- **Ativos sem meta** contam no patrimônio total, mas não recebem aporte.
- **Sem custos**: corretagem e emolumentos não entram na conta, e o algoritmo não
  usa banda mínima de desvio: ele pode sugerir uma cota para corrigir um desvio
  muito pequeno. Ambos são melhorias futuras.
