import { Prisma } from "@prisma/client";
import type { DadosAcao, DadosFii, InformeFii } from "./cvm.provider.js";

// Dados da CVM de mentira para os testes do módulo. Números redondos de propósito: a conta esperada
// em cada teste se confere de cabeça.

const d = (v: string | number) => new Prisma.Decimal(v);

/** Banco: a conta 3.01 é receita de intermediação, então não há margem líquida. */
export const ITR_DE_BANCO: DadosAcao = {
  tipo: "ACAO",
  denominacao: "BCO BRASIL S.A.",
  documento: "ITR",
  dataReferencia: "2026-03-31",
  consolidado: true,
  resultado: [
    { codigo: "3.01", conta: "Receitas de Intermediação Financeira", atual: d("80000000000"), anterior: d("64000000000") },
    { codigo: "3.11", conta: "Lucro Líquido Consolidado", atual: d("9000000000"), anterior: d("8000000000") },
  ],
  balanco: [
    { codigo: "1", conta: "Ativo Total", atual: d("2000000000000"), anterior: d("1900000000000") },
    { codigo: "2.03", conta: "Patrimônio Líquido", atual: d("180000000000"), anterior: d("170000000000") },
  ],
  link: "https://www.rad.cvm.gov.br/ENET/frmGerenciaPaginaFRE.aspx?NumeroSequencialDocumento=1",
};

/** Indústria: receita de venda de 1 bi, lucro de 200 mi (margem de 20%), patrimônio de 2 bi (retorno de 10%). */
export const ITR_DE_INDUSTRIA: DadosAcao = {
  tipo: "ACAO",
  denominacao: "INDUSTRIA EXEMPLO S.A.",
  documento: "ITR",
  dataReferencia: "2026-06-30",
  consolidado: false,
  resultado: [
    { codigo: "3.01", conta: "Receita de Venda de Bens e/ou Serviços", atual: d("1000000000"), anterior: d("800000000") },
    { codigo: "3.11", conta: "Lucro/Prejuízo Consolidado do Período", atual: d("200000000"), anterior: d("160000000") },
  ],
  balanco: [
    { codigo: "1", conta: "Ativo Total", atual: d("5000000000"), anterior: d("5000000000") },
    { codigo: "2.03", conta: "Patrimônio Líquido Consolidado", atual: d("2000000000"), anterior: d("1900000000") },
  ],
  link: null,
};

const informeVazio: InformeFii = {
  valorAtivo: null,
  patrimonioLiquido: null,
  cotasEmitidas: null,
  valorPatrimonialCota: null,
  cotistas: null,
  dividendYieldMes: null,
  rentabilidadeEfetivaMes: null,
  rentabilidadePatrimonialMes: null,
  taxaAdministracaoMes: null,
  amortizacaoMes: null,
  rendimentosADistribuir: null,
  totalInvestido: null,
  imoveisParaRenda: null,
  cri: null,
  cotasDeFii: null,
  disponibilidades: null,
  totalPassivo: null,
  imoveisTotal: null,
  papelTotal: null,
  liquidezTotal: null,
};

export const informe = (campos: Partial<Record<keyof InformeFii, string | number>>): InformeFii => ({
  ...informeVazio,
  ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, d(v)])),
});

/** Um informe igual a `base`, trocando só os campos dados (os demais ficam como estavam, não viram null). */
export const informeCom = (base: InformeFii, campos: Partial<Record<keyof InformeFii, string | number>>): InformeFii => ({
  ...base,
  ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, d(v)])),
});

/** Fundo de papel: ativo de 1 bi, passivo de 50 mi (5%), caixa de 20 mi (2%). Nenhum alerta. */
export const INFORME_DE_FII: DadosFii = {
  tipo: "FII",
  nome: "FUNDO EXEMPLO RECEBÍVEIS FII",
  segmento: "Títulos e Valores Mobiliários",
  mandato: "Títulos e Valores Mobiliários",
  tipoGestao: "Ativa",
  dataReferencia: "2026-03-01",
  mes: informe({
    valorAtivo: "1000000000",
    patrimonioLiquido: "950000000",
    cotasEmitidas: "100000000",
    valorPatrimonialCota: "9.5",
    cotistas: "500000",
    dividendYieldMes: "0.01",
    rentabilidadeEfetivaMes: "0.012",
    cri: "900000000",
    disponibilidades: "20000000",
    totalPassivo: "50000000",
    taxaAdministracaoMes: "0.0008",
  }),
  mesAnterior: informe({
    valorAtivo: "990000000",
    patrimonioLiquido: "940000000",
    cotasEmitidas: "100000000",
    valorPatrimonialCota: "9.4",
    cotistas: "490000",
    dividendYieldMes: "0.01",
    disponibilidades: "20000000",
    totalPassivo: "50000000",
  }),
};
