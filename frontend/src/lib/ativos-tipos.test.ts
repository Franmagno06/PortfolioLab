import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const lerFonte = (...partes: string[]) => readFileSync(join(RAIZ, ...partes), "utf8");

const CAMPO = /^\s*(\w+)\??:/;
const NOME = /^(\w+)/;

/** Os nomes de campo do primeiro nível de cada `export type X = ...` (as chaves aninhadas ficam de fora). */
function camposPorTipo(fonte: string): Record<string, string[]> {
  const saida: Record<string, string[]> = {};
  for (const pedaco of fonte.split(/^(?:export )?type /m).slice(1)) {
    const nome = NOME.exec(pedaco)?.[1];
    if (!nome) continue;
    const campos: string[] = [];
    let nivel = 0;
    let linha = "";
    for (const c of pedaco) {
      if (c === "{") nivel++;
      else if (c === "}") nivel--;
      else if (c === String.fromCharCode(10)) {
        const campo = nivel === 1 ? CAMPO.exec(linha)?.[1] : undefined;
        if (campo) campos.push(campo);
        linha = "";
        continue;
      }
      linha += c;
    }
    saida[nome] = campos.sort();
  }
  return saida;
}

describe("ativos-tipos.ts acompanha os DTOs do backend", () => {
  const backend = camposPorTipo(lerFonte("..", "backend", "src", "modules", "ativos", "ativos.tipos.ts"));
  const front = camposPorTipo(lerFonte("src", "lib", "ativos-tipos.ts"));

  // o back chama de "...Dto" o que o front chama sem o sufixo
  const NOME_NO_FRONT: Record<string, string> = {
    AcaoResumoDto: "AcaoResumo",
    FiiResumoDto: "FiiResumo",
    AcaoFichaDto: "AcaoFicha",
    FiiFichaDto: "FiiFicha",
    EtfResumoDto: "EtfResumo",
    CabecalhoDoAtivoDto: "Cabecalho",
  };

  it("tem os mesmos campos nos tipos que atravessam a API", () => {
    const nomes = ["Bloco", "PontoDePreco", "ProventoDoAtivo", "NoticiaDoAtivo", "ResultadoTrimestral", "ComposicaoDoFundo", "IndicadoresDaAcao", "IndicadoresDoFii", "AcaoResumoDto", "FiiResumoDto", "EtfResumoDto", "PatrimonioDoEtf", "CabecalhoDoAtivoDto"];
    for (const nome of nomes) {
      const doFront = front[NOME_NO_FRONT[nome] ?? nome];
      expect(doFront, `${nome} existe no front`).toBeDefined();
      expect(doFront, nome).toEqual(backend[nome]);
    }
  });

  it("as fichas têm os mesmos blocos (o cabeçalho vem de um tipo auxiliar nos dois lados)", () => {
    const blocosDaAcao = ["banco", "indicadores", "historico", "proventos", "resultados", "noticias"];
    const blocosDoEtf = ["patrimonio", "historico", "proventos", "noticias"];
    expect(front["EtfFicha"]).toEqual(expect.arrayContaining(blocosDoEtf));
    expect(backend["EtfFichaDto"]).toEqual(expect.arrayContaining(blocosDoEtf));
    const blocosDoFii = ["indicadores", "informe", "composicao", "historico", "proventos", "noticias"];
    expect(front["AcaoFicha"]).toEqual(expect.arrayContaining(blocosDaAcao));
    expect(front["FiiFicha"]).toEqual(expect.arrayContaining(blocosDoFii));
    expect(backend["AcaoFichaDto"]).toEqual(expect.arrayContaining(blocosDaAcao));
    expect(backend["FiiFichaDto"]).toEqual(expect.arrayContaining(blocosDoFii));
  });
});
