# Relatórios reais para testar o módulo de IA

Documentos oficiais baixados dos sites de RI, usados para validar a tela
**Relatórios com IA**. Todos já foram testados de ponta a ponta.

| Arquivo | Empresa | Tipo | Tamanho |
|---------|---------|------|---------|
| `MXRF11-relatorio-gerencial-maio-2026.pdf` | Maxi Renda FII | Relatório gerencial de FII | 31 páginas |
| `MXRF11-relatorio-gerencial-marco-2026.pdf` | Maxi Renda FII | Relatório gerencial de FII | 31 páginas |
| `BBAS3-Banco-do-Brasil-analise-desempenho-1T26.pdf` | Banco do Brasil | Análise de desempenho trimestral | 301 páginas |
| `BBSE3-BB-Seguridade-sumario-desempenho-1T26.pdf` | BB Seguridade | Sumário de desempenho trimestral | 5 páginas |

## O que cada um exercita

- **FII (MXRF11)** — vacância, emissão de cotas, CRIs inadimplentes, dividend yield.
  Os dois meses servem para conferir que a IA lê cada documento (os números mudam).
- **Banco (BBAS3)** — documento grande (301 páginas, 760 mil caracteres). Traz
  indicadores bancários: Basileia, inadimplência, índice de cobertura, ROE, P/VPA.
- **Seguradora (BBSE3)** — documento curto, com guidance e resultado por subsidiária.

## Conferir se a IA inventou algum número

```bash
cd ../backend
node scripts/verificar-analise.mjs <caminho-do-pdf> "valor1" "valor2" ...
```

O script extrai o texto do PDF e checa se cada valor aparece no documento.
Atenção: ele faz comparação literal — um valor pode constar como correto na
análise e não bater aqui por diferença de unidade (ex: a IA escreve
"R$ 11,8 milhões" onde o PDF traz "11.849" em milhares). Nesses casos, confira
o trecho manualmente antes de concluir que houve alucinação.

## Medir o tamanho de um PDF antes de enviar

```bash
node scripts/medir-pdf.mjs <caminho-do-pdf>
```

Limites atuais: 25 MB de arquivo e 2 milhões de caracteres de texto extraído.
