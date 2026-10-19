/** Um ponto de uma série: `data` é "AAAA-MM-DD" (diária) ou "AAAA-MM" (mensal). */
export type PontoSerie = { data: string; valor: number };

const formatadorSp = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** O dia civil de um instante no fuso da B3, "AAAA-MM-DD". */
export function diaEmSaoPaulo(instante: Date): string {
  return formatadorSp.format(instante);
}

/** "dd/MM/aaaa" (formato do Banco Central) para "AAAA-MM-DD". */
export function paraIso(dataBcb: string): string {
  const [dia, mes, ano] = dataBcb.split("/");
  return `${ano}-${mes}-${dia}`;
}

/** "AAAA-MM-DD" para "dd/MM/aaaa". */
export function paraBcb(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const ANOS_POR_JANELA = 5;

/**
 * O SGS recusa consulta diária com mais de 10 anos; cortamos a cada 5 anos, sempre
 * em 31/12, e a última janela termina em `ate`. Os instantes ficam ao meio-dia de
 * São Paulo para o dia civil não escorregar com o fuso.
 */
export function janelasDoSgs(desde: Date, ate: Date): { inicio: Date; fim: Date }[] {
  const meioDia = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes, dia, 15));
  const anoFinal = Number(diaEmSaoPaulo(ate).slice(0, 4));
  const janelas: { inicio: Date; fim: Date }[] = [];

  let inicio = desde;
  let anoInicio = Number(diaEmSaoPaulo(desde).slice(0, 4));
  while (inicio.getTime() <= ate.getTime()) {
    const anoFim = anoInicio + ANOS_POR_JANELA - 1;
    if (anoFim >= anoFinal) {
      janelas.push({ inicio, fim: ate });
      break;
    }
    janelas.push({ inicio, fim: meioDia(anoFim, 11, 31) });
    anoInicio = anoFim + 1;
    inicio = meioDia(anoInicio, 0, 1);
  }
  return janelas;
}

/** Descarta pontos depois de `hoje` ("AAAA-MM-DD"); o SGS 432 repete a meta adiantada. */
export function ateHoje(serie: PontoSerie[], hoje: string): PontoSerie[] {
  return serie.filter((p) => p.data <= hoje);
}

/** De uma série diária, o último valor de cada mês, com data "AAAA-MM". */
export function fimDeCadaMes(diaria: PontoSerie[]): PontoSerie[] {
  const ordenada = [...diaria].sort((a, b) => a.data.localeCompare(b.data));
  const porMes = new Map<string, number>();
  for (const p of ordenada) porMes.set(p.data.slice(0, 7), p.valor);
  return [...porMes].map(([data, valor]) => ({ data, valor }));
}

/** Séries mensais do SGS vêm com dia 01: "AAAA-MM-01" vira "AAAA-MM". */
export function paraMensal(serie: PontoSerie[]): PontoSerie[] {
  return serie.map((p) => ({ data: p.data.slice(0, 7), valor: p.valor }));
}
