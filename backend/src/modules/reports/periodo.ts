// Períodos das demonstrações que a CVM publica: trimestre para companhia aberta (ITR do 1º ao 3º,
// DFP no 4º) e mês para fundo imobiliário (Informe Mensal). Tudo puro, sem rede nem banco.

export type Trimestre = { tipo: "trimestre"; ano: number; trimestre: 1 | 2 | 3 | 4 };
export type Mes = { tipo: "mes"; ano: number; mes: number };
export type Periodo = Trimestre | Mes;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Chave estável para banco e cache: "2026-T1" ou "2026-03". */
export function chaveDoPeriodo(p: Periodo): string {
  return p.tipo === "trimestre" ? `${p.ano}-T${p.trimestre}` : `${p.ano}-${String(p.mes).padStart(2, "0")}`;
}

/** Como o mercado escreve: "1T26" ou "março de 2026". */
export function rotuloDoPeriodo(p: Periodo): string {
  if (p.tipo === "trimestre") return `${p.trimestre}T${String(p.ano).slice(-2)}`;
  return `${MESES[p.mes - 1]} de ${p.ano}`;
}

/** Converte string de período ("2026-T1", "1T26", "2026-03", "03/2026") em Periodo. */
export function parsearPeriodo(texto: string): Periodo | null {
  if (!texto) return null;
  const t = texto.trim().toUpperCase();
  const mTri1 = t.match(/^(\d{4})[-/]?T([1-4])$/);
  if (mTri1) {
    return { tipo: "trimestre", ano: Number(mTri1[1]), trimestre: Number(mTri1[2]) as 1 | 2 | 3 | 4 };
  }
  const mTri2 = t.match(/^([1-4])T(\d{2}|\d{4})$/);
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

/** O período imediatamente anterior: 1T26 vem depois de 4T25; janeiro de 2026, depois de dezembro de 2025. */
export function periodoAnterior<P extends Periodo>(p: P): P;
export function periodoAnterior(p: Periodo): Periodo {
  if (p.tipo === "trimestre") {
    return p.trimestre === 1
      ? { tipo: "trimestre", ano: p.ano - 1, trimestre: 4 }
      : { tipo: "trimestre", ano: p.ano, trimestre: (p.trimestre - 1) as 1 | 2 | 3 };
  }
  return p.mes === 1 ? { tipo: "mes", ano: p.ano - 1, mes: 12 } : { tipo: "mes", ano: p.ano, mes: p.mes - 1 };
}

/**
 * O último período que já terminou no calendário, no dia `hoje`. Terminar não é estar publicado: a
 * companhia tem semanas para entregar o ITR e meses para a DFP, e o fundo, dias para o informe. Quem
 * procura "o mais recente" parte daqui e anda para trás até achar um que a CVM já tenha.
 */
export function ultimoPeriodoEncerrado(tipo: "trimestre", hoje: Date): Trimestre;
export function ultimoPeriodoEncerrado(tipo: "mes", hoje: Date): Mes;
export function ultimoPeriodoEncerrado(tipo: Periodo["tipo"], hoje: Date): Periodo {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  if (tipo === "trimestre") {
    const emCurso = Math.ceil(mes / 3) as 1 | 2 | 3 | 4;
    return periodoAnterior({ tipo: "trimestre", ano, trimestre: emCurso });
  }
  return periodoAnterior({ tipo: "mes", ano, mes });
}
