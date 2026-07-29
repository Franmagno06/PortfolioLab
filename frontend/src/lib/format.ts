// Formatação centralizada de números — sempre pt-BR

export function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(valor: number): string {
  return `${valor >= 0 ? "+" : ""}${valor.toFixed(1).replace(".", ",")}%`;
}

/** "há 2 horas", "há 3 dias" — para o feed de notícias */
export function tempoRelativo(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} ${horas === 1 ? "hora" : "horas"}`;

  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;

  return new Date(iso).toLocaleDateString("pt-BR");
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
