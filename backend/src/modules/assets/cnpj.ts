import tabela from "./tabela-cnpj.json" with { type: "json" };

// Ticker da B3 → CNPJ no formato da CVM. A tabela é fixa, gerada a partir dos
// dados abertos da CVM por scripts/gerar-tabela-cnpj.ts — ver lá as fontes.
// ETF e BDR não estão nela: não têm ITR nem Informe Mensal de FII.
// Ajustes à mão, para o que a tabela gerada deixou de fora. A B3 (B3SA3) fica sem CNPJ no que a CVM
// publica de cadastro; o CNPJ abaixo foi conferido nos dados abertos (ITR da "B3 S.A. - BRASIL, BOLSA,
// BALCÃO"). Vale sobre a tabela, que é regenerada por scripts/gerar-tabela-cnpj.ts e perderia a edição.
const AJUSTES_MANUAIS: Record<string, string> = {
  B3SA3: "09.346.601/0001-25",
};

const porTicker: Record<string, string | undefined> = { ...tabela.tickers, ...AJUSTES_MANUAIS };

export function cnpjDoTicker(ticker: string): string | null {
  return porTicker[ticker.toUpperCase().trim()] ?? null;
}
