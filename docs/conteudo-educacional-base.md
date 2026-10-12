# Conteúdo-base das páginas educativas do PortfolioLab

> Roteiro e pesquisa para cada destino "em breve" do menu: as 5 trilhas (27 aulas), o
> Glossário, "Indicadores explicados", "Como o site calcula" e as páginas de Ativos
> (ações, setores, FIIs, agenda de proventos, ETFs), mais os índices e juros da economia.
> Pesquisa de outubro/2026. **Projeto educacional — nada aqui é recomendação de investimento.**

## Convenções

- 📅 **Dado que muda** (taxa, índice, lei, composição de índice): não fixe no texto sem data e fonte.
- ⚠ **Confirmar**: veio de portal/blog ou do conhecimento geral; troque por fonte oficial antes de publicar.
- 🔧 **Gancho**: onde o próprio PortfolioLab já calcula aquilo (arquivo do projeto citado).
- Exemplos numéricos foram **conferidos em código**. Datas e valores de exemplos são hipotéticos.
- Não consegui assistir a vídeos (o Chrome conectado não abriu o YouTube). Ver [Vídeos](#vídeos).

---

## 0. Mapa: destino do menu → conteúdo

| Menu | Destino | Seção | Rota sugerida |
|---|---|---|---|
| Aprender | Trilha 1 · Antes de investir (5 aulas) | [1.1](#11-trilha-1--antes-de-investir-reserva-e-orçamento-5-aulas) | `/aprender/trilha-1` |
| Aprender | Trilha 2 · Renda fixa sem mistério (5) | [1.2](#12-trilha-2--renda-fixa-sem-mistério-5-aulas) | `/aprender/trilha-2` |
| Aprender | Trilha 3 · Como reconhecer um ativo sólido (6) | [1.3](#13-trilha-3--como-reconhecer-um-ativo-sólido-6-aulas) | `/aprender/trilha-3` |
| Aprender | Trilha 4 · Do primeiro aporte à primeira carteira (7) | [1.4](#14-trilha-4--do-primeiro-aporte-à-primeira-carteira-7-aulas) | `/aprender/trilha-4` |
| Aprender | Trilha 5 · Rebalancear sem vender (4) | [1.5](#15-trilha-5--rebalancear-sem-vender-4-aulas) | `/aprender/trilha-5` |
| Aprender | Glossário | [2](#2-glossário) | `/aprender/glossario` |
| Aprender | Indicadores explicados (já tem link `#como-ler-um-ativo`) | [3](#3-indicadores-explicados) | `/aprender/indicadores` |
| Aprender | Como o site calcula | [4](#4-como-o-site-calcula) | `/aprender/como-calculamos` |
| Ativos | Buscar ações · Ações por setor | [5.1](#51-ações-buscar-ações-e-ações-por-setor) e [5.2](#52-setores-da-b3) | `/ativos/acoes` |
| Ativos | Buscar FIIs | [5.3](#53-fundos-imobiliários-buscar-fiis) | `/ativos/fiis` |
| Ativos | Agenda de proventos | [5.4](#54-agenda-de-proventos) | `/ativos/proventos` |
| Ativos | Buscar ETFs | [5.5](#55-etfs-buscar-etfs) | `/ativos/etfs` |
| Ativos | Índices de referência (card Ibovespa / IFIX) | [6](#6-índices-e-juros-da-economia) | `/aprender/indices` |

Rota nova pública → incluir em `rotasPublicas` no `src/proxy.ts` e pôr o `href` em
`navegacao.ts` (o `navegacao.test.ts` confere cada caminho contra `src/app`).

### Formato fixo de cada aula (sugestão)
**Ideia central (2 linhas) → exemplo em reais → armadilha → "veja no site" (link) → fontes.**
Conteúdo guardado em `.md`/`.ts` por aula; a página só renderiza.

---

## 1. As cinco trilhas (27 aulas)

### 1.1 Trilha 1 — Antes de investir: reserva e orçamento (5 aulas)

**Aula 1 · Por que o dinheiro parado perde valor**
- Ideia: inflação (IPCA) corrói o poder de compra; investir é, antes de tudo, não perder para ela.
- Exemplo: R$ 1.000 que rendem 0% com inflação de 4,2% ao ano "valem" ~R$ 960 em poder de compra.
- Armadilha: confundir rendimento nominal com real. 🔧 Conecta com o juro real (seção 6.3).

**Aula 2 · Orçamento: para onde vai o seu dinheiro**
- Ideia: separar despesas essenciais, desejos e o que sobra para poupar. A divisão 50/30/20 é uma regra prática popular, não uma norma ⚠.
- Exemplo: renda de R$ 3.000 → R$ 1.500 essenciais / R$ 900 desejos / R$ 600 poupança.
- Armadilha: orçamento que ignora gastos anuais (IPVA, matrícula).

**Aula 3 · Reserva de emergência: quanto guardar**
- Ideia: dinheiro para imprevistos, não para render mais. Regra comum: **6 a 12 meses** de despesas essenciais; mais se a renda for variável, menos se for estável (XP).
- Exemplo: despesas essenciais de R$ 2.000/mês × 6 = **R$ 12.000**.
- Armadilha: usar a reserva para consumo.

**Aula 4 · Onde guardar a reserva**
- Critérios, nesta ordem: **liquidez, segurança, previsibilidade** — rentabilidade fica por último.
- Opções citadas: **Tesouro Selic** (100% da Selic, resgate em D+1, garantia do Tesouro); **CDB com liquidez diária** (~100% do CDI, FGC até R$ 250 mil); fundos DI (sem FGC).
- Armadilhas: ações/criptomoedas na reserva (podem estar em queda justo quando precisar); poupança (rende só no "aniversário"); emissor de baixo rating.

**Aula 5 · Dívidas e juros compostos**
- Ideia: juro de cartão e cheque especial supera qualquer rendimento — quitar vem antes de investir. Juros compostos funcionam a favor **e** contra.
- Exemplo para a página: mostrar `R$ 1.000` a 1% ao mês por 12 meses = R$ 1.126,83 (conferir em código antes de publicar). ⚠

> Fonte principal: XP — [Reserva de emergência: onde investir](https://conteudos.xpi.com.br/aprenda-a-investir/relatorios/reserva-de-emergencia-onde-investir/). Troque por Banco Central (Cidadania Financeira) ou CVM se abrirem.

### 1.2 Trilha 2 — Renda fixa sem mistério (5 aulas)

Descrição oficial da trilha no site: *"Selic, CDI, Tesouro Direto e CDB, com as contas feitas em reais."*

**Aula 1 · Selic e Copom**
- Selic meta = taxa básica definida pelo **Copom** (8 reuniões por ano, ~45 dias entre elas; decisão no 2º dia, ata na semana seguinte; voto do presidente e dos 8 diretores do BC).
- Efeito: Selic alta encarece crédito e freia a inflação; renda fixa passa a pagar mais. 🔧 O site usa Selic 13,75% (meta) como número do mês — ver 6.1.

**Aula 2 · CDI e "100% do CDI"**
- CDI = taxa das operações entre bancos, muito próxima da Selic. É o **benchmark** da renda fixa.
- Exemplo: CDB de 100% do CDI com CDI a 13,65% ao ano → **R$ 1.000 rendem ~R$ 136,50 brutos em 12 meses**; 90% do CDI renderia ~R$ 122,85. ⚠ (conta simples; CDI varia dia a dia)

**Aula 3 · Tesouro Direto: Selic, Prefixado, IPCA+**
| Título | Rende | Para quê | Risco principal |
|---|---|---|---|
| Tesouro Selic | Selic | Reserva/curto prazo | Quase nenhum de preço |
| Tesouro Prefixado | Taxa fixa combinada | Saber quanto terá no vencimento | **Marcação a mercado**: se os juros sobem, o preço cai antes do vencimento |
| Tesouro IPCA+ | IPCA + taxa fixa | Proteger o poder de compra | Marcação a mercado também |
- Em jun/2026 uma fonte citava IPCA+ ~7,9% e Prefixado ~14% ao ano 📅 — **não publique**, mostre via fonte viva.
- 🔧 Limitação já documentada no README: Tesouro não tem cotação automática no site; preço entra à mão.

**Aula 4 · CDB, LCI, LCA e FGC**
- **CDB**: emitido por bancos. **LCI/LCA**: lastro imobiliário/agro, **isentas de IR** para pessoa física; carência mínima de 6 meses (sem correção por índice de preços) e 36 meses (atreladas ao IPCA) (Renova).
- **FGC**: cobre **até R$ 250 mil por CPF por instituição**, com teto de **R$ 1 milhão** por CPF em 4 anos. ⚠ confirmar no site do FGC.
- Armadilha: segurança depende do emissor, não só do produto.

**Aula 5 · Imposto e prazo**
- IR regressivo sobre o rendimento: **22,5%** (até 180 dias) → **20%** (181–360) → **17,5%** (361–720) → **15%** (acima de 720). **IOF** em resgates antes de 30 dias.
- Exemplo (conta conferida): R$ 1.000 que rendem R$ 137,50 brutos em 12 meses (365 dias → faixa de **17,5%**): IR de R$ 24,06 → **ganho líquido R$ 113,44**. Se resgatar antes de 180 dias, a faixa é 22,5%.
- Fonte: Renova Invest — [renda fixa](https://renovainvest.com.br/blog/renda-fixa/). ⚠ confirmar na Receita Federal / Tesouro.

### 1.3 Trilha 3 — Como reconhecer um ativo sólido (6 aulas)

Descrição oficial: *"Lucro constante, dívida sob controle e um histórico de proventos que se sustenta."*
Todas as aulas usam o **ativo de exemplo da página inicial (TAEE11)**; os números dele estão em `site-dados.ts` (📅 fechamento de 2/10/2026).

**Aula 1 · O que é uma ação (e ON, PN, units)**
- Fração do capital de uma empresa. **ON** (final 3) vota; **PN** (final 4) tem prioridade nos proventos; **unit** (final 11) é um pacote de ações. ⚠ (conhecimento geral)
- Ticker = letras da empresa + número. Lote padrão 100; fracionário de 1 a 99, ticker com "F".

**Aula 2 · De onde vem o provento: lucro e DRE**
- Dividendo e JCP saem do lucro. Empresa que não gera caixa não sustenta provento.
- Armadilha: lucro contábil pontual (venda de ativo) ≠ lucro recorrente.

**Aula 3 · P/L e P/VP**
- P/L = quantos anos de lucro "pagam" o preço. P/VP = preço ÷ patrimônio por ação.
- Exemplo TAEE11: preço R$ 42,85 ÷ LPA ≈ R$ 4,75 → **P/L 9,02**; P/VP 1,83.
- Armadilha: P/L baixo pode ser "barato por um motivo"; P/VP serve mais para bancos, seguradoras e FIIs.

**Aula 4 · ROE, margem e endividamento**
- ROE = lucro ÷ patrimônio líquido. Regra prática: consistentemente acima de ~15% (TAEE11: 20,9%).
- Margem líquida: ler a **tendência**. Dívida líquida/EBITDA: <1,5x confortável; 1,5–3x administrável; >3x alerta (faixas variam por fonte e setor).
- Armadilha: ROE alto com dívida alta é alavancagem, não qualidade. Bancos: usar ROE/ROA, não margem. 🔧 `industriaEhBanco()`.

**Aula 5 · Dividend yield e sustentabilidade**
- DY = proventos dos últimos 12 meses por ação ÷ preço. **TAEE11: R$ 3,01 ÷ R$ 42,85 = 7,02%** (4 pagamentos).
- Armadilha: DY alto pode ser o preço caindo. Olhar se lucro e caixa cobrem o provento.
- 🔧 O site calcula o DY pelos proventos que ele mesmo importa, **não** pelo campo pronto do Yahoo (`calcularDividendYield`). Dois sites podem mostrar DYs diferentes.

**Aula 6 · FIIs: tijolo × papel, vacância e P/VP**
- Tijolo vive de aluguel (risco: **vacância**); papel vive de CRI/LCI indexados a CDI/IPCA (risco: **crédito** e juros). Ver 5.3.
- Armadilha: P/VP < 1 com DY muito alto pode ser alerta, não oportunidade.

> O desafio do aporte (R$ 1.000) fecha a trilha: critérios do site "ROE > 15%, DY > 6%, P/VP < 1,5" (`CRITERIOS_DE_EXEMPLO`) — explique que **são critérios didáticos, não recomendação**.

### 1.4 Trilha 4 — Do primeiro aporte à primeira carteira (7 aulas)

Descrição oficial: *"Quanto colocar em cada classe de ativo e por que a ordem importa."*

**Aula 1 · Classes de ativos e diversificação**
- Renda fixa, ações, FIIs, ETFs (as classes do schema: `AssetType`). Diversificar = não depender de um só risco.
- Exemplo: a carteira demo tem 8 ações, 5 FIIs e 3 ETFs.

**Aula 2 · Perfil e horizonte**
- Prazo da meta define o risco aceitável: dinheiro para daqui a 1 ano não vai em renda variável. ⚠ (regra didática)

**Aula 3 · Definindo metas de alocação**
- Metas somam **até 100%**. 🔧 Limitação: no site as metas são **por ticker**, não por classe.
- Exemplo do desafio: MXRF11 20%, HGLG11 20%, BBAS3 15%, TAEE11 15%, BOVA11 15%, IVVB11 15% (soma 100%).

**Aula 4 · Setores: cíclico × defensivo**
- Ver 5.2. Ideia da aula: duas ações do mesmo setor sofrem o mesmo risco; metas devem pensar em setor, não só em ticker.

**Aula 5 · ETFs: uma cota, vários ativos**
- Ver 5.5. Exemplo: BOVA11 replica o Ibovespa com taxa de ~0,10% a.a. (📅 confirmar).

**Aula 6 · Comprar na prática: lote, fração, taxa e preço médio**
- Taxas entram no custo. **Preço médio** (regra da Receita): compra recalcula incluindo taxa; venda **não** altera o PM.
- Exemplo (conferido): compra 10 a R$ 20 + taxa R$ 2 → PM R$ 20,20. Compra 10 a R$ 30 + taxa R$ 2 → PM = (202 + 302) ÷ 20 = **R$ 25,20**. Vende 5 → continua R$ 25,20, com 15 unidades.

**Aula 7 · Impostos e declaração**
- Quadro consolidado na seção 7. Armadilha: ETF e FII **não** têm a isenção dos R$ 20 mil/mês das ações.

### 1.5 Trilha 5 — Rebalancear sem vender (4 aulas)

Descrição oficial: *"Usar cada aporte para levar a carteira de volta às metas."*

**Aula 1 · Por que a carteira sai da meta**
- O que valoriza passa a pesar mais. Duas saídas: vender o excesso (imposto e custo) ou **aportar no que está abaixo da meta**.

**Aula 2 · Rebalancear pelo aporte**
- Sem vender nada. Funciona melhor com aportes regulares. Limite: com aporte pequeno, o ajuste é lento.

**Aula 3 · O algoritmo guloso, passo a passo**
- Mostrar os 4 passos de `docs/algoritmo-rebalanceamento.md`. Exemplo oficial (conferido):
  | Ativo | Meta | Déficit | Preço | Compra | Custo |
  |---|---|---|---|---|---|
  | MXRF11 | 60% | R$ 120,00 | R$ 10,85 | ⌊120 ÷ 10,85⌋ = **11** | R$ 119,35 |
  | BOVA11 | 40% | R$ 80,00 | R$ 110,00 | ⌊80 ÷ 110⌋ = **0** | — |
  Sobram R$ 80,65. O algoritmo **não** compra BOVA11 só para gastar: uma cota custa mais que o déficit.

**Aula 4 · Limites e boas práticas**
- Unidades inteiras; sobra vai para o próximo aporte; ativo **acima** da meta não recebe; ativo **sem meta** conta no patrimônio mas não recebe aporte. Fecha com o "Desafio do aporte".

---

## 2. Glossário

Organize por letra, com âncora por termo. Cada verbete: **definição de 1 linha + exemplo** + link para a aula.

| Termo | Definição curta |
|---|---|
| Ação | Fração do capital de uma empresa de capital aberto. |
| ON / PN / Unit | Ordinária (voto) / preferencial (prioridade em proventos) / pacote de ações. ⚠ |
| Benchmark | Referência para comparar retorno (CDI, Ibovespa, IFIX). |
| Bonificação / Desdobramento | Mudam a quantidade de ações sem mudar o valor total (afetam o PM). ⚠ |
| CDB / LCI / LCA | Títulos de crédito emitidos por bancos (LCI/LCA com lastro imobiliário/agro e isentas de IR para pessoa física). |
| CDI | Taxa das operações entre bancos; referência da renda fixa, próxima da Selic. |
| Copom | Comitê do Banco Central que define a meta da Selic. |
| Cota | Fração de um fundo (FII, ETF). |
| Curva de juros | Taxas de juros futuros por prazo (vértices); mostra a expectativa do mercado. |
| Data-com | Último dia para ter o ativo e ter direito ao provento. |
| Data-ex | Primeiro dia em que o ativo negocia sem o direito ao provento (pregão seguinte à data-com). |
| Dividend yield (DY) | Proventos dos últimos 12 meses ÷ preço atual. |
| Dividendo / JCP | Parte do lucro distribuída; JCP tem retenção de 15% de IR. ⚠ |
| DI futuro | Contrato de juros futuros na B3 (código DI1 + letra do mês + ano). |
| Diversificação | Distribuir o dinheiro para não depender de um só risco. |
| ETF | Fundo de índice negociado em bolsa. |
| FGC | Fundo Garantidor de Créditos: até R$ 250 mil por CPF por instituição. ⚠ |
| FII | Fundo de investimento imobiliário. |
| Free float | Parcela das ações disponível para negociação. |
| IFIX / Ibovespa | Índices de FIIs / de ações mais negociadas da B3. |
| IGP-M | Índice geral de preços da FGV; reajuste de contratos. ⚠ |
| Inflação / IPCA / INPC | Alta geral de preços / índice oficial (IBGE) / versão para famílias de 1 a 5 salários mínimos. |
| Juro real | Juro descontada a inflação: (1 + juro) ÷ (1 + inflação) − 1. |
| Liquidez | Facilidade de vender sem mexer no preço. |
| Lote padrão / fracionário | 100 unidades / de 1 a 99 (ticker com "F"). |
| Marcação a mercado | Atualização diária do preço de um título; pode cair antes do vencimento. |
| P/L, P/VP, ROE, ROA | Ver seção 3. |
| Preço médio (PM) | Custo médio ponderado das compras, incluindo taxas. |
| Provento | Nome genérico: dividendos, JCP e rendimentos de FII. |
| Rebalancear | Levar a carteira de volta aos pesos-alvo. |
| Renda fixa / variável | Retorno previsível pela regra / retorno incerto. |
| Reserva de emergência | Dinheiro líquido e seguro para imprevistos. |
| Retorno total | Retorno com proventos reinvestidos. |
| Selic (meta / over) | Taxa básica de juros / taxa efetiva do overnight. |
| Tracking error | Diferença entre o retorno do ETF e o do índice. |
| Vacância | Parcela do imóvel sem inquilino. |

---

## 3. Indicadores explicados

Formato: **o que mede → fórmula → como ler → armadilha → exemplo (TAEE11)**. Âncora existente: `#como-ler-um-ativo`.

| Indicador | Fórmula | Como ler | Armadilha | TAEE11 (2/10/2026, 📅) |
|---|---|---|---|---|
| **P/L** | Preço ÷ Lucro por ação | Anos de lucro para "pagar" o preço | Lucro pontual distorce; comparar dentro do setor | 9,02 |
| **P/VP** | Preço ÷ Patrimônio por ação | 1,0 = paga o patrimônio; <1 = desconto | Não é universal; melhor para bancos/FIIs | 1,83 |
| **Dividend yield** | Proventos 12m ÷ Preço | Retorno em proventos | Pode ser preço caindo | 7,02% (R$ 3,01 em 4 pagamentos) |
| **ROE** | Lucro líquido ÷ Patrimônio líquido | >15% de forma consistente é bom sinal (regra prática) | Dívida infla o ROE | 20,9% |
| **ROA** | Lucro líquido ÷ Ativo total | Mais comparável em bancos | — | — |
| **Margem líquida** | Lucro líquido ÷ Receita líquida | Ler a tendência | Não se aplica bem a bancos | — |
| **Dívida líq./EBITDA** | Dívida líquida ÷ EBITDA | Anos de caixa operacional para quitar a dívida | Faixas variam por setor | — |
| **Vacância** (FII tijolo) | Área vaga ÷ Área total | Menor é melhor | Contratos vencendo em bloco | — |
| **DY e P/VP de FII** | Mesmas fórmulas, com cota | P/VP<1 + DY alto exige cuidado | Rendimento pode ter ganho não recorrente | — |

Fonte principal: HG Brasil — [análise fundamentalista](https://hgbrasil.com/blog/analise-fundamentalista-principais-indicadores-e-sintomas-de-empresas). As fontes divergem nas faixas de dívida/EBITDA (limiares 1,5/3/4,5 em um trecho, 2/4 em outro): **diga na página que são referências, não regras**.

---

## 4. Como o site calcula

Cada bloco: **fórmula → exemplo → onde está no código → o que o site não faz**.

### 4.1 Preço médio (regra da Receita)
- Compra: `PM = (qtd × PM + qtdCompra × preço + taxa) ÷ (qtd + qtdCompra)`. Venda: reduz a quantidade e **não altera o PM**; se a posição zera, o PM volta a zero.
- Ordem: por data de execução; empate resolvido pela ordem de cadastro (`seq`), para a mesma carteira dar sempre o mesmo PM.
- Dinheiro em `Decimal`, nunca `number`. 🔧 `portfolio.service.ts:calcularPosicao`.
- A **posição é derivada das transações**, nunca armazenada.

### 4.2 Proventos
- Recebe quem tinha a posição **antes da data-ex** (regra de posse, não de saldo atual). Compra na própria data-ex **não** recebe; quem vendeu depois ainda recebeu.
- Exemplo (conferido): comprou 100 cotas em 5/mar; data-ex 12/mar; R$ 0,50 por cota → **R$ 50,00**. Se comprou em 12/mar → R$ 0.
- Importação idempotente; lançamento manual nunca é tocado. 🔧 `dividends.service.ts:calcularProventosRecebidos`.
- Limitação honesta: o Yahoo só dá proventos com data-ex **passada**; **data de pagamento não existe** na fonte.

### 4.3 Aporte (rebalanceamento)
- `déficit = meta% × (patrimônio + aporte) − posição`; ordena por maior déficit (empate: menor preço, depois ticker); compra `⌊orçamento ÷ preço⌋` unidades.
- Exemplo na seção 1.5. Complexidade O(n log n). 🔧 `docs/algoritmo-rebalanceamento.md`.
- Considera só ativos **com meta** e declara quanto da carteira ficou fora da conta.

### 4.4 Dividend yield e indicadores
- Ver seção 3. Cache de 24h dos fundamentos; falha do provedor mantém o último valor (nunca derruba a rota).

### 4.5 Juro real da página inicial
- Fisher: `(1 + Selic) ÷ (1 + IPCA) − 1`. Com Selic 13,75% e IPCA 12m 4,22% → **9,14% ao ano** (conferido). 🔧 `site-dados.ts:juroReal`.

---

## 5. Páginas de ativos

### 5.1 Ações: "Buscar ações"
- Texto de apoio: seção 1.3 aula 1 e glossário. Busca: "Todas as empresas listadas na B3" (o catálogo cresce sozinho a partir do Yahoo — README).
- **Ficha do ativo** sugerida: ticker, nome, setor, preço, P/L, P/VP, DY 12m, ROE, proventos recentes, botão "registrar compra".
- Aviso fixo: variação é de **renda variável**; liquidez varia por empresa; ações do Ibovespa costumam ser mais líquidas.
- Horário de pregão (⚠ confirmar na B3): contínuo 10h–16h55, leilão de fechamento até 17h.

### 5.2 Setores da B3
- Fonte: Daycoval — [setores da bolsa](https://blog.daycoval.com.br/setores-da-bolsa/) (a divisão varia por metodologia — ⚠ confirmar a classificação oficial da B3).
- **11 setores:** bens industriais · comunicações · imobiliário · consumo cíclico · consumo não cíclico · financeiro · materiais básicos · petróleo, gás e biocombustíveis · saúde · tecnologia da informação · utilidade pública.

| Perfil | Setores | Comportamento típico |
|---|---|---|
| **Cíclico** | Consumo cíclico (varejo, viagens, autos), bens industriais, materiais básicos | Vai bem na expansão e sofre em crise |
| **Defensivo** | Consumo não cíclico, saúde, utilidade pública (energia, água, gás) | Receita mais estável; utilities são regulados |

| Setor | Risco típico citado |
|---|---|
| Financeiro | Regulação e juros |
| Materiais básicos | Preço de commodities e demanda global |
| Petróleo e gás | Preço de energia, geopolítica |
| Imobiliário | Ciclo imobiliário e juros |
| Tecnologia / Comunicações | Inovação e regulação |

- Para Ações por setor, sugerir: **cada setor com 2 a 3 linhas + "como ler os indicadores neste setor"** (ex.: bancos → ROE/ROA e P/VP; elétricas → DY e endividamento) ⚠.
- Aviso: concentrar em um setor aumenta o risco; é o argumento da diversificação.
- Os índices setoriais da B3 existem (ver Suno — [índices setoriais](https://www.suno.com.br/?p=157524)) ⚠.

### 5.3 Fundos imobiliários: "Buscar FIIs"
- Definição, tipos, riscos e impostos: ver tabela abaixo.

| Tipo | Investe em | Risco principal |
|---|---|---|
| **Tijolo** | Imóveis (lajes, logística, shoppings, hospitais) | Vacância; ciclo econômico |
| **Papel** | CRI, LCI, LH (CDI, IPCA, IGP-M) | Crédito; juros e inflação |
| **Híbrido** | Imóveis + recebíveis | Soma dos dois |
| **Fundo de fundos (FoF)** | Cotas de outros FIIs | Camada extra de taxas |
| **Desenvolvimento** | Imóveis em construção | Prazo e execução |
| **Fiagro** | Agronegócio | Clima e regulação |

- ⚠ O menu diz "Fundos de tijolo, papel e híbridos". Sugestão: acrescentar **fundo de fundos** (classe comum na B3).
- Distribuição: por regra, **≥ 95% do resultado** (regime de caixa) — por isso a renda costuma ser mensal. ⚠ confirmar na Resolução CVM 175 / Lei 8.668.
- Riscos listados: mercado, **liquidez**, **vacância**, **crédito**, **pré-pagamento** (em CRI).
- 🔧 Ligação com "Relatórios com IA": o relatório gerencial do FII é onde se lê vacância, inadimplência e emissões.

### 5.4 Agenda de proventos
Menu: *"Quem paga, quanto e quando, com a data-com."*

**As quatro datas (ordem real):**
1. **Aprovação/anúncio** — conselho define valor e prazos (até a data-com).
2. **Data-com** — último dia para ter o ativo e garantir o provento.
3. **Data-ex** — pregão **seguinte** à data-com; negocia "sem" o direito.
4. **Pagamento** — posterior à data-ex.

Exemplo da B3/InfoMoney: com data-com na segunda e data-ex na terça, quem compra **até a segunda** recebe. Preço do ativo tende a ajustar na data-ex pelo valor do provento. Fontes: B3 [Bora Investir](https://borainvestir.b3.com.br/glossario/data-ex/), [InfoMoney](https://www.infomoney.com.br/?p=398162).

> ⚠ **Ponto de atenção do projeto:** a fonte do site (Yahoo) fornece **data-ex**, não data-com nem data de pagamento. A agenda prometida ("com a data-com") exige **outra fonte** (a própria B3, ou CVM para FIIs). Se for usar só o Yahoo, a página pode mostrar a **data-ex** e calcular a data-com como o **pregão anterior** (considerando feriados) — e **não mostrar data de pagamento** — e dizer isso na tela. Isso já aparece como limitação no README.

### 5.5 ETFs: "Buscar ETFs"
Menu: *"Fundos que copiam um índice."*
- Fundo de índice negociado em bolsa: uma cota compra uma cesta. Taxa baixa (de 0,03% a 0,60% ao ano, segundo a fonte) contra 1–3% de fundos ativos, sem taxa de performance. Fonte: [brapi](https://brapi.dev/blog/etfs-brasil-guia-completo-bova11-ivvb11) ⚠ (blog; conferir na B3/gestora).
- **Tracking error**: o ETF pode diferir um pouco do índice.
- **Imposto:** 15% sobre o ganho (20% day trade), **sem** a isenção de R$ 20 mil/mês das ações. ⚠ confirmar na Receita.

| ETF | Replica | Taxa a.a. (📅 ⚠) |
|---|---|---|
| BOVA11 | Ibovespa | 0,10% |
| IVVB11 | S&P 500 (exposição ao dólar) | 0,23% |
| SMAL11 | Small caps | 0,50% |
| DIVO11 | Dividendos (IDIV) | 0,50% |
| GOLD11 | Ouro | 0,30% |
| HASH11 | Criptomoedas | 0,30% |

- 🔧 A carteira demo já tem BOVA11 (bolsa brasileira), IVVB11 (S&P 500) e **IMAB11** (juro real, cesta de NTN-B). Boa ligação com a aula "ETFs" da Trilha 4.

---

## 6. Índices e juros da economia

### 6.1 Selic e Copom 📅
- **Selic meta**: definida pelo Copom. Oito reuniões por ano; decisão no 2º dia; ata na semana seguinte. Selic **over** = taxa efetiva, muito próxima da meta.
- **Como afeta o investidor:**
  - Selic alta → crédito mais caro, inflação cede, **renda fixa paga mais** → ações e FIIs "concorrem" com um rival mais forte.
  - Selic baixa → o contrário. É **tendência**, não regra. (Para FIIs de papel o efeito é indireto: seus recebíveis são indexados ao CDI.)
- O site mostra **13,75%** (fechamento de 2/10/2026, SGS 432). Valor de **referência**, não fixe no texto.
- ⚠ Em minhas buscas, fontes diferentes citavam Selic distinta (um portal falava 14,50% e outro 13,75%). **Sempre mostrar a data**.

### 6.2 CDI, IPCA, INPC, IGP-M, juro real
| Termo | Mede | Quem calcula | Uso |
|---|---|---|---|
| **CDI** | Taxa interbancária | B3 | Benchmark da renda fixa ("100% do CDI") |
| **IPCA** | Inflação oficial (famílias de 1 a 40 salários mínimos) | IBGE: ~430 mil preços, ~30 mil locais, 13 áreas urbanas | Meta de inflação; Tesouro IPCA+; FIIs de papel |
| **INPC** | Inflação para 1 a 5 salários mínimos | IBGE | Reajustes |
| **IGP-M** | Preços (mais ligado a atacado) | FGV | Reajuste de aluguéis e contratos ⚠ |
| **Dólar (PTAX)** | Câmbio | Banco Central | Referência para ETFs de exposição externa |

### 6.3 Juro real (Fisher)
`juro real = (1 + juro nominal) ÷ (1 + inflação) − 1`
Exemplo com os números do site: (1,1375 ÷ 1,0422) − 1 = **9,14% ao ano**. Mostra o que realmente sobra depois da inflação. Aula 1 da Trilha 1 e aula 3 da Trilha 2 usam isso.
- ⚠ **Possível defasagem no projeto:** `site-dados.ts` usa IPCA 12m = **4,22%**, mas a página do IBGE que consultei trazia **4,58%** (set/2026, divulgação de outubro). Provavelmente o site usa o dado de agosto (divulgado antes do fechamento de 2/10). Confirme no SGS e atualize o rótulo ("IPCA até agosto").

### 6.4 Juros futuros, DI futuro e curva de juros 📅
**Ideia em uma frase:** a Selic é a taxa **de hoje**; o **juro futuro** é a taxa que o mercado **negocia hoje para o futuro**.

- **DI futuro (contrato DI1)** é o contrato de juros futuros mais usado, na B3. Código: `DI1` + letra do mês + dois dígitos do ano (ex.: DI1F26 = janeiro de 2026).
- **Como ler:** a taxa do contrato (ex.: 13,2% ao ano) é a **média esperada do CDI** até o vencimento. Taxa acima da Selic atual → o mercado espera alta; abaixo → espera queda.
- **Curva de juros:** reúne os contratos por vencimento (**vértices**). Ponta curta = curto prazo; "miolo" ≈ 2 anos; ponta longa = longo prazo. Prazos longos costumam ter taxa maior, porque exigem **prêmio** pela incerteza.
- **Pontos-base:** 1 ponto-base = 0,01%. Cair de 10,00% para 9,75% = 25 pontos-base.
- **Exemplo (hipotético):** Selic meta em 13,75% e o DI para janeiro do ano que vem a 13,0% → o mercado projeta **cortes** ao longo do período. Se o DI sobe de 13,0% para 13,5% num dia de inflação alta, o mercado passou a esperar **menos cortes**.
- **Quem usa:** bancos e gestoras para **hedge**, **especulação** e **precificação** de crédito e títulos.
- **Armadilhas:** tratar um dia como tendência; olhar só um vencimento em vez da curva inteira; ignorar fator externo (juros dos EUA, fiscal).
- **Fiscal:** problemas fiscais tendem a **subir a curva** (mais risco e inflação).
- **Curva invertida** (curto > longo) costuma sugerir expectativa de queda de juros ⚠ (interpretação geral; a fonte não trata disso).
- Fontes: BB Investalk — [curva de juros](https://investalk.bb.com.br/noticias/quero-aprender/entenda-o-funcionamento-da-curva-de-juros); Investimentos.com.br — [juros futuros](https://investimentos.com.br/artigos/juros-futuros/).
- **Dica de produto:** para a página, um mini-gráfico "Selic hoje × DI por vencimento" ensina melhor que texto. Dados da curva vêm da B3 (ajustes dos DI1); nenhuma fonte gratuita foi validada nesta pesquisa ⚠.

### 6.5 Ibovespa e IFIX (card "Índices de referência")
O card mostra: **Ibovespa 192.115 pontos (+3,1% em outubro)** e **IFIX 3.772 pontos**, "até o fechamento de 2/10" (valores fixos em `site-dados.ts`).

| Índice | O que é | Critérios / construção |
|---|---|---|
| **Ibovespa** | Desempenho médio das ações de maior negociabilidade e representatividade | Retorno total. Entra quem soma 85% do índice de negociabilidade, está em **95% dos pregões** e tem ≥ **0,1%** do mercado à vista; sem penny stock nem recuperação judicial. Peso = valor de mercado do **free float**, com limites (nenhuma companhia acima de 20%). Fonte: [metodologia da B3](https://www.b3.com.br/data/files/9C/15/76/F6/3F6947102255C247AC094EA8/IBOV-Metodologia-pt-br__Novo_.pdf) |
| **IFIX** | Desempenho médio dos FIIs mais negociados | Retorno total (proventos reinvestidos); lançado em 06/09/2012 com cálculo retroativo a 31/12/2010. 📅 107 fundos na carteira de jun/2026 |

- **Por que o card traz "pontos" e uma variação em %?** Os pontos de um índice não são reais nem preço de nada: a **variação percentual** entre duas datas é o que importa. Ensine isto na página.
- **Benchmark:** compare o retorno da sua carteira com o do índice **no mesmo período**. Cuidado: Ibovespa e IFIX são de **retorno total** (incluem proventos); compare com o retorno do seu portfólio com proventos.
- Como acompanhar: ETFs (BOVA11 para o Ibovespa, XFIX11 para o IFIX).

### 6.6 Dados vivos (Banco Central)
API pública SGS, sem chave. URL: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.<codigo>/dados/ultimos/1?formato=json`.

| Série | Código SGS |
|---|---|
| Meta Selic (Copom) | 432 *(usada em `site-dados.ts`)* |
| IPCA acumulado em 12 meses | 13522 *(usada em `site-dados.ts`)* |
| IPCA variação mensal | 433 |
| CDI (taxa anual) | 4389 ⚠ |
| IGP-M variação mensal | 189 ⚠ |

Segue o padrão do projeto: provedor externo com falha defensiva (devolve `null`, mantém o último valor). O comentário em `site-dados.ts` já prevê essa troca.

---

## 7. Impostos: quadro consolidado 📅

| Ativo / evento | Regra resumida | Fonte | Confiança |
|---|---|---|---|
| **Venda de ações** | 15% sobre o ganho; isenção se as vendas somarem até R$ 20 mil no mês (só ações) | Conhecimento geral | ⚠ |
| **Venda de FII / ETF** | 20% (FII), 15% (ETF) sobre o ganho; **sem** isenção de R$ 20 mil | Empiricus, brapi | ⚠ |
| **Rendimento de FII** | Isento para pessoa física se: <10% das cotas, ≥ 50 cotistas e negociação em bolsa; DARF/GCAP só na venda | Empiricus, Renova | ⚠ |
| **Dividendos de ações** | Lei 15.270/2025 (vigor desde 01/01/2026): retenção de **10%** se a mesma empresa paga **> R$ 50 mil/mês** à mesma pessoa física; abaixo disso, sem retenção | Renova | ⚠ |
| **JCP** | Retenção de 15% na fonte | Renova | ⚠ |
| **Renda fixa (CDB, Tesouro)** | IR regressivo 22,5 / 20 / 17,5 / 15%; IOF < 30 dias | Renova | ⚠ |
| **LCI / LCA** | Isentas de IR (pessoa física) | Renova | ⚠ |

> Em toda página que cite imposto: **data de atualização + link oficial (Receita Federal)** + "consulte um contador".

---

## Vídeos

Não consegui assistir a vídeos: o Chrome conectado não abriu o YouTube (3 tentativas), então não usei transcrições. Verificado só por página de texto:

| Vídeo | Fonte | Observação |
|---|---|---|
| *O que é Fundo Imobiliário e como funciona? Ep. 1* (2019) | [Mais Retorno](https://maisretorno.com/videos/o-que-e-fundo-imobiliario-e-como-funciona-ep-1) | Felipe Medeiros; o que são FIIs, onde investem, LH/LCI/CRI. **Tem 7 anos**: serve de introdução, não para regras de imposto. |

Sugestão: escolha os vídeos assistindo você mesmo e incorpore com o link oficial; para cada trilha, 1 vídeo curto por aula com resumo próprio ao lado.

---

## Pontos de atenção que a pesquisa encontrou no projeto

1. **Agenda de proventos "com a data-com"**: a fonte atual só traz data-ex (ver 5.4).
2. **IPCA 12m do site (4,22%)** parece mais antigo que o divulgado pelo IBGE (4,58%, set/2026): ver 6.3.
3. **Menu de FIIs** não cita **fundo de fundos** nem **Fiagro** (ver 5.3).
4. **Metas por ticker**, não por classe: a Trilha 4 precisa ser honesta quanto a isso.
5. **Tesouro sem cotação automática**: a Trilha 2 ensina Tesouro, mas o site não o atualiza sozinho.
6. **Impostos** mudaram em 2026 (Lei 15.270): qualquer texto antigo na internet pode estar desatualizado.

---

## Fontes

**Primárias / oficiais**
- B3 — [Metodologia do Ibovespa (PDF)](https://www.b3.com.br/data/files/9C/15/76/F6/3F6947102255C247AC094EA8/IBOV-Metodologia-pt-br__Novo_.pdf)
- B3 Bora Investir — [Data-ex](https://borainvestir.b3.com.br/glossario/data-ex/)
- IBGE — [Inflação](https://www.ibge.gov.br/explica/inflacao.php)

**Secundárias (confirmar pontos ⚠)**
- InfoMoney — [Etapas do pagamento de dividendos](https://www.infomoney.com.br/?p=398162)
- Banco do Brasil Investalk — [Curva de juros](https://investalk.bb.com.br/noticias/quero-aprender/entenda-o-funcionamento-da-curva-de-juros)
- Investimentos.com.br — [Juros futuros](https://investimentos.com.br/artigos/juros-futuros/) e [IFIX](https://investimentos.com.br/artigos/o-que-e-o-ifix/)
- Status Invest — [Tipos de FIIs](https://statusinvest.com.br/noticias/tipos-de-fundos-imobiliarios-fiis/)
- Acionista — [FIIs: o que são](https://acionista.com.br/fundos-imobiliarios-fiis-o-que-sao-e-como-funcionam/)
- Empiricus — [Tributação dos FIIs](https://www.empiricus.com.br/explica/tributacao-dos-fundos-imobiliarios-fiis/)
- Renova Invest — [Tributação de dividendos em 2026](https://renovainvest.com.br/blog/tributacao-de-dividendos/), [Renda fixa](https://renovainvest.com.br/blog/renda-fixa/), [B3 e como investir](https://renovainvest.com.br/blog/b3-bolsa-de-valores-brasileira-como-funciona/)
- HG Brasil — [Indicadores fundamentalistas](https://hgbrasil.com/blog/analise-fundamentalista-principais-indicadores-e-sintomas-de-empresas)
- InvestNews — [Copom e Selic](https://investnews.com.br/guias/copom-taxa-selic/)
- Investidor10 — [Selic, IPCA e CDI](https://investidor10.com.br/conteudo/selic-ipca-e-cdi-entenda/)
- brapi — [ETFs no Brasil](https://brapi.dev/blog/etfs-brasil-guia-completo-bova11-ivvb11)
- Daycoval — [Setores da bolsa](https://blog.daycoval.com.br/setores-da-bolsa/)
- XP — [Reserva de emergência](https://conteudos.xpi.com.br/aprenda-a-investir/relatorios/reserva-de-emergencia-onde-investir/)

**Para validar antes de publicar (não abriram nesta sessão):** [Portal do Investidor (CVM)](https://www.investidor.gov.br), [Banco Central — Selic](https://www.bcb.gov.br/controleinflacao/taxaselic), [Tesouro Direto](https://www.tesourodireto.com.br), [Resolução CVM 175](https://conteudo.cvm.gov.br/export/sites/cvm/legislacao/resolucoes/anexos/100/resol175consolid_Anexo03.pdf), [Receita Federal — renda variável](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/renda-variavel), [FGC](https://www.fgc.org.br).

> Aviso para todas as páginas: *Conteúdo educativo. Não é recomendação de investimento. Regras de imposto e números de mercado mudam; confira a data e as fontes oficiais.*
