# Aba Aprender: como escrever um artigo

Aprender é feita de **artigos**, e não de curso: sem aulas, trilhas, progresso nem "concluir". Os textos
ficam em `frontend/src/content/aprender/`, fora dos componentes; a página só renderiza.

```
src/content/aprender/
├── artigos/<slug>.mdx     um arquivo por artigo
├── glossario.ts           os verbetes de /aprender/glossario
└── indicadores.ts         os cartões de /aprender/indicadores
```

Rotas (todas públicas, liberadas em `src/proxy.ts` pelo prefixo `/aprender`):
`/aprender`, `/aprender/[slug]`, `/aprender/glossario`, `/aprender/indicadores`, `/aprender/como-calculamos`.

## Regras de conteúdo

1. **Nada é recomendação de investimento.** O texto diz o que o número mede e como ler; nunca que um ativo é
   bom, barato ou uma oportunidade (Resolução CVM 20). Um teste recusa "compre", "oportunidade de compra" etc.
2. **Número que muda** (taxa, índice, limite, alíquota, lei) entra **com fonte e data**, e a fonte é oficial
   (Banco Central, IBGE, Receita Federal, FGC, CVM, B3). Blog só como segunda fonte. Taxa de exemplo é rotulada
   como exemplo.
3. **Todo exemplo numérico é conferido em código.** A conta vai em `src/lib/aprender/exemplos.ts` (aritmética em
   centavos inteiros) e o número que o texto escreve é conferido em `exemplos.test.ts`.
4. Tom: leve, em português, frases curtas, sem jargão solto, contas em reais.
5. O glossário não leva número que muda (um teste confere): o número fica no artigo, onde tem fonte e data.

## O cabeçalho (frontmatter) de cada artigo

| Campo | Regra |
|---|---|
| `titulo`, `subtitulo` | texto; o subtítulo também é o resumo do card |
| `tituloCurto` | opcional: o nome na trilha de navegação, quando o título é longo |
| `categoria` | `antes-de-investir`, `renda-fixa`, `acoes-e-fiis`, `montar-a-carteira` ou `rebalancear` |
| `slug` | igual ao nome do arquivo; tem de estar em `SLUGS_PLANEJADOS` (`lib/aprender/tipos.ts`) |
| `tempoLeitura` | minutos inteiros; **tem de bater** com `estimarTempoDeLeitura` (180 palavras/min), um teste confere |
| `atualizadoEm` | `AAAA-MM-DD`: a data em que os números e as fontes foram conferidos |
| `resumo` | exatamente **3** frases: a caixa "Em resumo" |
| `fontes` | lista de `{ rotulo, url? }`; `url` começa com `https://`; ao menos uma |
| `relacionados` | slugs de outros artigos publicados: "Continue lendo" (até 3); vazio esconde a seção |
| `destaque` | opcional, no máximo um artigo; sem nenhum, o mais recente abre o índice |
| `ilustracao` | só o destaque: `linhas` (2 textos) e `nota`, a folha de caderno do índice |

Um cabeçalho inválido derruba o build com o nome do arquivo (`lib/aprender/frontmatter.ts`).

## O que o texto pode usar

Markdown comum (parágrafos, listas, **negrito**, links, tabelas com `|`, que o `remark-gfm` converte) e estes blocos:

```mdx
## Título de seção
```
Texto puro, sem formatação: vira a âncora (`#p-l-quantos-anos...`) e a entrada de "Neste artigo".

```mdx
> Frase de destaque.
```
A citação, em roxo, com barra na lateral.

```mdx
<Conta rotulo="Cálculo do P/L">
  <Parcela rotulo="Preço da ação">R$ 42,85</Parcela>
  <Sinal>÷</Sinal>
  <Parcela rotulo="Lucro por ação">≈ R$ 4,75</Parcela>
  <Sinal>=</Sinal>
  <Parcela rotulo="P/L" resultado>9,02</Parcela>
</Conta>
```
A conta em caixas. No celular as caixas empilham.

```mdx
<Armadilha>O erro de leitura mais comum do indicador.</Armadilha>
```

```mdx
<Trecho nota="Anotação na margem.">

Qualquer bloco comentado: um parágrafo, uma <Conta>, uma citação.

</Trecho>
```
No desktop largo a nota fica na margem direita, no alto do trecho; abaixo disso vira nota em linha, logo depois.
Deixe **linha em branco** depois da abertura e antes do fechamento, senão o MDX não interpreta o markdown de dentro.
Duas notas seguidas não podem ser mais altas que os trechos que comentam (o E2E confere que não se sobrepõem).

```mdx
<VejaNoSite>

- [Confira o P/L na ficha da VALE3 →](/ativos/acoes/VALE3)

</VejaNoSite>
```

Evite `{`, `<` e `>` soltos no texto: são sintaxe do MDX. "R$ 42,85" ganha espaço que não quebra a linha sozinho.

## Publicar um artigo novo

1. Crie `src/content/aprender/artigos/<slug>.mdx` com o cabeçalho completo.
2. Rode `npx vitest run src/lib/aprender`: confere cabeçalho, tempo de leitura, índice e a lista proibida.
3. Se o artigo tem número, ponha a conta em `exemplos.ts` e o teste em `exemplos.test.ts`.
4. Liste-o em `relacionados` dos artigos que combinam, para o "Continue lendo".
5. O glossário passa a mostrar "Ler o artigo" sozinho para os verbetes que apontam para o slug.
6. Rode a bateria (skill `rodar-testes-seguro`): o E2E `e2e/aprender.spec.ts` lê os artigos de `src/content`,
   então o filtro e o "Continue lendo" passam a ser exercitados sem editar o teste.

## Dados públicos usados nos exemplos

`DADOS_PUBLICOS` em `exemplos.ts` guarda Selic, CDI, IPCA (12 meses e mensal) e os limites do FGC, com fonte e data.
A série 432 (Selic meta) lista dias **futuros**, até a próxima reunião do Copom: a data do último ponto não é a data
da consulta, então registre a data em que você conferiu. A fonte é a API aberta do Banco Central:
`https://api.bcb.gov.br/dados/serie/bcdata.sgs.<série>/dados/ultimos/N?formato=json` (Selic meta: 432; CDI: 4389;
IPCA em 12 meses: 13522; IPCA mensal: 433). FGC: https://www.fgc.org.br/sobre-garantia-fgc. Ao atualizar, troque o valor **e** a data. A página inicial (`lib/site-dados.ts`) tem seu
próprio fechamento do mês; o IPCA dela também é o último divulgado, com o mês de referência à vista.

Os testes conferem cada número escrito nos artigos: `NUMEROS_DOS_ARTIGOS` em `exemplos.test.ts` liga cada texto
à conta que o produz. Artigo novo com número entra nessa lista.
