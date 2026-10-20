// Formatação centralizada de números — sempre pt-BR

export function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Valor em reais, ou "—" quando a fonte não informou. */
export function brlOuTraco(valor: number | null): string {
  return valor === null ? "—" : brl(valor);
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
 * Quantidade de ativo: inteira sem casas ("10"), fracionária com as que tem ("0,5"), até 8.
 * Aceita o Decimal que a API manda como string.
 */
export function quantidadeTexto(q: string | number): string {
  const n = Number(q);
  const casas = Math.min(8, (String(n).split(".")[1] ?? "").length);
  return numero(n, casas);
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

/** Data ISO (AAAA-MM-DD) em dd/mm/aaaa, sem passar por Date: o fuso não desloca o dia. */
export function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Instante ISO (com hora) em dd/mm/aaaa no fuso de Brasília: às 22h o dia não vira o seguinte, como viraria em UTC. */
export function dataDeLeitura(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Mês de um "AAAA-MM" em três letras, para o eixo de um gráfico: "2025-11" → "nov". */
export function mesCurto(anoMes: string): string {
  return MESES_CURTOS[Number(anoMes.slice(5, 7)) - 1] ?? anoMes;
}

/** "2025-11" → "nov/2025". */
export function mesAno(anoMes: string): string {
  return `${mesCurto(anoMes)}/${anoMes.slice(0, 4)}`;
}

const MESES_POR_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** O mês de um "AAAA-MM", por extenso, para o meio de uma frase: "2026-09" → "setembro". */
export function mesPorExtenso(anoMes: string): string {
  return MESES_POR_EXTENSO[Number(anoMes.slice(5, 7)) - 1] ?? anoMes;
}

/** "2025-01" → "01/2025": o mês como aparece em tabela e em eixo de gráfico. */
export function mesNumerico(anoMes: string): string {
  return `${anoMes.slice(5, 7)}/${anoMes.slice(0, 4)}`;
}

/** Data ISO em dd/mm/aa, para o eixo de um gráfico diário: "2026-09-10" → "10/09/26". */
export function dataDiaCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

/** Valor em bilhões de reais, como cabe numa frase: 3.2 → "R$ 3,2 bi"; 0.7 → "R$ 700 mi". */
export function reaisCompactos(bilhoes: number): string {
  return bilhoes >= 1 ? `R$ ${numero(bilhoes, 1)} bi` : `R$ ${numero(bilhoes * 1000)} mi`;
}

/** Contagem em palavras curtas: 985000 → "985 mil"; 1250000 → "1,3 mi". */
export function contagemCompacta(n: number): string {
  if (n >= 1_000_000) return `${numero(n / 1_000_000, 1)} mi`;
  if (n >= 1_000) return `${numero(Math.round(n / 1_000))} mil`;
  return numero(n);
}

/** Múltiplo de uma vez: 0.6 → "0,6x". */
export function multiplo(valor: number, casas = 1): string {
  return `${numero(valor, casas)}x`;
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

