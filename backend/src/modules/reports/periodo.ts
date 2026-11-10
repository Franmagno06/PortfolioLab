// Detecção do período de referência na capa do relatório.
//
// Pura, sem PDF: recebe o texto das primeiras páginas e devolve o trimestre
// e o mês mais recentes que encontrou. "Mais recente", e não "primeiro" ou
// "mais citado": a capa de um release traz a série histórica no gráfico
// (1T25 2T25 3T25 4T25 1T26), e comparação é sempre com o passado — o
// período do documento é o último da série.

export type Trimestre = { tipo: "trimestre"; ano: number; trimestre: 1 | 2 | 3 | 4 };
export type Mes = { tipo: "mes"; ano: number; mes: number };
export type Periodo = Trimestre | Mes;

const MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ORDINAIS = ["primeiro", "segundo", "terceiro", "quarto"];

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

function anoCompleto(ano: string): number {
  return ano.length === 2 ? 2000 + Number(ano) : Number(ano);
}

/** Minúsculas, sem acento e com espaços colapsados: "Março" e "MARÇO" viram "marco". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function detectarPeriodos(
  texto: string,
  hoje: Date = new Date(),
): { trimestre: Trimestre | null; mes: Mes | null } {
  const t = normalizar(texto);
  const trimestres: Trimestre[] = [];
  const meses: Mes[] = [];

  const addTrimestre = (trimestre: number, ano: number) =>
    trimestres.push({ tipo: "trimestre", ano, trimestre: trimestre as Trimestre["trimestre"] });
  const addMes = (mes: number, ano: number) => meses.push({ tipo: "mes", ano, mes });

  // Data de fechamento: 31/03/2026, "31 de marco de 2026". Só o último dia do
  // mês conta — "Sao Paulo, 12 de maio de 2026" é a data de divulgação, não o
  // período, e "13/04/2012" na capa do MXRF11 é o início do fundo.
  const dataFechamento = (dia: number, mes: number, ano: number) => {
    if (mes < 1 || mes > 12 || dia !== ultimoDiaDoMes(ano, mes)) return;
    addMes(mes, ano);
    if (mes % 3 === 0) addTrimestre(mes / 3, ano);
  };

  // 1T26, 1 T 26, 4T2025, 2tri25, 3trim/2025. Os PDFs costumam quebrar a
  // sigla em letras separadas ("1 T 26"), daí os espaços opcionais.
  for (const m of t.matchAll(/\b([1-4])\s?t(?:ri|rim)?\s?\/?\s?(\d{4}|\d{2})\b/g)) {
    addTrimestre(Number(m[1]), anoCompleto(m[2]!));
  }

  // 4º trimestre de 2025, 1o trimestre 2026, 2° trimestre/2026
  for (const m of t.matchAll(/\b([1-4])\s?(?:º|°|o|ª)?\s?trimestre\s?(?:de |do ano de |\/)?\s?(\d{4})\b/g)) {
    addTrimestre(Number(m[1]), Number(m[2]));
  }

  // primeiro trimestre de 2026
  for (const m of t.matchAll(/\b(primeiro|segundo|terceiro|quarto) trimestre (?:de |do ano de )?(\d{4})\b/g)) {
    addTrimestre(ORDINAIS.indexOf(m[1]!) + 1, Number(m[2]));
  }

  // 31/03/2026
  for (const m of t.matchAll(/\b(\d{1,2}) ?\/ ?(\d{1,2}) ?\/ ?(\d{4})\b/g)) {
    dataFechamento(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // "31 de marco de 2026" (fechamento) e "marco de 2026", "marco 2026",
  // "marco/2026" (mês de competência, típico de FII).
  const nomes = MESES.join("|");
  for (const m of t.matchAll(new RegExp(`(?:\\b(\\d{1,2}) de )?\\b(${nomes})\\b(?: de|\\/)? ?(\\d{4})\\b`, "g"))) {
    const mes = MESES.indexOf(m[2]!) + 1;
    const ano = Number(m[3]);
    if (m[1]) dataFechamento(Number(m[1]), mes, ano);
    else addMes(mes, ano);
  }

  // mar/26, mar-2026
  for (const m of t.matchAll(new RegExp(`\\b(${MESES_CURTOS.join("|")}) ?[\\/-] ?(\\d{4}|\\d{2})\\b`, "g"))) {
    addMes(MESES_CURTOS.indexOf(m[1]!) + 1, anoCompleto(m[2]!));
  }

  // 03/2026 — sem dia na frente, senão é pedaço de uma data completa
  for (const m of t.matchAll(/(?<!\d ?\/ ?)\b(0?[1-9]|1[0-2]) ?\/ ?(20\d{2})\b/g)) {
    addMes(Number(m[1]), Number(m[2]));
  }

  // Período que ainda não começou não é o do relatório: é previsão de
  // pagamento, guidance ou vencimento citado na capa.
  const anoHoje = hoje.getFullYear();
  const mesHoje = hoje.getMonth() + 1;
  const plausivel = (ano: number, mesInicial: number) =>
    ano >= 2000 && (ano < anoHoje || (ano === anoHoje && mesInicial <= mesHoje));

  const trimestre = trimestres
    .filter((p) => plausivel(p.ano, p.trimestre * 3 - 2))
    .reduce<Trimestre | null>(
      (maior, p) => (!maior || p.ano * 10 + p.trimestre > maior.ano * 10 + maior.trimestre ? p : maior),
      null,
    );

  const mes = meses
    .filter((p) => plausivel(p.ano, p.mes))
    .reduce<Mes | null>(
      (maior, p) => (!maior || p.ano * 100 + p.mes > maior.ano * 100 + maior.mes ? p : maior),
      null,
    );

  return { trimestre, mes };
}

/** Chave estável para banco e cache: "2026-T1" ou "2026-03". */
export function chaveDoPeriodo(p: Periodo): string {
  return p.tipo === "trimestre" ? `${p.ano}-T${p.trimestre}` : `${p.ano}-${String(p.mes).padStart(2, "0")}`;
}

/** Ticker B3 a partir de texto livre ou nome de arquivo: PETR4, BBAS3, MXRF11, HGLG11, etc. */
export function detectarTicker(textoOuNome: string): string | null {
  if (!textoOuNome) return null;
  const match = textoOuNome.toUpperCase().match(/(?:^|[^A-Z0-9])([A-Z]{4}(?:3|4|5|6|11|12))(?:[^A-Z0-9]|$)/);
  return match ? match[1]! : null;
}

/** Como o mercado escreve: "1T26" ou "março de 2026". */
export function rotuloDoPeriodo(p: Periodo): string {
  if (p.tipo === "trimestre") return `${p.trimestre}T${String(p.ano).slice(-2)}`;
  const nome = MESES[p.mes - 1] === "marco" ? "março" : MESES[p.mes - 1];
  return `${nome} de ${p.ano}`;
}
/** Converte string de período ("2026-T1", "1T26", "2026-03", "03/2026") em Periodo. */
export function parsearPeriodo(texto: string): Periodo | null {
  if (!texto) return null;
  const t = texto.trim().toUpperCase();
  const mTri1 = t.match(/^(\d{4})[-/]?T?([1-4])$/);
  if (mTri1) {
    return { tipo: "trimestre", ano: Number(mTri1[1]), trimestre: Number(mTri1[2]) as 1 | 2 | 3 | 4 };
  }
  const mTri2 = t.match(/^([1-4])T(\d{2,4})$/);
  if (mTri2) {
    const digitosDoAno = mTri2[2] ?? "";
    const ano = digitosDoAno.length === 2 ? 2000 + Number(digitosDoAno) : Number(digitosDoAno);
    return { tipo: "trimestre", ano, trimestre: Number(mTri2[1]) as 1 | 2 | 3 | 4 };
  }
  const mMes1 = t.match(/^(\d{4})[-/](0?[1-9]|1[0-2])$/);
  if (mMes1) {
    return { tipo: "mes", ano: Number(mMes1[1]), mes: Number(mMes1[2]) };
  }
  const mMes2 = t.match(/^(0?[1-9]|1[0-2])[-/](\d{4})$/);
  if (mMes2) {
    return { tipo: "mes", ano: Number(mMes2[2]), mes: Number(mMes2[1]) };
  }
  return null;
}
