import { janelasDoSgs, paraBcb, diaEmSaoPaulo, paraIso, type PontoSerie } from "./indices.calculos.js";
import { respostaSgsSchema } from "./indices.schemas.js";

const BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";
const BASE_B3 = "https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay";
const TIMEOUT_MS = 15_000;

export type IndiceB3 = "IFIX" | "SMLL" | "IDIV";

type LinhaDiaB3 = {
  day?: number;
  [chave: `rateValue${number}`]: string | null | undefined;
};

async function tentarJanela(codigo: number, inicio: Date, fim: Date): Promise<PontoSerie[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      `${BASE}.${codigo}/dados?formato=json` +
      `&dataInicial=${paraBcb(diaEmSaoPaulo(inicio))}&dataFinal=${paraBcb(diaEmSaoPaulo(fim))}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const analise = respostaSgsSchema.safeParse(await res.json());
    if (!analise.success) return null;
    return analise.data.map((l) => ({ data: paraIso(l.data), valor: l.valor }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Uma tentativa extra: o SGS falha de vez em quando (timeout, 5xx) e acerta na seguinte. */
async function buscarJanela(codigo: number, inicio: Date, fim: Date): Promise<PontoSerie[] | null> {
  return (await tentarJanela(codigo, inicio, fim)) ?? (await tentarJanela(codigo, inicio, fim));
}

/**
 * Série do Banco Central (SGS), uma chamada por janela de 5 anos. Devolve null se
 * qualquer janela falhar: série com buraco no meio engana mais do que série ausente.
 */
export async function buscarSerieSgs(codigo: number, desde: Date, ate: Date): Promise<PontoSerie[] | null> {
  const pontos: PontoSerie[] = [];
  for (const { inicio, fim } of janelasDoSgs(desde, ate)) {
    const janela = await buscarJanela(codigo, inicio, fim);
    if (!janela) return null;
    pontos.push(...janela);
  }
  return pontos;
}

function dataValidaNoCalendario(ano: number, mes: number, dia: number): boolean {
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  return dt.getUTCFullYear() === ano && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === dia;
}

async function tentarAnoB3(indice: IndiceB3, ano: number): Promise<PontoSerie[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const payloadBase64 = Buffer.from(
      JSON.stringify({ index: indice, language: "pt-br", year: String(ano) }),
    ).toString("base64");
    const res = await fetch(`${BASE_B3}/${payloadBase64}`, { signal: controller.signal });
    if (!res.ok) return null;
    const corpo = (await res.json()) as { results?: LinhaDiaB3[] | null } | null;
    if (!corpo || typeof corpo !== "object") return null;
    if (!Array.isArray(corpo.results)) return corpo.results === null ? [] : null;

    const pontos: PontoSerie[] = [];
    for (const linha of corpo.results) {
      const dia = linha?.day;
      if (typeof dia !== "number" || !Number.isInteger(dia) || dia < 1 || dia > 31) continue;
      for (let mes = 1; mes <= 12; mes++) {
        const bruto = linha[`rateValue${mes}`];
        if (typeof bruto !== "string" || bruto.trim() === "") continue;
        const valor = Number(bruto.replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(valor) || valor <= 0) continue;
        if (!dataValidaNoCalendario(ano, mes, dia)) continue;
        const data = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        pontos.push({ data, valor });
      }
    }
    return pontos;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buscarAnoB3(indice: IndiceB3, ano: number): Promise<PontoSerie[] | null> {
  return (await tentarAnoB3(indice, ano)) ?? (await tentarAnoB3(indice, ano));
}

/**
 * Histórico diário da B3 (IFIX, SMLL, IDIV) via endpoint público de estatísticas,
 * ano a ano. Devolve os pontos ordenados por data ou null se nenhum ponto válido vier.
 */
export async function buscarSerieHistoricaB3(
  indice: IndiceB3,
  anoInicial: number,
  anoFinal: number,
): Promise<PontoSerie[] | null> {
  const pontos: PontoSerie[] = [];
  for (let ano = anoInicial; ano <= anoFinal; ano++) {
    const doAno = await buscarAnoB3(indice, ano);
    if (doAno) pontos.push(...doAno);
  }
  if (pontos.length === 0) return null;
  return pontos.sort((a, b) => a.data.localeCompare(b.data));
}
