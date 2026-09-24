import { describe, expect, it } from "vitest";
import { linhasComCnpj, montarDadosAcao, montarDadosFii } from "./cvm.provider.js";

// Fixtures no formato real dos CSVs da CVM (cabeçalho, separador ";",
// ÚLTIMO/PENÚLTIMO, escala MIL), reduzidas às linhas que importam.
const CNPJ = "00.000.000/0001-91";
const OUTRO = "11.111.111/0001-11";

const INDICE = [
  "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC",
  `${CNPJ};2026-03-31;1;BCO TESTE S.A.;001023;ITR;1;2026-05-10;http://rad/antigo`,
  `${CNPJ};2026-03-31;2;BCO TESTE S.A.;001023;ITR;2;2026-05-13;http://rad/corrigido`,
  `${OUTRO};2026-03-31;1;OUTRA S.A.;009999;ITR;3;2026-05-13;http://rad/outra`,
].join("\r\n");

const CAB_DRE =
  "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA";
const dre = (versao: number, ordem: string, ini: string, fim: string, conta: string, nome: string, valor: string) =>
  `${CNPJ};2026-06-30;${versao};BCO TESTE S.A.;001023;DF Consolidado;REAL;MIL;${ordem};${ini};${fim};${conta};${nome};${valor};S`;

const DRE_2T = [
  CAB_DRE,
  // trimestre isolado
  dre(1, "ÚLTIMO", "2026-04-01", "2026-06-30", "3.01", "Receita de Venda de Bens e/ou Serviços", "1000"),
  dre(1, "PENÚLTIMO", "2025-04-01", "2025-06-30", "3.01", "Receita de Venda de Bens e/ou Serviços", "800"),
  dre(1, "ÚLTIMO", "2026-04-01", "2026-06-30", "3.11", "Lucro/Prejuízo Consolidado do Período", "150"),
  dre(1, "PENÚLTIMO", "2025-04-01", "2025-06-30", "3.11", "Lucro/Prejuízo Consolidado do Período", "100"),
  dre(1, "ÚLTIMO", "2026-04-01", "2026-06-30", "3.11.01", "Atribuído a Sócios da Empresa Controladora", "120"),
  dre(1, "ÚLTIMO", "2026-04-01", "2026-06-30", "3.99", "Lucro por Ação", "0.42"),
  // acumulado do semestre: não pode vazar para o trimestre
  dre(1, "ÚLTIMO", "2026-01-01", "2026-06-30", "3.01", "Receita de Venda de Bens e/ou Serviços", "1900"),
  // conta zerada nos dois períodos
  dre(1, "ÚLTIMO", "2026-04-01", "2026-06-30", "3.08", "Operações Descontinuadas", "0"),
  dre(1, "PENÚLTIMO", "2025-04-01", "2025-06-30", "3.08", "Operações Descontinuadas", "0"),
].join("\r\n");

const CAB_BP =
  "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA";
const bp = (ordem: string, fim: string, conta: string, nome: string, valor: string) =>
  `${CNPJ};2026-06-30;1;BCO TESTE S.A.;001023;DF Consolidado;REAL;MIL;${ordem};${fim};${conta};${nome};${valor};S`;

const BPA = [CAB_BP, bp("ÚLTIMO", "2026-06-30", "1", "Ativo Total", "5000"), bp("PENÚLTIMO", "2025-12-31", "1", "Ativo Total", "4000")].join("\n");
const BPP = [
  CAB_BP,
  bp("ÚLTIMO", "2026-06-30", "2.03", "Patrimônio Líquido Consolidado", "2000"),
  bp("PENÚLTIMO", "2025-12-31", "2.03", "Patrimônio Líquido Consolidado", "1800"),
  bp("ÚLTIMO", "2026-06-30", "2.03.01", "Capital Social Realizado", "900"),
].join("\n");

const INDICE_2T = INDICE.replaceAll("2026-03-31", "2026-06-30").replace(/;2;BCO/, ";1;BCO");

describe("linhasComCnpj", () => {
  it("devolve só as linhas da companhia, já com as colunas nomeadas", () => {
    const linhas = linhasComCnpj(INDICE, CNPJ);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]?.["DENOM_CIA"]).toBe("BCO TESTE S.A.");
    // sem o \r do fim de linha na última coluna
    expect(linhas[0]?.["LINK_DOC"]).toBe("http://rad/antigo");
  });

  it("CNPJ ausente devolve lista vazia", () => {
    expect(linhasComCnpj(INDICE, "99.999.999/0001-99")).toEqual([]);
  });
});

describe("montarDadosAcao", () => {
  const segundoTri = { tipo: "trimestre", ano: 2026, trimestre: 2 } as const;
  const dados = montarDadosAcao({ indice: INDICE_2T, dre: DRE_2T, bpa: BPA, bpp: BPP }, CNPJ, segundoTri, true);

  it("lê o trimestre isolado contra o mesmo trimestre do ano anterior, em reais", () => {
    const receita = dados?.resultado.find((c) => c.codigo === "3.01");
    expect(receita?.atual?.toString()).toBe("1000000"); // 1000 mil
    expect(receita?.anterior?.toString()).toBe("800000");
  });

  it("guarda o lucro dos controladores e descarta o lucro por ação e a conta zerada", () => {
    const codigos = dados?.resultado.map((c) => c.codigo);
    expect(codigos).toEqual(["3.01", "3.11", "3.11.01"]);
  });

  it("balanço: nível 1 e 2 contra o fim do exercício anterior", () => {
    expect(dados?.balanco.map((c) => [c.codigo, c.atual?.toString(), c.anterior?.toString()])).toEqual([
      ["1", "5000000", "4000000"],
      ["2.03", "2000000", "1800000"],
    ]);
  });

  it("identifica o documento", () => {
    expect(dados).toMatchObject({ documento: "ITR", dataReferencia: "2026-06-30", denominacao: "BCO TESTE S.A." });
  });

  it("usa a última versão entregue", () => {
    const primeiroTri = { tipo: "trimestre", ano: 2026, trimestre: 1 } as const;
    const dreV2 = [CAB_DRE, dre(2, "ÚLTIMO", "2026-01-01", "2026-03-31", "3.01", "Receita", "10").replace("2026-06-30;2", "2026-03-31;2")].join("\n");
    const d = montarDadosAcao({ indice: INDICE, dre: dreV2, bpa: CAB_BP, bpp: CAB_BP }, CNPJ, primeiroTri, true);
    expect(d?.link).toBe("http://rad/corrigido");
    expect(d?.resultado[0]?.atual?.toString()).toBe("10000");
  });

  it("CVM sem o documento do período devolve null", () => {
    const terceiroTri = { tipo: "trimestre", ano: 2026, trimestre: 3 } as const;
    expect(montarDadosAcao({ indice: INDICE_2T, dre: DRE_2T, bpa: BPA, bpp: BPP }, CNPJ, terceiroTri, true)).toBeNull();
  });

  it("4º trimestre é o exercício inteiro, no DFP", () => {
    const quartoTri = { tipo: "trimestre", ano: 2025, trimestre: 4 } as const;
    const indiceDfp = `CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC\n${CNPJ};2025-12-31;1;BCO TESTE S.A.;1;DFP;9;2026-03-01;`;
    const dreDfp = [
      CAB_DRE,
      `${CNPJ};2025-12-31;1;BCO TESTE S.A.;1;DF;REAL;UNIDADE;ÚLTIMO;2025-01-01;2025-12-31;3.01;Receita;500;S`,
      `${CNPJ};2025-12-31;1;BCO TESTE S.A.;1;DF;REAL;UNIDADE;PENÚLTIMO;2024-01-01;2024-12-31;3.01;Receita;400;S`,
    ].join("\n");
    const d = montarDadosAcao({ indice: indiceDfp, dre: dreDfp, bpa: CAB_BP, bpp: CAB_BP }, CNPJ, quartoTri, true);
    expect(d?.documento).toBe("DFP");
    expect(d?.link).toBeNull();
    // escala UNIDADE não multiplica
    expect(d?.resultado[0]?.atual?.toString()).toBe("500");
    expect(d?.resultado[0]?.anterior?.toString()).toBe("400");
  });
});

describe("montarDadosFii", () => {
  const FUNDO = "97.521.225/0001-25";
  const complemento = [
    "CNPJ_Fundo_Classe;Data_Referencia;Versao;Total_Numero_Cotistas;Valor_Ativo;Patrimonio_Liquido;Cotas_Emitidas;Valor_Patrimonial_Cotas;Percentual_Dividend_Yield_Mes",
    `${FUNDO};2026-04-01;1;1453148;4430000000;4320000000;460269531;9.38;0.011`,
    `${FUNDO};2026-05-01;1;1468513;4430000000;4310000000;460269531;9.37;0.0104`,
    `${FUNDO};2026-05-01;2;1468513;4430000000;4313692471;460269531;9.37;0.0105`,
  ].join("\r\n");
  const geral = [
    "Tipo_Fundo_Classe;CNPJ_Fundo_Classe;Data_Referencia;Versao;Nome_Fundo_Classe;Segmento_Atuacao;Mandato;Tipo_Gestao;CNPJ_Administrador",
    `Classe;${FUNDO};2026-05-01;2;FII MAXI RENDA;Títulos e Val. Mob.;Renda;Ativa;59281253000123`,
  ].join("\r\n");
  const ativoPassivo = ["CNPJ_Fundo_Classe;Data_Referencia;Versao;CRI;Rendimentos_Distribuir", `${FUNDO};2026-05-01;2;3000000000;43270000`].join("\r\n");

  it("lê o mês na última versão, com o mês anterior para comparação", () => {
    const d = montarDadosFii({ geral, complemento, ativoPassivo }, FUNDO, { tipo: "mes", ano: 2026, mes: 5 });
    expect(d?.nome).toBe("FII MAXI RENDA");
    expect(d?.mes.patrimonioLiquido?.toString()).toBe("4313692471");
    expect(d?.mes.dividendYieldMes?.toString()).toBe("0.0105");
    expect(d?.mes.cri?.toString()).toBe("3000000000");
    expect(d?.mesAnterior?.valorPatrimonialCota?.toString()).toBe("9.38");
  });

  it("janeiro não tem mês anterior no mesmo arquivo", () => {
    const jan = complemento.replaceAll("2026-05-01", "2026-01-01");
    const d = montarDadosFii({ geral: "", complemento: jan, ativoPassivo: "" }, FUNDO, { tipo: "mes", ano: 2026, mes: 1 });
    expect(d?.mesAnterior).toBeNull();
    expect(d?.nome).toBe(FUNDO);
  });

  it("mês que a CVM ainda não publicou devolve null", () => {
    expect(montarDadosFii({ geral, complemento, ativoPassivo }, FUNDO, { tipo: "mes", ano: 2026, mes: 6 })).toBeNull();
  });
});
