// Gera src/modules/assets/tabela-cnpj.json: ticker da B3 → CNPJ, a partir
// dos dados abertos da CVM. A tabela é fixa e versionada no repositório — a
// API não consulta nada disso em tempo de requisição, e o banco de produção
// não precisa de seed.
//
// Fontes:
// - Ações: FCA, arquivo valor_mobiliario. Traz o código de negociação de cada
//   classe de ação ao lado do CNPJ da companhia.
// - FIIs: Informe Mensal, arquivo geral. A CVM não guarda o ticker do fundo,
//   mas guarda o ISIN, e o ISIN de cota de FII embute a raiz do ticker:
//   BRMXRFCTF008 → MXRF → MXRF11.
//
// Uso: npx tsx scripts/gerar-tabela-cnpj.ts
// Rode de tempos em tempos (IPO, fundo novo) e commite o JSON gerado.
import { writeFileSync } from "node:fs";
import {
  baixarZipCvm,
  lerCsvsDoZip,
  todasAsLinhas,
  type LinhaCsv,
} from "../src/modules/reports/cvm.provider.js";

const DESTINO = new URL("../src/modules/assets/tabela-cnpj.json", import.meta.url);

/**
 * Linhas do ano corrente e do anterior juntas. O arquivo do ano corrente só
 * tem quem já entregou o documento no ano — em setembro, o FCA de 2026 ainda
 * cobria metade das companhias.
 */
async function linhasDosDoisAnos(caminho: (ano: number) => string, arquivo: (ano: number) => string) {
  const ano = new Date().getFullYear();
  const linhas: LinhaCsv[] = [];
  for (const tentativa of [ano - 1, ano]) {
    const zip = await baixarZipCvm(caminho(tentativa));
    const csv = zip && lerCsvsDoZip(zip, [arquivo(tentativa)]).get(arquivo(tentativa));
    if (csv) linhas.push(...todasAsLinhas(csv));
  }
  if (linhas.length === 0) throw new Error(`não consegui baixar ${caminho(ano)}`);
  return linhas;
}

/** A linha mais recente vence: ticker que mudou de dono (incorporação) fica com o atual. */
function registrar(tabela: Map<string, { cnpj: string; data: string }>, ticker: string, cnpj: string, data: string) {
  const atual = tabela.get(ticker);
  if (!atual || data >= atual.data) tabela.set(ticker, { cnpj, data });
}

async function main() {
  const tabela = new Map<string, { cnpj: string; data: string }>();

  const valoresMobiliarios = await linhasDosDoisAnos(
    (ano) => `CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_${ano}.zip`,
    (ano) => `fca_cia_aberta_valor_mobiliario_${ano}.csv`,
  );
  let acoes = 0;
  for (const l of valoresMobiliarios) {
    const ticker = (l["Codigo_Negociacao"] ?? "").trim().toUpperCase();
    const cnpj = l["CNPJ_Companhia"] ?? "";
    // só o que negocia em bolsa hoje: sem data de fim de negociação
    if (!/^[A-Z]{4}\d{1,2}$/.test(ticker) || !cnpj || l["Data_Fim_Negociacao"]) continue;
    if (!/^B3/.test(l["Sigla_Entidade_Administradora"] ?? "")) continue;
    registrar(tabela, ticker, cnpj, l["Data_Referencia"] ?? "");
    acoes++;
  }

  const fundos = await linhasDosDoisAnos(
    (ano) => `FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${ano}.zip`,
    (ano) => `inf_mensal_fii_geral_${ano}.csv`,
  );
  let fiis = 0;
  for (const l of fundos) {
    const isin = (l["Codigo_ISIN"] ?? "").trim().toUpperCase();
    const cnpj = l["CNPJ_Fundo_Classe"] ?? "";
    // BR + raiz de 4 letras + CTF (cota de fundo) + dígitos
    const raiz = /^BR([A-Z]{4})CTF/.exec(isin)?.[1];
    if (!raiz || !cnpj || l["Mercado_Negociacao_Bolsa"] !== "S") continue;
    registrar(tabela, `${raiz}11`, cnpj, l["Data_Referencia"] ?? "");
    fiis++;
  }

  const tickers = Object.fromEntries(
    [...tabela.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, { cnpj }]) => [t, cnpj]),
  );

  writeFileSync(
    DESTINO,
    JSON.stringify(
      {
        geradoEm: new Date().toISOString().slice(0, 10),
        fonte: "dados.cvm.gov.br — FCA (valor_mobiliario) e Informe Mensal de FII (geral)",
        tickers,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`${Object.keys(tickers).length} tickers (${acoes} linhas de ações, ${fiis} de FIIs).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
