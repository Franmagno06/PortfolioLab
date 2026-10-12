import { Prisma } from "@prisma/client";
import type { DadosAcao, DadosFii, InformeFii } from "../reports/cvm.provider.js";
import { lucro, patrimonioLiquido } from "../reports/resumo-cvm.js";
import type { ComposicaoDoFundo, InformeDoFii, ResultadoTrimestral } from "./ativos.tipos.js";

// Regras puras que transformam dado bruto da CVM no que as páginas mostram. Sem rede e sem
// banco: recebem os objetos que cvm.provider.ts já monta e devolvem números. É aqui que mora a
// conta de composição, de taxa e de lucro do trimestre; a orquestração fica em ativos.fontes.ts.

const ZERO = new Prisma.Decimal(0);
const CEM = new Prisma.Decimal(100);

const umaCasa = (d: Prisma.Decimal) => d.toDecimalPlaces(1).toNumber();

/**
 * Quanto do ativo total do fundo está em cada grupo. A base é o Valor_Ativo do informe; se ele
 * faltar, ou se as partes somarem mais que ele (dado inconsistente), a base é a soma das
 * partes, para nenhuma fatia passar de 100%.
 */
export function calcularComposicao(mes: InformeFii): ComposicaoDoFundo | null {
  const imoveis = mes.imoveisTotal ?? ZERO;
  const papel = mes.papelTotal ?? ZERO;
  const cotasDeFii = mes.cotasDeFii ?? ZERO;
  const liquidez = mes.liquidezTotal ?? mes.disponibilidades ?? ZERO;
  const partes = imoveis.plus(papel).plus(cotasDeFii).plus(liquidez);

  const total = mes.valorAtivo && mes.valorAtivo.gt(0) ? mes.valorAtivo : ZERO;
  const base = total.gt(partes) ? total : partes;
  if (base.isZero()) return null;

  const pct = (v: Prisma.Decimal) => umaCasa(v.div(base).mul(CEM));
  return {
    imoveis: pct(imoveis),
    papel: pct(papel),
    cotasDeFii: pct(cotasDeFii),
    liquidez: pct(liquidez),
    outros: pct(base.minus(partes)),
  };
}

/** O que a ficha do FII guarda do informe: poucos números, já em `number`. */
export function montarInformeDoFii(d: DadosFii): InformeDoFii {
  const n = (v: Prisma.Decimal | null) => (v ? v.toNumber() : null);
  return {
    competencia: d.dataReferencia.slice(0, 7),
    patrimonioLiquido: n(d.mes.patrimonioLiquido),
    cotistas: n(d.mes.cotistas),
    valorPatrimonialCota: n(d.mes.valorPatrimonialCota),
    taxaAdministracaoMes: n(d.mes.taxaAdministracaoMes),
    tipoGestao: d.tipoGestao,
    composicao: calcularComposicao(d.mes),
  };
}

/**
 * Taxa de administração efetiva por ano, em % do patrimônio: o que o informe registra de
 * despesa com a taxa no mês, vezes 12. É o que o fundo realmente cobrou, e não a taxa do
 * regulamento (que costuma ter faixas e partes pagas a outros prestadores).
 */
export function taxaAdministracaoAnual(taxaDoMes: number | null): number | null {
  if (taxaDoMes === null || taxaDoMes < 0) return null;
  return new Prisma.Decimal(taxaDoMes).mul(12).mul(CEM).toDecimalPlaces(2).toNumber();
}

/**
 * Os `quantidade` meses mais recentes já encerrados, do mais novo para o mais velho. O
 * informe mensal de um mês só sai nas semanas seguintes, então o primeiro costuma não
 * existir ainda: quem consome tenta um por um até achar.
 */
export function mesesConcluidos(hoje: Date, quantidade: number): { ano: number; mes: number }[] {
  const lista: { ano: number; mes: number }[] = [];
  let ano = hoje.getUTCFullYear();
  let mes = hoje.getUTCMonth(); // o mês anterior, em base 1 (janeiro = 0 vira dezembro abaixo)
  for (let i = 0; i < quantidade; i++) {
    if (mes === 0) {
      mes = 12;
      ano -= 1;
    }
    lista.push({ ano, mes });
    mes -= 1;
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Resultados trimestrais das ações
// ---------------------------------------------------------------------------

export type TrimestreDeCalendario = { ano: number; trimestre: 1 | 2 | 3 | 4 };

/**
 * Os `quantidade` trimestres de calendário mais recentes que já terminaram, do mais novo
 * para o mais velho. O mais novo pode ainda não estar publicado (o ITR sai até 45 dias
 * depois do fim do trimestre): quem consome pula os que a CVM não tem.
 */
export function trimestresConcluidos(hoje: Date, quantidade: number): TrimestreDeCalendario[] {
  const atual = Math.ceil((hoje.getUTCMonth() + 1) / 3);
  let ano = hoje.getUTCFullYear();
  let trimestre = atual - 1;
  if (trimestre === 0) {
    trimestre = 4;
    ano -= 1;
  }

  const lista: TrimestreDeCalendario[] = [];
  for (let i = 0; i < quantidade; i++) {
    lista.push({ ano, trimestre: trimestre as TrimestreDeCalendario["trimestre"] });
    trimestre -= 1;
    if (trimestre === 0) {
      trimestre = 4;
      ano -= 1;
    }
  }
  return lista;
}

/**
 * O resultado de UM trimestre. No ITR (1º ao 3º) a CVM já entrega o trimestre isolado. O 4º
 * vem da DFP, que é o ano inteiro: o trimestre é o ano menos os três primeiros. Sem os três
 * ITRs do ano, o 4T não se calcula e devolve null, em vez de mostrar o ano como se fosse um
 * trimestre. Também devolve null se os quatro documentos não forem da mesma base: buscarDadosAcao
 * cai do consolidado para o individual documento a documento, e subtrair um do outro daria um 4T
 * sem sentido que ainda assim parece um número válido.
 */
export function resultadoDoTrimestre(
  periodo: TrimestreDeCalendario,
  documento: DadosAcao,
  itrsDoAno: Partial<Record<1 | 2 | 3, DadosAcao | null>> = {},
): ResultadoTrimestral | null {
  const patrimonio = patrimonioLiquido(documento)?.atual;
  let lucroDoPeriodo = lucro(documento)?.atual ?? null;
  if (!lucroDoPeriodo || !patrimonio) return null;

  if (periodo.trimestre === 4) {
    for (const t of [1, 2, 3] as const) {
      const itr = itrsDoAno[t];
      const anterior = itr ? lucro(itr)?.atual : null;
      if (!itr || !anterior || itr.consolidado !== documento.consolidado) return null;
      lucroDoPeriodo = lucroDoPeriodo.minus(anterior);
    }
  }

  return {
    periodo: `${periodo.trimestre}T${String(periodo.ano).slice(2)}`,
    dataReferencia: documento.dataReferencia,
    lucroLiquido: lucroDoPeriodo.toDecimalPlaces(0).toNumber(),
    patrimonioLiquido: patrimonio.toDecimalPlaces(0).toNumber(),
  };
}
