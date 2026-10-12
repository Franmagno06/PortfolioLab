// Formatação centralizada de números — sempre pt-BR

export function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(valor: number): string {
  return `${valor >= 0 ? "+" : ""}${valor.toFixed(1).replace(".", ",")}%`;
}

// Um Intl.NumberFormat por quantidade de casas, criado uma vez: montar o
// formatador custa mais do que formatar, e o site formata dezenas de números.
const formatadoresDeNumero = new Map<number, Intl.NumberFormat>();

function formatadorDeNumero(casas: number): Intl.NumberFormat {
  let formatador = formatadoresDeNumero.get(casas);
  if (!formatador) {
    formatador = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
    formatadoresDeNumero.set(casas, formatador);
  }
  return formatador;
}

/** Número em pt-BR com casas fixas: numero(192115) → "192.115"; numero(20.84, 1) → "20,8". */
export function numero(valor: number, casas = 0): string {
  return formatadorDeNumero(casas).format(valor);
}

/**
 * Percentual sem sinal, para taxa e indicador: percentual(7.02) → "7,0%";
 * percentual(13.75, 2) → "13,75%". Para variação, que precisa do sinal, use pct().
 */
export function percentual(valor: number, casas = 1): string {
  return `${numero(valor, casas)}%`;
}

/** Reais sem centavos, para valor redondo dentro de uma frase: "R$ 1.000". */
export function brlSemCentavos(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const VEZES_POR_EXTENSO = [
  "nenhuma vez", "uma vez", "duas vezes", "três vezes", "quatro vezes", "cinco vezes",
  "seis vezes", "sete vezes", "oito vezes", "nove vezes", "dez vezes", "onze vezes", "doze vezes",
];

/** Contagem por extenso em frase corrida: vezesPorExtenso(4) → "quatro vezes". Acima de doze, em algarismos. */
export function vezesPorExtenso(n: number): string {
  return VEZES_POR_EXTENSO[n] ?? `${numero(n)} vezes`;
}

/** Indicador que o provedor não informou (comum em FII e empresa recém-listada). */
export function indicadorOuTraco(valor: number | null): string {
  return valor === null ? "—" : valor.toFixed(2).replace(".", ",");
}

/** Mesma regra de "—" para indicador ausente, mas em pontos percentuais (DY, ROE, margem). */
export function pctIndicadorOuTraco(valor: number | null): string {
  return valor === null ? "—" : pct(valor);
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

