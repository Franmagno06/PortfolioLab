import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { montarDadosFii, type ContaCvm, type DadosAcao, type InformeFii } from "../reports/cvm.provider.js";
import {
  calcularComposicao,
  mesesConcluidos,
  montarInformeDoFii,
  resultadoDoTrimestre,
  taxaAdministracaoAnual,
  trimestresConcluidos,
} from "./ativos.composicao.js";

const D = (v: string | number) => new Prisma.Decimal(v);

function informe(sobrescrever: Partial<InformeFii>): InformeFii {
  return {
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
    ...sobrescrever,
  };
}

describe("calcularComposicao", () => {
  it("MXRF11 em ago/2026: 70% em CRI, 12% em cotas de FII, e as fatias somam 100", () => {
    // números do informe real: R$ 3,77 bi em CRI_CRA, R$ 656 mi em FII, R$ 421 mi em liquidez
    const c = calcularComposicao(
      informe({
        valorAtivo: D(5_370_000_000),
        imoveisTotal: D(507_727_376),
        papelTotal: D(3_768_715_784),
        cotasDeFii: D(656_273_058),
        liquidezTotal: D(421_370_633),
      }),
    );

    expect(c).toEqual({ imoveis: 9.5, papel: 70.2, cotasDeFii: 12.2, liquidez: 7.8, outros: 0.3 });
    const soma = Object.values(c ?? {}).reduce((s, v) => s + v, 0);
    expect(soma).toBeCloseTo(100, 0);
  });

  it("fundo de tijolo: quase tudo em imóveis", () => {
    const c = calcularComposicao(
      informe({ valorAtivo: D(1000), imoveisTotal: D(900), cotasDeFii: D(20), liquidezTotal: D(80) }),
    );

    expect(c).toMatchObject({ imoveis: 90, papel: 0, cotasDeFii: 2, liquidez: 8, outros: 0 });
  });

  it("partes que somam mais que o ativo total (dado inconsistente): nenhuma fatia passa de 100", () => {
    const c = calcularComposicao(
      informe({ valorAtivo: D(1000), imoveisTotal: D(900), liquidezTotal: D(300) }),
    );

    expect(c?.imoveis).toBe(75);
    expect(c?.liquidez).toBe(25);
    expect(c?.outros).toBe(0);
  });

  it("sem o ativo total, a base é a soma das partes", () => {
    const c = calcularComposicao(informe({ imoveisTotal: D(30), papelTotal: D(70) }));

    expect(c).toMatchObject({ imoveis: 30, papel: 70, outros: 0 });
  });

  it("sem nenhuma parte e sem ativo total: null, em vez de dividir por zero", () => {
    expect(calcularComposicao(informe({}))).toBeNull();
  });

  it("sem liquidezTotal, usa as disponibilidades", () => {
    const c = calcularComposicao(informe({ valorAtivo: D(100), imoveisTotal: D(90), disponibilidades: D(10) }));

    expect(c?.liquidez).toBe(10);
  });
});

describe("montarInformeDoFii, do CSV da CVM até a composição", () => {
  const FUNDO = "97.521.225/0001-25";
  const complemento = [
    "CNPJ_Fundo_Classe;Data_Referencia;Versao;Total_Numero_Cotistas;Valor_Ativo;Patrimonio_Liquido;Cotas_Emitidas;Valor_Patrimonial_Cotas;Percentual_Despesas_Taxa_Administracao",
    `${FUNDO};2026-08-01;1;1529305;5370000000;5250000000;560000000;9.37;0.00075`,
  ].join("\r\n");
  const geral = [
    "Tipo_Fundo_Classe;CNPJ_Fundo_Classe;Data_Referencia;Versao;Nome_Fundo_Classe;Segmento_Atuacao;Mandato;Tipo_Gestao",
    `Classe;${FUNDO};2026-08-01;1;FII MAXI RENDA RL;Logística;;Ativa`,
  ].join("\r\n");
  // layout atual: CRI vazio, CRI_CRA preenchido; LCI e LCI_LCA convivem sem se somar
  const ativoPassivo = [
    "CNPJ_Fundo_Classe;Data_Referencia;Versao;Total_Necessidades_Liquidez;Imoveis_Venda_Acabados;Acoes_Sociedades_Atividades_FII;FII;CRI;CRI_CRA;LCI;LCI_LCA",
    `${FUNDO};2026-08-01;1;421370633;156155270;351572106;656273058;;3768715784;100;100`,
  ].join("\r\n");

  it("lê CRI_CRA, soma imóveis com sociedades e não soma LCI duas vezes", () => {
    const dados = montarDadosFii({ geral, complemento, ativoPassivo }, FUNDO, { tipo: "mes", ano: 2026, mes: 8 });
    expect(dados).not.toBeNull();

    const info = montarInformeDoFii(dados!);

    expect(info.competencia).toBe("2026-08");
    expect(info.patrimonioLiquido).toBe(5_250_000_000);
    expect(info.cotistas).toBe(1_529_305);
    expect(info.valorPatrimonialCota).toBe(9.37);
    expect(info.tipoGestao).toBe("Ativa");
    expect(info.composicao?.papel).toBeCloseTo(70.2, 1);
    expect(info.composicao?.imoveis).toBeCloseTo(9.5, 1);
    expect(info.composicao?.cotasDeFii).toBeCloseTo(12.2, 1);
    // 100 de LCI contados uma vez só: não mexe na fatia de papel
    expect(dados?.mes.papelTotal?.toString()).toBe("3768715884");
  });
});

describe("taxaAdministracaoAnual", () => {
  it("anualiza a taxa do mês: 0,075% ao mês é 0,9% ao ano", () => {
    expect(taxaAdministracaoAnual(0.00075)).toBe(0.9);
  });

  it("sem taxa informada, ou negativa, é null", () => {
    expect(taxaAdministracaoAnual(null)).toBeNull();
    expect(taxaAdministracaoAnual(-0.001)).toBeNull();
  });
});

describe("mesesConcluidos", () => {
  it("em 12/out/2026 o primeiro mês a tentar é setembro, depois agosto", () => {
    expect(mesesConcluidos(new Date("2026-10-12T12:00:00Z"), 3)).toEqual([
      { ano: 2026, mes: 9 },
      { ano: 2026, mes: 8 },
      { ano: 2026, mes: 7 },
    ]);
  });

  it("em janeiro, volta para dezembro do ano anterior", () => {
    expect(mesesConcluidos(new Date("2026-01-10T12:00:00Z"), 3)).toEqual([
      { ano: 2025, mes: 12 },
      { ano: 2025, mes: 11 },
      { ano: 2025, mes: 10 },
    ]);
  });
});

describe("trimestresConcluidos", () => {
  it("em 12/out/2026 o último concluído é o 3T26, seguido do 2T, 1T e do 4T de 2025", () => {
    expect(trimestresConcluidos(new Date("2026-10-12T12:00:00Z"), 4)).toEqual([
      { ano: 2026, trimestre: 3 },
      { ano: 2026, trimestre: 2 },
      { ano: 2026, trimestre: 1 },
      { ano: 2025, trimestre: 4 },
    ]);
  });

  it("em janeiro, o último concluído é o 4T do ano anterior", () => {
    expect(trimestresConcluidos(new Date("2026-01-15T12:00:00Z"), 2)).toEqual([
      { ano: 2025, trimestre: 4 },
      { ano: 2025, trimestre: 3 },
    ]);
  });
});

describe("resultadoDoTrimestre", () => {
  const conta = (codigo: string, nome: string, atual: number): ContaCvm => ({
    codigo,
    conta: nome,
    atual: D(atual),
    anterior: null,
  });

  function documento(tipo: "ITR" | "DFP", dataReferencia: string, lucroControladores: number, patrimonio: number): DadosAcao {
    return {
      tipo: "ACAO",
      denominacao: "Empresa S.A.",
      documento: tipo,
      dataReferencia,
      consolidado: true,
      resultado: [
        conta("3.11", "Lucro/Prejuízo Consolidado do Período", lucroControladores + 500_000_000),
        conta("3.11.01", "Atribuído a Sócios da Empresa Controladora", lucroControladores),
      ],
      balanco: [conta("2.03", "Patrimônio Líquido Consolidado", patrimonio)],
      link: null,
    };
  }

  it("1º ao 3º trimestre: o ITR já traz o trimestre isolado, e vale o lucro dos controladores", () => {
    const r = resultadoDoTrimestre(
      { ano: 2026, trimestre: 2 },
      documento("ITR", "2026-06-30", 7_400_000_000, 190_000_000_000),
    );

    expect(r).toEqual({
      periodo: "2T26",
      dataReferencia: "2026-06-30",
      lucroLiquido: 7_400_000_000,
      patrimonioLiquido: 190_000_000_000,
    });
  });

  it("4º trimestre: a DFP é o ano inteiro, então o trimestre é o ano menos os três primeiros", () => {
    const r = resultadoDoTrimestre(
      { ano: 2025, trimestre: 4 },
      documento("DFP", "2025-12-31", 30_000_000_000, 195_000_000_000),
      {
        1: documento("ITR", "2025-03-31", 6_000_000_000, 1),
        2: documento("ITR", "2025-06-30", 7_000_000_000, 1),
        3: documento("ITR", "2025-09-30", 8_000_000_000, 1),
      },
    );

    expect(r?.periodo).toBe("4T25");
    expect(r?.lucroLiquido).toBe(9_000_000_000);
    // o patrimônio é o do fim do ano, direto do balanço da DFP
    expect(r?.patrimonioLiquido).toBe(195_000_000_000);
  });

  it("4º trimestre sem um dos três ITRs: null, e nunca o ano inteiro como se fosse um trimestre", () => {
    const r = resultadoDoTrimestre(
      { ano: 2025, trimestre: 4 },
      documento("DFP", "2025-12-31", 30_000_000_000, 195_000_000_000),
      {
        1: documento("ITR", "2025-03-31", 6_000_000_000, 1),
        3: documento("ITR", "2025-09-30", 8_000_000_000, 1),
      },
    );

    expect(r).toBeNull();
  });

  it("4º trimestre com um ITR em base diferente (individual contra consolidado): null, e não uma subtração sem sentido", () => {
    const dfp = documento("DFP", "2025-12-31", 30_000_000_000, 195_000_000_000);
    const itrIndividual = { ...documento("ITR", "2025-06-30", 7_000_000_000, 1), consolidado: false };

    const r = resultadoDoTrimestre({ ano: 2025, trimestre: 4 }, dfp, {
      1: documento("ITR", "2025-03-31", 6_000_000_000, 1),
      2: itrIndividual,
      3: documento("ITR", "2025-09-30", 8_000_000_000, 1),
    });

    expect(r).toBeNull();
  });

  it("4º trimestre com os quatro documentos individuais: calcula normalmente (empresa sem controladas)", () => {
    const individual = (d: DadosAcao): DadosAcao => ({ ...d, consolidado: false });

    const r = resultadoDoTrimestre(
      { ano: 2025, trimestre: 4 },
      individual(documento("DFP", "2025-12-31", 30_000_000_000, 195_000_000_000)),
      {
        1: individual(documento("ITR", "2025-03-31", 6_000_000_000, 1)),
        2: individual(documento("ITR", "2025-06-30", 7_000_000_000, 1)),
        3: individual(documento("ITR", "2025-09-30", 8_000_000_000, 1)),
      },
    );

    expect(r?.lucroLiquido).toBe(9_000_000_000);
  });

  it("sem patrimônio no balanço, ou sem lucro na DRE: null", () => {
    const semPatrimonio = { ...documento("ITR", "2026-03-31", 1, 1), balanco: [] };
    const semLucro = { ...documento("ITR", "2026-03-31", 1, 1), resultado: [] };

    expect(resultadoDoTrimestre({ ano: 2026, trimestre: 1 }, semPatrimonio)).toBeNull();
    expect(resultadoDoTrimestre({ ano: 2026, trimestre: 1 }, semLucro)).toBeNull();
  });

  it("prejuízo é lucro negativo, e o 4T pode sair negativo mesmo com o ano positivo", () => {
    const r = resultadoDoTrimestre(
      { ano: 2025, trimestre: 4 },
      documento("DFP", "2025-12-31", 10_000_000_000, 100),
      {
        1: documento("ITR", "2025-03-31", 4_000_000_000, 1),
        2: documento("ITR", "2025-06-30", 4_000_000_000, 1),
        3: documento("ITR", "2025-09-30", 4_000_000_000, 1),
      },
    );

    expect(r?.lucroLiquido).toBe(-2_000_000_000);
  });
});
