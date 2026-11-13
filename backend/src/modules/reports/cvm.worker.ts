import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { parentPort } from "node:worker_threads";
import { lerCsvsDoZip, patrimonioDasClasses, type PatrimonioDeClasse } from "./cvm.zip.js";

/**
 * O worker da leitura da CVM (ver cvm.trabalhador.ts). Recebe uma tarefa por vez, faz a parte de CPU
 * (descompactar e achar as linhas do CNPJ) e devolve o resultado. Só importa cvm.zip.ts: nada de
 * Prisma, rede ou banco aqui dentro.
 */

export type TarefaCvm =
  | { id: number; tipo: "csvs"; zip: Uint8Array; nomes: string[]; cnpj?: string }
  | { id: number; tipo: "patrimonio"; zip: Uint8Array; cnpjs: string[] };

export type RespostaCvm =
  | { id: number; ok: true; resultado: Map<string, string> | Map<string, PatrimonioDeClasse> | null }
  | { id: number; ok: false; erro: string };

/**
 * Coleta de lixo deste worker, depois de cada arquivo lido e de cada tarefa. Um CSV descompactado
 * chega a 93 MB fora
 * do heap (ArrayBuffer), e o worker quase não aloca JavaScript: sem isto, o V8 demorava a coletar e
 * vários desses buffers mortos se somavam, mais de 100 MB a mais no pico (medido com os zips reais).
 * O 512 MB do Render é do processo inteiro. O gc() é só deste isolate, então não pausa o thread principal.
 */
setFlagsFromString("--expose-gc");
const coletar = runInNewContext("gc") as (() => void) | undefined;

function executar(tarefa: TarefaCvm): Map<string, string> | Map<string, PatrimonioDeClasse> | null {
  if (tarefa.tipo === "csvs") return lerCsvsDoZip(tarefa.zip, tarefa.nomes, tarefa.cnpj, coletar);
  const csv = lerCsvsDoZip(tarefa.zip, ["registro_classe.csv"]).get("registro_classe.csv");
  return csv === undefined ? null : patrimonioDasClasses(csv, tarefa.cnpjs);
}

parentPort?.on("message", (tarefa: TarefaCvm) => {
  let resposta: RespostaCvm;
  try {
    resposta = { id: tarefa.id, ok: true, resultado: executar(tarefa) };
  } catch (erro) {
    resposta = { id: tarefa.id, ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
  parentPort?.postMessage(resposta);
  coletar?.();
});
