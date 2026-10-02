import tabela from "./tabela-cnpj.json" with { type: "json" };

// Ticker da B3 → CNPJ no formato da CVM. A tabela é fixa, gerada a partir dos
// dados abertos da CVM por scripts/gerar-tabela-cnpj.ts — ver lá as fontes.
// ETF e BDR não estão nela: não têm ITR nem Informe Mensal de FII.
const porTicker: Record<string, string | undefined> = tabela.tickers;

export function cnpjDoTicker(ticker: string): string | null {
  return porTicker[ticker.toUpperCase().trim()] ?? null;
}
