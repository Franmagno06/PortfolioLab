import { unzipSync, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buscarDadosAcao,
  buscarDadosFii,
  lerCsvsDoZip,
  limparCacheCvm,
  linhasComCnpj,
  montarDadosAcao,
  montarDadosFii,
} from "./cvm.provider.js";

/**
 * A leitura do zip decodifica só o cabeçalho e as linhas que mencionam o CNPJ (memória: o BPP do ITR
 * tem 38 MB). Estes testes provam que o que sai dela é o mesmo que saía quando o CSV inteiro virava
 * texto: o oráculo abaixo é a versão antiga de lerCsvsDoZip, copiada como estava.
 */
function lerCsvsDoZipAntigo(zip: Uint8Array, nomes: string[]): Map<string, string> {
  const arquivos = unzipSync(zip, { filter: (f) => nomes.includes(f.name) });
  const decodificador = new TextDecoder("latin1");
  return new Map(Object.entries(arquivos).map(([nome, bytes]) => [nome, decodificador.decode(bytes)]));
}

// Os arquivos da CVM são ISO-8859-1: um byte por caractere.
const latin1 = (texto: string) => new Uint8Array(Buffer.from(texto, "latin1"));

const CNPJ = "00.000.000/0001-91";
const OUTRO = "11.111.111/0001-11";
const SEM_MASCARA = "00000000000191";
const ADMIN = "22.222.222/0001-22";

const CAB = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CONTA;DS_CONTA;VL_CONTA;ESCALA_MOEDA;ORDEM_EXERC";

// Casos de borda num arquivo só: companhias intercaladas, acento em latin1, byte da faixa 0x80-0x9F,
// ";" entre aspas, o CNPJ duas vezes na mesma linha, o CNPJ sem máscara (que não deve casar com o
// mascarado), e o CNPJ só numa coluna que não é a da companhia.
const LINHAS = [
  `${CNPJ};2026-06-30;1;BCO TESTE S.A.;3.01;Receita de Intermediação;1000;MIL;ÚLTIMO`,
  `${OUTRO};2026-06-30;1;OUTRA S.A.;3.01;Receita;5;MIL;ÚLTIMO`,
  `${CNPJ};2026-06-30;1;BCO TESTE S.A.;3.11;"Lucro; Prejuízo";150;MIL;PENÚLTIMO`,
  `${OUTRO};2026-06-30;1;OUTRA S.A.;3.11;Menciona ${CNPJ} no texto;7;MIL;ÚLTIMO`,
  `${SEM_MASCARA};2026-06-30;1;SEM MÁSCARA;3.01;Receita;9;MIL;ÚLTIMO`,
  `${CNPJ};2026-06-30;2;BCO TESTE S.A.;2.03;Patrimônio ${CNPJ} \x96 Líquido;2000;MIL;ÚLTIMO`,
];

function csv(quebra: "\n" | "\r\n", { quebraNoFim }: { quebraNoFim: boolean }) {
  return [CAB, ...LINHAS].join(quebra) + (quebraNoFim ? quebra : "");
}

const ARQUIVOS: Record<string, string> = {
  "crlf.csv": csv("\r\n", { quebraNoFim: true }),
  "lf.csv": csv("\n", { quebraNoFim: false }),
  // a companhia na primeira e na última linha, sem quebra no fim
  "pontas.csv": [CAB, LINHAS[0], LINHAS[1], LINHAS[5]].join("\r\n"),
  "sem-a-companhia.csv": [CAB, LINHAS[1], LINHAS[4]].join("\r\n"),
  "so-cabecalho.csv": CAB + "\r\n",
  "sem-quebra.csv": CAB,
  "vazio.csv": "",
};
const NOMES = Object.keys(ARQUIVOS);
const ZIP = zipSync(Object.fromEntries(Object.entries(ARQUIVOS).map(([n, t]) => [n, latin1(t)])));

describe("lerCsvsDoZip com CNPJ", () => {
  it.each([CNPJ, OUTRO, SEM_MASCARA, "99.999.999/0001-99"])(
    "devolve, para %s, as mesmas linhas que a leitura do CSV inteiro",
    (cnpj) => {
      const antigo = lerCsvsDoZipAntigo(ZIP, NOMES);
      const novo = lerCsvsDoZip(ZIP, NOMES, cnpj);
      expect([...novo.keys()].sort()).toEqual([...antigo.keys()].sort());
      for (const nome of NOMES) {
        expect(linhasComCnpj(novo.get(nome) ?? "", cnpj), nome).toEqual(linhasComCnpj(antigo.get(nome) ?? "", cnpj));
      }
    },
  );

  it("as linhas casadas são as esperadas, com acento e \\r tratados", () => {
    const linhas = linhasComCnpj(lerCsvsDoZip(ZIP, ["crlf.csv"], CNPJ).get("crlf.csv") ?? "", CNPJ);
    expect(linhas.map((l) => l["CD_CONTA"])).toEqual(["3.01", "3.11", "2.03"]);
    expect(linhas[0]?.["ORDEM_EXERC"]).toBe("ÚLTIMO");
    expect(linhas[2]?.["ORDEM_EXERC"]).toBe("ÚLTIMO"); // sem o \r da última coluna
    expect(linhas[2]?.["DS_CONTA"]).toContain("Patrimônio");
  });

  it("não decodifica as linhas das outras companhias", () => {
    const texto = lerCsvsDoZip(ZIP, ["crlf.csv"], CNPJ).get("crlf.csv") ?? "";
    expect(texto.startsWith(CAB)).toBe(true);
    expect(texto).not.toContain("OUTRA S.A.;3.01");
    expect(texto).not.toContain("SEM MÁSCARA");
  });

  it("sem CNPJ, devolve o CSV inteiro, como antes", () => {
    expect(lerCsvsDoZip(ZIP, NOMES)).toEqual(lerCsvsDoZipAntigo(ZIP, NOMES));
  });

  it("CNPJ vazio não trava a leitura nem devolve linha", () => {
    const novo = lerCsvsDoZip(ZIP, ["crlf.csv"], "");
    expect(linhasComCnpj(novo.get("crlf.csv") ?? "", "")).toEqual([]);
  });

  it("arquivo que declara um tamanho descompactado absurdo é ignorado, sem alocar", () => {
    const zip = zipSync({ "grande.csv": latin1(ARQUIVOS["crlf.csv"]!), "pequeno.csv": latin1(ARQUIVOS["lf.csv"]!) });
    declararTamanho(zip, "grande.csv", 0xffff_fff0);
    const csvs = lerCsvsDoZip(zip, ["grande.csv", "pequeno.csv"], CNPJ);
    expect(csvs.has("grande.csv")).toBe(false);
    expect(csvs.has("pequeno.csv")).toBe(true);
  });
});

/** Reescreve o tamanho descompactado que o diretório central do zip declara para um arquivo. */
function declararTamanho(zip: Uint8Array, nome: string, tamanho: number) {
  const vista = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let i = 0; i + 46 <= zip.length; i++) {
    if (vista.getUint32(i, true) !== 0x02014b50) continue;
    const tamanhoDoNome = vista.getUint16(i + 28, true);
    const nomeAqui = Buffer.from(zip.subarray(i + 46, i + 46 + tamanhoDoNome)).toString("latin1");
    if (nomeAqui === nome) vista.setUint32(i + 24, tamanho, true);
  }
}

// ---------------------------------------------------------------------------
// De ponta a ponta: buscarDadosAcao e buscarDadosFii sobre um zip servido por um fetch de mentira,
// contra o oráculo (o CSV inteiro decodificado, passado a montarDadosAcao/montarDadosFii).
// ---------------------------------------------------------------------------

const CAB_IND = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC";
const CAB_DRE =
  "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA";
const CAB_BP =
  "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA";

function itrDe(cnpj: string, nome: string, base: number) {
  const dre = (ordem: string, ini: string, conta: string, ds: string, v: number) =>
    `${cnpj};2026-06-30;1;${nome};001;DF Consolidado;REAL;MIL;${ordem};${ini};${ordem === "ÚLTIMO" ? "2026" : "2025"}-06-30;${conta};${ds};${v};S`;
  const bp = (ordem: string, fim: string, conta: string, ds: string, v: number) =>
    `${cnpj};2026-06-30;1;${nome};001;DF Consolidado;REAL;MIL;${ordem};${fim};${conta};${ds};${v};S`;
  return {
    indice: `${cnpj};2026-06-30;1;${nome};001;ITR;1;2026-08-10;http://rad/${base}`,
    dre: [
      dre("ÚLTIMO", "2026-04-01", "3.01", "Receita", base),
      dre("PENÚLTIMO", "2025-04-01", "3.01", "Receita", base - 1),
      dre("ÚLTIMO", "2026-04-01", "3.11", "Lucro/Prejuízo Consolidado do Período", base / 10),
      dre("ÚLTIMO", "2026-04-01", "3.11.01", "Atribuído a Sócios da Empresa Controladora", base / 20),
      dre("ÚLTIMO", "2026-01-01", "3.01", "Receita", base * 2),
    ],
    bpa: [bp("ÚLTIMO", "2026-06-30", "1", "Ativo Total", base * 9), bp("PENÚLTIMO", "2025-12-31", "1", "Ativo Total", base * 8)],
    bpp: [bp("ÚLTIMO", "2026-06-30", "2.03", "Patrimônio Líquido Consolidado", base * 3)],
  };
}

function zipDoItr() {
  const cias = [itrDe(OUTRO, "OUTRA S.A.", 500), itrDe(CNPJ, "BCO TESTE S.A.", 1000), itrDe(ADMIN, "TERCEIRA S.A.", 70)];
  const junta = (cab: string, chave: "dre" | "bpa" | "bpp") => [cab, ...cias.flatMap((c) => c[chave])].join("\r\n") + "\r\n";
  return zipSync({
    "itr_cia_aberta_2026.csv": latin1([CAB_IND, ...cias.map((c) => c.indice)].join("\r\n") + "\r\n"),
    "itr_cia_aberta_DRE_con_2026.csv": latin1(junta(CAB_DRE, "dre")),
    "itr_cia_aberta_BPA_con_2026.csv": latin1(junta(CAB_BP, "bpa")),
    "itr_cia_aberta_BPP_con_2026.csv": latin1(junta(CAB_BP, "bpp")),
  });
}

const CAB_GERAL = "CNPJ_Fundo_Classe;Data_Referencia;Versao;Nome_Fundo_Classe;Segmento_Atuacao;Mandato;Tipo_Gestao;CNPJ_Administrador";
const CAB_COMPL =
  "CNPJ_Fundo_Classe;Data_Referencia;Versao;Valor_Ativo;Patrimonio_Liquido;Cotas_Emitidas;Valor_Patrimonial_Cotas;Total_Numero_Cotistas;Percentual_Dividend_Yield_Mes";
const CAB_AP = "CNPJ_Fundo_Classe;Data_Referencia;Versao;Total_Investido;CRI_CRA;CRI;Disponibilidades";

function zipDoFii() {
  const geral = [
    CAB_GERAL,
    `${OUTRO};2026-09-01;1;FII ADMINISTRADO;Logística;Renda;Ativa;${CNPJ}`, // o CNPJ buscado como administrador
    `${CNPJ};2026-09-01;1;FII TESTE;Papel;Títulos e Valores Mobiliários;Ativa;${ADMIN}`,
  ];
  const compl = [
    CAB_COMPL,
    `${CNPJ};2026-08-01;1;100;90;10;9.0;5000;0.0090`,
    `${OUTRO};2026-09-01;1;1;1;1;1;1;0.1`,
    `${CNPJ};2026-09-01;1;110;95;10;9.5;5100;0.0100`,
    `${CNPJ};2026-09-01;2;111;96;10;9.6;5101;0.0101`,
  ];
  const ap = [CAB_AP, `${CNPJ};2026-09-01;2;80;70;;5`, `${OUTRO};2026-09-01;1;1;1;;1`];
  return zipSync({
    "inf_mensal_fii_geral_2026.csv": latin1(geral.join("\r\n")),
    "inf_mensal_fii_complemento_2026.csv": latin1(compl.join("\r\n")),
    "inf_mensal_fii_ativo_passivo_2026.csv": latin1(ap.join("\r\n")),
  });
}

function servir(zip: Uint8Array) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(zip)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  limparCacheCvm();
});

describe("buscarDadosAcao e buscarDadosFii depois da leitura enxuta", () => {
  it("o ITR sai igual ao montado a partir do CSV inteiro", async () => {
    const zip = zipDoItr();
    servir(zip);
    const periodo = { tipo: "trimestre", ano: 2026, trimestre: 2 } as const;
    const novo = await buscarDadosAcao(CNPJ, periodo);

    const p = "itr_cia_aberta";
    const csvs = lerCsvsDoZipAntigo(zip, [
      `${p}_2026.csv`, `${p}_DRE_con_2026.csv`, `${p}_BPA_con_2026.csv`, `${p}_BPP_con_2026.csv`,
    ]);
    const oraculo = montarDadosAcao(
      {
        indice: csvs.get(`${p}_2026.csv`) ?? "",
        dre: csvs.get(`${p}_DRE_con_2026.csv`) ?? "",
        bpa: csvs.get(`${p}_BPA_con_2026.csv`) ?? "",
        bpp: csvs.get(`${p}_BPP_con_2026.csv`) ?? "",
      },
      CNPJ,
      periodo,
      true,
    );
    expect(novo).not.toBeNull();
    expect(novo).toEqual(oraculo);
    expect(novo?.resultado.find((c) => c.codigo === "3.01")?.atual?.toString()).toBe("1000000");
  });

  it("o Informe Mensal de FII sai igual ao montado a partir do CSV inteiro", async () => {
    const zip = zipDoFii();
    servir(zip);
    const periodo = { tipo: "mes", ano: 2026, mes: 9 } as const;
    const novo = await buscarDadosFii(CNPJ, periodo);

    const n = (s: string) => `inf_mensal_fii_${s}_2026.csv`;
    const csvs = lerCsvsDoZipAntigo(zip, [n("geral"), n("complemento"), n("ativo_passivo")]);
    const oraculo = montarDadosFii(
      {
        geral: csvs.get(n("geral")) ?? "",
        complemento: csvs.get(n("complemento")) ?? "",
        ativoPassivo: csvs.get(n("ativo_passivo")) ?? "",
      },
      CNPJ,
      periodo,
    );
    expect(novo).not.toBeNull();
    expect(novo).toEqual(oraculo);
    expect(novo?.nome).toBe("FII TESTE");
    expect(novo?.mes.patrimonioLiquido?.toString()).toBe("96");
  });
});
