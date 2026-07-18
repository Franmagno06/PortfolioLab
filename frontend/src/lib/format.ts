// Formatação centralizada de números — sempre pt-BR

export function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(valor: number): string {
  return `${valor >= 0 ? "+" : ""}${valor.toFixed(1).replace(".", ",")}%`;
}

export const nomesClasse: Record<string, string> = {
  ACAO: "Ações",
  FII: "FIIs",
  ETF: "ETFs",
  RENDA_FIXA: "Renda Fixa",
};

// hex direto (e não var()) porque o Recharts pinta SVG com estes valores
export const coresClasse: Record<string, string> = {
  ACAO: "#1e9e63",
  FII: "#3b6fe0",
  ETF: "#d98324",
  RENDA_FIXA: "#7a5af8",
};
