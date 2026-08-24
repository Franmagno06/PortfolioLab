---
name: auditar-calculo-financeiro
description: Confere as invariantes de dinheiro em um arquivo ou diff — Decimal em vez de float, taxa tratada nos dois sentidos, preço vindo de uma fonte só, divisão protegida, arredondamento só na saída. Use ao mexer em portfolio, rebalance, transactions, dividends, goals ou quotes, antes de fechar a mudança.
---

# Auditar um cálculo financeiro

Checklist aplicada a um arquivo, a um diff (`git diff`) ou a uma função
específica. Cada item é uma pergunta com resposta verificável no código — não
aceite "parece certo".

## 1. `Decimal` ou `number`?

Percorra o cálculo do início ao fim e marque onde cada valor vira `number`.

- Legítimo: conversão **na saída**, via `em2Casas()` ou equivalente, montando a
  resposta JSON.
- Achado: `.toNumber()` seguido de `+`, `-`, `*`, `/`.
- Achado: `reduce((soma, a) => soma + a.valor, 0)` sobre dinheiro — é soma em
  float. Aparece com facilidade ao consolidar patrimônio.
- Achado: `Number(x.toFixed(2))` no meio da cadeia (ver item 5).

Pergunte: *se este valor tiver dízima (1/3 de R$ 100), quantos centavos se
perdem até a resposta?*

## 2. A taxa está nos dois sentidos?

`Transaction.fee` existe em COMPRA **e** em VENDA.

- COMPRA: a taxa entra no custo e sobe o preço médio.
- VENDA: pela regra da Receita, a taxa reduz o ganho de capital.

Se o código só toca em `fee` dentro do ramo `kind === "COMPRA"`, a taxa de venda
está sendo descartada. Isso é um achado mesmo que nenhum teste falhe — nenhum
teste cobre esse caso hoje.

## 3. O preço vem de uma fonte só?

Existem dois preços para o mesmo ativo:

- **vivo** — `quotesService.atualizarSeNecessario()` / `buscarCotacao()`
- **persistido** — `asset.currentPrice` no banco

Misturar os dois no mesmo cálculo produz números incoerentes.

Verificação obrigatória em `Promise.all`: os ramos rodam **concorrentes**. Se um
ramo lê `asset.currentPrice` enquanto o outro ainda está gravando o preço novo
nessa mesma coluna, o resultado depende de quem terminar primeiro. Trace a ordem
real de execução, não a ordem visual das linhas.

Pergunte: *este número e aquele número vêm do mesmo instante e da mesma fonte?*

## 4. Toda divisão tem guarda?

`Prisma.Decimal.div(0)` lança — vira 500. Liste cada `/` e `.div()` e confirme a
guarda do denominador:

| Denominador | Quando é zero |
|-------------|---------------|
| preço unitário | ativo com `currentPrice` 0; RENDA_FIXA nunca atualizada |
| patrimônio total | carteira vazia, ou primeira simulação do usuário |
| valor aplicado | posição com preço médio zerado após venda total |
| soma das metas | nenhuma meta cadastrada |
| quantidade | posição zerada ou negativa |

Uma guarda que cobre só um dos caminhos não conta como guarda.

## 5. Arredondamento só na saída?

`toDecimalPlaces(2)` e `toFixed(2)` no meio da cadeia propagam o erro para todos
os passos seguintes. Confirme que só existem na montagem da resposta.

Caso comum: arredondar o patrimônio total e depois dividir por ele para achar
percentual — os percentuais não fecham 100%.

## 6. Quantidade pode ficar negativa?

Quantidade negativa é dado corrompido, não caso de borda. Pergunte quais
operações podem levar a posição abaixo de zero — inclusive **apagar** uma
transação de compra anterior a uma venda já registrada.

Filtrar com `quantidade.lte(0)` na leitura **esconde** o problema: some da tela e
continua no banco, travando vendas futuras. Se o código só esconde, é achado.

## 7. A ordem das transações importa?

Preço médio depende da sequência cronológica. Confirme a ordenação por
`executedAt` **antes** de iterar. Uma consulta sem `orderBy` não garante ordem —
o Postgres pode devolver em qualquer ordem física.

## 8. Percentual: o denominador é o certo?

Distinga os três, que não são intercambiáveis:

- `% da carteira hoje` → valor ÷ patrimônio **atual**
- `% depois do aporte` → valor depois ÷ patrimônio **após as compras**
- `meta %` → alvo fixo, não derivado

Trocar um pelo outro faz a barra "antes vs. depois" mentir sem que nada quebre.

## Como fechar

Para cada achado: `arquivo:linha`, qual item acima falhou, e um cenário numérico
concreto que produz o resultado errado. Sem cenário reproduzível, marque como
*suspeita* em vez de afirmar.

Se quiser uma segunda leitura independente, rode o agente `auditor-financeiro`
sobre os mesmos arquivos e compare os achados.
