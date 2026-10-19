import { janelasDoSgs, paraBcb, diaEmSaoPaulo, paraIso, type PontoSerie } from "./indices.calculos.js";
import { respostaSgsSchema } from "./indices.schemas.js";

const BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";
const TIMEOUT_MS = 10_000;

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
