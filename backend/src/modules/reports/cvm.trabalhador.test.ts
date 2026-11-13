import { zipSync } from "fflate";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  definirPrazoDaLeituraCvm,
  emMemoriaCompartilhada,
  encerrarTrabalhadorCvm,
  lerCsvsNoTrabalhador,
  patrimonioNoTrabalhador,
} from "./cvm.trabalhador.js";
import { lerCsvsDoZip, patrimonioDasClasses } from "./cvm.zip.js";

// A leitura da CVM roda num worker_thread (cvm.trabalhador.ts). Estes testes provam que ela devolve o
// mesmo que a leitura no próprio thread, que o laço de eventos segue livre enquanto o worker trabalha,
// e que falha, morte do worker e prazo vencido viram null sem travar as tarefas seguintes.

const latin1 = (texto: string) => new Uint8Array(Buffer.from(texto, "latin1"));
const CNPJ = "00.000.000/0001-91";
const OUTRO = "11.111.111/0001-11";
const CAB = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CONTA;DS_CONTA;VL_CONTA";

const PEQUENO = zipSync({
  "dre.csv": latin1(
    [
      CAB,
      `${CNPJ};2026-06-30;1;BCO;3.01;Receita de Intermediação;1000`,
      `${OUTRO};2026-06-30;1;OUTRA;3.01;Receita;5`,
      `${CNPJ};2026-06-30;2;BCO;3.11;"Lucro; Prejuízo \x96";150`,
    ].join("\r\n"),
  ),
  "vazio.csv": new Uint8Array(),
  "registro_classe.csv": latin1(
    [
      "CNPJ_Classe;Denominacao;Patrimonio_Liquido;Data_Patrimonio_Liquido",
      `${CNPJ};FUNDO Á;1234.56;2026-10-31`,
      `${OUTRO};OUTRO;99;2026-10-31`,
    ].join("\n"),
  ),
});

/** Um CSV grande (uns 35 MB descompactado), para a leitura levar tempo de verdade. */
function zipGrande(): Uint8Array {
  const linhas = [CAB];
  for (let i = 0; i < 400_000; i++) {
    linhas.push(`${i % 97 === 0 ? CNPJ : OUTRO};2026-06-30;1;COMPANHIA ${i};3.${i % 50};Conta número ${i};${i * 7}`);
  }
  return zipSync({ "grande.csv": latin1(linhas.join("\r\n")) }, { level: 1 });
}
let grande: Uint8Array | null = null;
const GRANDE = () => (grande ??= emMemoriaCompartilhada(zipGrande()));

/** Quantas vezes um intervalo de 5 ms rodou enquanto `tarefa` corria. */
async function batidasDuranteAsync(tarefa: () => Promise<unknown>): Promise<number> {
  let batidas = 0;
  const relogio = setInterval(() => batidas++, 5);
  try {
    await tarefa();
  } finally {
    clearInterval(relogio);
  }
  return batidas;
}

afterEach(() => {
  definirPrazoDaLeituraCvm(null);
});

afterAll(async () => {
  await encerrarTrabalhadorCvm();
});

describe("leitura da CVM no worker", () => {
  it("devolve o mesmo que a leitura no próprio thread, com e sem CNPJ", async () => {
    const nomes = ["dre.csv", "vazio.csv", "nao-existe.csv"];

    expect(await lerCsvsNoTrabalhador(PEQUENO, nomes, CNPJ)).toEqual(lerCsvsDoZip(PEQUENO, nomes, CNPJ));
    expect(await lerCsvsNoTrabalhador(PEQUENO, nomes)).toEqual(lerCsvsDoZip(PEQUENO, nomes));
  });

  it("o zip em memória compartilhada dá o mesmo resultado", async () => {
    const compartilhado = emMemoriaCompartilhada(PEQUENO);

    expect(compartilhado.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(await lerCsvsNoTrabalhador(compartilhado, ["dre.csv"], CNPJ)).toEqual(lerCsvsDoZip(PEQUENO, ["dre.csv"], CNPJ));
  });

  it("o patrimônio das classes sai igual ao da função pura", async () => {
    const csv = lerCsvsDoZip(PEQUENO, ["registro_classe.csv"]).get("registro_classe.csv") ?? "";

    expect(await patrimonioNoTrabalhador(PEQUENO, [CNPJ])).toEqual(patrimonioDasClasses(csv, [CNPJ]));
    expect(await patrimonioNoTrabalhador(zipSync({ "outro.csv": latin1("x") }), [CNPJ])).toBeNull();
  });

  it("o zip grande sai igual no worker e no thread", async () => {
    expect(await lerCsvsNoTrabalhador(GRANDE(), ["grande.csv"], CNPJ)).toEqual(lerCsvsDoZip(GRANDE(), ["grande.csv"], CNPJ));
  });

  it("o laço de eventos continua rodando enquanto o worker lê; no thread, ele parava", async () => {
    const zip = GRANDE();
    await lerCsvsNoTrabalhador(zip, ["grande.csv"], CNPJ); // aquece o worker

    const noThread = await batidasDuranteAsync(async () => lerCsvsDoZip(zip, ["grande.csv"], CNPJ));
    const noWorker = await batidasDuranteAsync(() => lerCsvsNoTrabalhador(zip, ["grande.csv"], CNPJ));

    expect(noThread).toBe(0);
    expect(noWorker).toBeGreaterThanOrEqual(3);
  });

  it("zip corrompido vira null, e o worker segue atendendo", async () => {
    expect(await lerCsvsNoTrabalhador(new Uint8Array([80, 75, 3, 4, 1, 2, 3]), ["dre.csv"], CNPJ)).toBeNull();
    expect(await lerCsvsNoTrabalhador(PEQUENO, ["dre.csv"], CNPJ)).toEqual(lerCsvsDoZip(PEQUENO, ["dre.csv"], CNPJ));
  });

  it("worker que morre no meio da tarefa: ela vira null e o próximo é criado", async () => {
    const emCurso = lerCsvsNoTrabalhador(GRANDE(), ["grande.csv"], CNPJ);
    await new Promise((r) => setTimeout(r, 20));
    await encerrarTrabalhadorCvm();

    expect(await emCurso).toBeNull();
    expect(await lerCsvsNoTrabalhador(PEQUENO, ["dre.csv"], CNPJ)).toEqual(lerCsvsDoZip(PEQUENO, ["dre.csv"], CNPJ));
  });

  it("tarefa que passa do prazo vira null, o worker é encerrado e a seguinte funciona", async () => {
    definirPrazoDaLeituraCvm(1);
    expect(await lerCsvsNoTrabalhador(GRANDE(), ["grande.csv"], CNPJ)).toBeNull();

    definirPrazoDaLeituraCvm(null);
    expect(await lerCsvsNoTrabalhador(PEQUENO, ["dre.csv"], CNPJ)).toEqual(lerCsvsDoZip(PEQUENO, ["dre.csv"], CNPJ));
  });

  it("tarefas pedidas juntas saem uma de cada vez, cada uma com o seu resultado", async () => {
    const [a, b, c] = await Promise.all([
      lerCsvsNoTrabalhador(PEQUENO, ["dre.csv"], CNPJ),
      lerCsvsNoTrabalhador(PEQUENO, ["dre.csv"], OUTRO),
      patrimonioNoTrabalhador(PEQUENO, [OUTRO]),
    ]);

    expect(a).toEqual(lerCsvsDoZip(PEQUENO, ["dre.csv"], CNPJ));
    expect(b).toEqual(lerCsvsDoZip(PEQUENO, ["dre.csv"], OUTRO));
    expect(c?.get(OUTRO)?.patrimonioLiquido).toBe(99);
  });
});

describe("download da CVM em memória compartilhada", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  async function baixarCom(resposta: Response) {
    const { baixarZipCvm, limparCacheCvm } = await import("./cvm.provider.js");
    limparCacheCvm();
    globalThis.fetch = async () => resposta;
    return baixarZipCvm("teste.zip");
  }

  /** Um corpo em vários pedaços, como chega da rede. */
  function emPedacos(bytes: Uint8Array, tamanho: number) {
    return new ReadableStream<Uint8Array>({
      start(controle) {
        for (let i = 0; i < bytes.byteLength; i += tamanho) controle.enqueue(bytes.slice(i, i + tamanho));
        controle.close();
      },
    });
  }

  it("com content-length, monta o zip pedaço por pedaço e o entrega compartilhado, igual ao original", async () => {
    const zip = await baixarCom(
      new Response(emPedacos(PEQUENO, 97), { headers: { "content-length": String(PEQUENO.byteLength) } }),
    );

    expect(zip?.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(Buffer.from(zip ?? [])).toEqual(Buffer.from(PEQUENO));
  });

  it("corpo maior ou menor que o content-length anunciado: recusa", async () => {
    const maior = await baixarCom(new Response(emPedacos(PEQUENO, 50), { headers: { "content-length": "10" } }));
    const menor = await baixarCom(
      new Response(emPedacos(PEQUENO, 50), { headers: { "content-length": String(PEQUENO.byteLength + 5) } }),
    );

    expect(maior).toBeNull();
    expect(menor).toBeNull();
  });

  it("sem content-length, cai no caminho simples e ainda entrega compartilhado", async () => {
    const zip = await baixarCom(new Response(emPedacos(PEQUENO, 64)));

    expect(zip?.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(Buffer.from(zip ?? [])).toEqual(Buffer.from(PEQUENO));
  });
});
