import { Prisma } from "@prisma/client";
import { unzipSync } from "fflate";
import type { Mes, Trimestre } from "./periodo.js";

/**
 * Dados abertos da CVM (dados.cvm.gov.br).
 *
 * Não existe API por empresa: cada ano de ITR, DFP ou Informe Mensal de FII é
 * um zip único com todas as companhias ou fundos, e o CNPJ é a única chave.
 * O zip do ITR passa de 19 MB, então ele fica em memória por algumas horas
 * — a base só é atualizada uma vez por semana.
 *
 * Como os outros provedores externos, nada aqui lança erro: dado ausente,
 * CVM fora do ar ou arquivo em formato inesperado viram null, e o relatório
 * cai na leitura do PDF inteiro.
 */

const BASE = "https://dados.cvm.gov.br/dados";

// O zip do ITR tem ~20 MB. Numa conexão ruim isso passa de 30s.
const TIMEOUT_MS = 90_000;
const VALIDADE_MS = 6 * 60 * 60 * 1000;

const cacheZip = new Map<string, { em: number; promessa: Promise<Uint8Array | null> }>();

/** Esvazia o cache de downloads. Só para testes. */
export function limparCacheCvm() {
  cacheZip.clear();
}

async function baixar(caminho: string): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${caminho}`, { signal: controller.signal });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error(`[CVM] falha ao baixar ${caminho}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baixa um zip da CVM, reaproveitando o download recente. Uploads simultâneos
 * do mesmo período dividem a mesma requisição em vez de baixar 20 MB cada.
 */
export function baixarZipCvm(caminho: string): Promise<Uint8Array | null> {
  const guardado = cacheZip.get(caminho);
  if (guardado && Date.now() - guardado.em < VALIDADE_MS) return guardado.promessa;

  const promessa = baixar(caminho).then((zip) => {
    // falha não fica no cache: a próxima tentativa baixa de novo
    if (!zip) cacheZip.delete(caminho);
    return zip;
  });
  cacheZip.set(caminho, { em: Date.now(), promessa });
  return promessa;
}

/**
 * Extrai do zip só os CSVs pedidos, já decodificados. Os arquivos da CVM são
 * ISO-8859-1; ler como UTF-8 estraga todo "Patrimônio" e "Prejuízo".
 */
export function lerCsvsDoZip(zip: Uint8Array, nomes: string[]): Map<string, string> {
  const arquivos = unzipSync(zip, { filter: (f) => nomes.includes(f.name) });
  const decodificador = new TextDecoder("latin1");
  return new Map(Object.entries(arquivos).map(([nome, bytes]) => [nome, decodificador.decode(bytes)]));
}

export type LinhaCsv = Record<string, string>;

function paraLinha(cabecalho: string[], linha: string): LinhaCsv {
  const valores = linha.replace(/\r$/, "").split(";");
  return Object.fromEntries(cabecalho.map((coluna, i) => [coluna, valores[i] ?? ""]));
}

/**
 * Linhas do CSV que mencionam o CNPJ. Procura a string no texto em vez de
 * quebrar o arquivo inteiro em linhas: o BPP consolidado do ITR tem 38 MB e a
 * companhia buscada ocupa algumas centenas de linhas dele.
 */
export function linhasComCnpj(csv: string, cnpj: string): LinhaCsv[] {
  const fimCabecalho = csv.indexOf("\n");
  if (fimCabecalho < 0) return [];
  const cabecalho = csv.slice(0, fimCabecalho).replace(/\r$/, "").split(";");

  const linhas: LinhaCsv[] = [];
  let posicao = csv.indexOf(cnpj, fimCabecalho);
  while (posicao >= 0) {
    const inicio = csv.lastIndexOf("\n", posicao) + 1;
    let fim = csv.indexOf("\n", posicao);
    if (fim < 0) fim = csv.length;
    const linha = paraLinha(cabecalho, csv.slice(inicio, fim));
    // o CNPJ pode aparecer noutra coluna (o do administrador, no FII)
    if (linha["CNPJ_CIA"] === cnpj || linha["CNPJ_Fundo_Classe"] === cnpj) linhas.push(linha);
    posicao = csv.indexOf(cnpj, fim);
  }
  return linhas;
}

/** Todas as linhas do CSV. Só para arquivos pequenos (o script da tabela de CNPJ). */
export function todasAsLinhas(csv: string): LinhaCsv[] {
  const [cabecalho, ...resto] = csv.split("\n");
  if (!cabecalho) return [];
  const colunas = cabecalho.replace(/\r$/, "").split(";");
  return resto.filter((l) => l.trim()).map((l) => paraLinha(colunas, l));
}

/** A CVM republica documentos corrigidos com VERSAO maior; vale a última. */
function ultimaVersao(linhas: LinhaCsv[], coluna: "VERSAO" | "Versao"): LinhaCsv[] {
  const maior = Math.max(...linhas.map((l) => Number(l[coluna]) || 0));
  return linhas.filter((l) => (Number(l[coluna]) || 0) === maior);
}

function decimalOuNull(valor: string | undefined): Prisma.Decimal | null {
  if (!valor || !valor.trim()) return null;
  try {
    return new Prisma.Decimal(valor.trim());
  } catch {
    return null;
  }
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// Companhias abertas: ITR (1º a 3º trimestre) e DFP (exercício)
// ---------------------------------------------------------------------------

export type ContaCvm = {
  codigo: string;
  conta: string;
  /** Em reais, já multiplicado pela escala do arquivo. */
  atual: Prisma.Decimal | null;
  anterior: Prisma.Decimal | null;
};

export type DadosAcao = {
  tipo: "ACAO";
  denominacao: string;
  documento: "ITR" | "DFP";
  /** Data-base do documento, ex.: 2026-03-31. */
  dataReferencia: string;
  consolidado: boolean;
  /** Contas da DRE do período (trimestre, ou exercício no DFP) contra o mesmo período do ano anterior. */
  resultado: ContaCvm[];
  /** Contas do balanço na data-base contra o fim do exercício anterior. */
  balanco: ContaCvm[];
  /** Link para o documento no sistema da CVM. */
  link: string | null;
};

// Nível 1 e 2 do plano de contas (3.01, 3.11...), mais o lucro atribuído aos
// controladores, que fica um nível abaixo e é o número que o mercado lê.
// Fora o 3.99, lucro por ação: não é valor em reais, e o arquivo aplica a
// escala MIL nele também — o LPA de R$ 0,42 do BB viraria R$ 420.
const ehContaDoResultado = (l: LinhaCsv) => {
  const codigo = l["CD_CONTA"] ?? "";
  if (codigo.startsWith("3.99")) return false;
  return (
    /^3\.\d{2}$/.test(codigo) ||
    (/^3\.\d{2}\.\d{2}$/.test(codigo) && /controladora/i.test(l["DS_CONTA"] ?? ""))
  );
};

const ehContaDoBalanco = (l: LinhaCsv) => /^[12](\.\d{2})?$/.test(l["CD_CONTA"] ?? "");

function emReais(l: LinhaCsv): Prisma.Decimal | null {
  const valor = decimalOuNull(l["VL_CONTA"]);
  if (!valor) return null;
  return l["ESCALA_MOEDA"] === "MIL" ? valor.mul(1000) : valor;
}

/** Junta as linhas ÚLTIMO e PENÚLTIMO de cada conta, na ordem do plano de contas. */
function pareadas(
  linhas: LinhaCsv[],
  ehAtual: (l: LinhaCsv) => boolean,
  ehAnterior: (l: LinhaCsv) => boolean,
): ContaCvm[] {
  const contas = new Map<string, ContaCvm>();
  for (const l of linhas) {
    const codigo = l["CD_CONTA"] ?? "";
    const atual = ehAtual(l);
    if (!atual && !ehAnterior(l)) continue;
    const conta = contas.get(codigo) ?? { codigo, conta: l["DS_CONTA"] ?? codigo, atual: null, anterior: null };
    if (atual) conta.atual = emReais(l);
    else conta.anterior = emReais(l);
    contas.set(codigo, conta);
  }
  // Conta zerada nos dois períodos é linha do plano padrão que a companhia
  // não usa (a holding BB Seguridade tem "Receitas das Atividades
  // Seguradoras" = 0). Só polui o que a IA lê.
  const temValor = (d: Prisma.Decimal | null) => d !== null && !d.isZero();
  return [...contas.values()]
    .filter((c) => temValor(c.atual) || temValor(c.anterior))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "en", { numeric: true }));
}

/**
 * Monta os dados de uma companhia a partir dos CSVs do zip. Pura: recebe o
 * conteúdo dos arquivos, o que permite testá-la sem baixar nada.
 *
 * `csvs` traz o índice (itr_cia_aberta_AAAA.csv) e os arquivos DRE, BPA e BPP
 * do mesmo tipo — consolidado ou individual.
 */
export function montarDadosAcao(
  csvs: { indice: string; dre: string; bpa: string; bpp: string },
  cnpj: string,
  periodo: Trimestre,
  consolidado: boolean,
): DadosAcao | null {
  const documento = periodo.trimestre === 4 ? "DFP" : "ITR";
  const mesFinal = periodo.trimestre * 3;
  const dataReferencia = `${periodo.ano}-${doisDigitos(mesFinal)}-${mesFinal === 3 || mesFinal === 12 ? 31 : 30}`;

  const entregas = linhasComCnpj(csvs.indice, cnpj).filter((l) => l["DT_REFER"] === dataReferencia);
  if (entregas.length === 0) return null;
  const [entrega] = ultimaVersao(entregas, "VERSAO");
  const versao = entrega?.["VERSAO"];

  const doDocumento = (csv: string) =>
    linhasComCnpj(csv, cnpj).filter((l) => l["DT_REFER"] === dataReferencia && l["VERSAO"] === versao);

  // Trimestre isolado no ITR (o arquivo também traz o acumulado do ano);
  // exercício inteiro no DFP.
  const mesInicial = documento === "DFP" ? 1 : mesFinal - 2;
  const inicio = (ano: number) => `${ano}-${doisDigitos(mesInicial)}-01`;
  const resultado = pareadas(
    doDocumento(csvs.dre).filter(ehContaDoResultado),
    (l) => l["ORDEM_EXERC"] === "ÚLTIMO" && l["DT_INI_EXERC"] === inicio(periodo.ano),
    (l) => l["ORDEM_EXERC"] === "PENÚLTIMO" && l["DT_INI_EXERC"] === inicio(periodo.ano - 1),
  );

  const balanco = pareadas(
    [...doDocumento(csvs.bpa), ...doDocumento(csvs.bpp)].filter(ehContaDoBalanco),
    (l) => l["ORDEM_EXERC"] === "ÚLTIMO",
    (l) => l["ORDEM_EXERC"] === "PENÚLTIMO",
  );

  if (resultado.length === 0 && balanco.length === 0) return null;

  return {
    tipo: "ACAO",
    denominacao: entrega?.["DENOM_CIA"] ?? cnpj,
    documento,
    dataReferencia,
    consolidado,
    resultado,
    balanco,
    link: entrega?.["LINK_DOC"] || null,
  };
}

/** ITR ou DFP de uma companhia no trimestre. Null se a CVM não tem o documento. */
export async function buscarDadosAcao(cnpj: string, periodo: Trimestre): Promise<DadosAcao | null> {
  const documento = periodo.trimestre === 4 ? "dfp" : "itr";
  const prefixo = `${documento}_cia_aberta`;
  const zip = await baixarZipCvm(
    `CIA_ABERTA/DOC/${documento.toUpperCase()}/DADOS/${prefixo}_${periodo.ano}.zip`,
  );
  if (!zip) return null;

  try {
    // Consolidado primeiro: é o que o release da empresa comenta. Companhia
    // sem controladas só entrega o individual.
    for (const sufixo of ["con", "ind"] as const) {
      const nomes = {
        indice: `${prefixo}_${periodo.ano}.csv`,
        dre: `${prefixo}_DRE_${sufixo}_${periodo.ano}.csv`,
        bpa: `${prefixo}_BPA_${sufixo}_${periodo.ano}.csv`,
        bpp: `${prefixo}_BPP_${sufixo}_${periodo.ano}.csv`,
      };
      const csvs = lerCsvsDoZip(zip, Object.values(nomes));
      const dados = montarDadosAcao(
        {
          indice: csvs.get(nomes.indice) ?? "",
          dre: csvs.get(nomes.dre) ?? "",
          bpa: csvs.get(nomes.bpa) ?? "",
          bpp: csvs.get(nomes.bpp) ?? "",
        },
        cnpj,
        periodo,
        sufixo === "con",
      );
      if (dados && dados.resultado.length > 0) return dados;
    }
    return null;
  } catch (err) {
    console.error("[CVM] falha ao ler ITR/DFP:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fundos imobiliários: Informe Mensal Estruturado
// ---------------------------------------------------------------------------

export type InformeFii = {
  valorAtivo: Prisma.Decimal | null;
  patrimonioLiquido: Prisma.Decimal | null;
  cotasEmitidas: Prisma.Decimal | null;
  valorPatrimonialCota: Prisma.Decimal | null;
  cotistas: Prisma.Decimal | null;
  /** Frações, como a CVM publica: 0.0043 = 0,43%. */
  dividendYieldMes: Prisma.Decimal | null;
  rentabilidadeEfetivaMes: Prisma.Decimal | null;
  rentabilidadePatrimonialMes: Prisma.Decimal | null;
  taxaAdministracaoMes: Prisma.Decimal | null;
  amortizacaoMes: Prisma.Decimal | null;
  rendimentosADistribuir: Prisma.Decimal | null;
  totalInvestido: Prisma.Decimal | null;
  imoveisParaRenda: Prisma.Decimal | null;
  cri: Prisma.Decimal | null;
  cotasDeFii: Prisma.Decimal | null;
  disponibilidades: Prisma.Decimal | null;
  totalPassivo: Prisma.Decimal | null;
};

export type DadosFii = {
  tipo: "FII";
  nome: string;
  segmento: string | null;
  mandato: string | null;
  tipoGestao: string | null;
  /** Primeiro dia do mês de competência, como a CVM grava: 2026-03-01. */
  dataReferencia: string;
  mes: InformeFii;
  /** Mês anterior, quando está no mesmo arquivo anual. */
  mesAnterior: InformeFii | null;
};

function informeDoMes(
  complemento: LinhaCsv[],
  ativoPassivo: LinhaCsv[],
  data: string,
): InformeFii | null {
  const doMes = (linhas: LinhaCsv[]) => {
    const candidatas = linhas.filter((l) => l["Data_Referencia"] === data);
    return candidatas.length ? ultimaVersao(candidatas, "Versao")[0] : undefined;
  };
  const c = doMes(complemento);
  if (!c) return null;
  const a = doMes(ativoPassivo) ?? {};

  return {
    valorAtivo: decimalOuNull(c["Valor_Ativo"]),
    patrimonioLiquido: decimalOuNull(c["Patrimonio_Liquido"]),
    cotasEmitidas: decimalOuNull(c["Cotas_Emitidas"]),
    valorPatrimonialCota: decimalOuNull(c["Valor_Patrimonial_Cotas"]),
    cotistas: decimalOuNull(c["Total_Numero_Cotistas"]),
    dividendYieldMes: decimalOuNull(c["Percentual_Dividend_Yield_Mes"]),
    rentabilidadeEfetivaMes: decimalOuNull(c["Percentual_Rentabilidade_Efetiva_Mes"]),
    rentabilidadePatrimonialMes: decimalOuNull(c["Percentual_Rentabilidade_Patrimonial_Mes"]),
    taxaAdministracaoMes: decimalOuNull(c["Percentual_Despesas_Taxa_Administracao"]),
    amortizacaoMes: decimalOuNull(c["Percentual_Amortizacao_Cotas_Mes"]),
    rendimentosADistribuir: decimalOuNull(a["Rendimentos_Distribuir"]),
    totalInvestido: decimalOuNull(a["Total_Investido"]),
    imoveisParaRenda: decimalOuNull(a["Imoveis_Renda_Acabados"]),
    cri: decimalOuNull(a["CRI"]),
    cotasDeFii: decimalOuNull(a["FII"]),
    disponibilidades: decimalOuNull(a["Disponibilidades"]),
    totalPassivo: decimalOuNull(a["Total_Passivo"]),
  };
}

/** Monta os dados do fundo a partir dos CSVs do Informe Mensal. Pura, como montarDadosAcao. */
export function montarDadosFii(
  csvs: { geral: string; complemento: string; ativoPassivo: string },
  cnpj: string,
  periodo: Mes,
): DadosFii | null {
  const data = `${periodo.ano}-${doisDigitos(periodo.mes)}-01`;
  const complemento = linhasComCnpj(csvs.complemento, cnpj);
  const ativoPassivo = linhasComCnpj(csvs.ativoPassivo, cnpj);

  const mes = informeDoMes(complemento, ativoPassivo, data);
  if (!mes) return null;

  const anterior =
    periodo.mes > 1
      ? informeDoMes(complemento, ativoPassivo, `${periodo.ano}-${doisDigitos(periodo.mes - 1)}-01`)
      : null;

  const geral = linhasComCnpj(csvs.geral, cnpj).filter((l) => l["Data_Referencia"] === data);
  const g = geral.length ? ultimaVersao(geral, "Versao")[0] : undefined;

  return {
    tipo: "FII",
    nome: g?.["Nome_Fundo_Classe"] || cnpj,
    segmento: g?.["Segmento_Atuacao"] || null,
    mandato: g?.["Mandato"] || null,
    tipoGestao: g?.["Tipo_Gestao"] || null,
    dataReferencia: data,
    mes,
    mesAnterior: anterior,
  };
}

/** Informe Mensal de um FII. Null se a CVM ainda não tem o mês. */
export async function buscarDadosFii(cnpj: string, periodo: Mes): Promise<DadosFii | null> {
  const zip = await baixarZipCvm(`FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${periodo.ano}.zip`);
  if (!zip) return null;

  try {
    const nomes = {
      geral: `inf_mensal_fii_geral_${periodo.ano}.csv`,
      complemento: `inf_mensal_fii_complemento_${periodo.ano}.csv`,
      ativoPassivo: `inf_mensal_fii_ativo_passivo_${periodo.ano}.csv`,
    };
    const csvs = lerCsvsDoZip(zip, Object.values(nomes));
    return montarDadosFii(
      {
        geral: csvs.get(nomes.geral) ?? "",
        complemento: csvs.get(nomes.complemento) ?? "",
        ativoPassivo: csvs.get(nomes.ativoPassivo) ?? "",
      },
      cnpj,
      periodo,
    );
  } catch (err) {
    console.error("[CVM] falha ao ler Informe Mensal de FII:", err instanceof Error ? err.message : err);
    return null;
  }
}
