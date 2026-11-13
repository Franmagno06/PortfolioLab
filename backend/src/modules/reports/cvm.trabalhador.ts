import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import type { RespostaCvm, TarefaCvm } from "./cvm.worker.js";
import type { PatrimonioDeClasse } from "./cvm.zip.js";

/**
 * Leva a parte de CPU da leitura da CVM (cvm.zip.ts) para um worker_thread, fora do laço de eventos.
 *
 * Por quê: descompactar e varrer o zip leva 0,5 a 2 s por trimestre numa CPU normal, e 5 a 20 s no
 * Render gratuito (0,1 CPU). No laço de eventos, nada mais era atendido nesse tempo, nem o GET /health,
 * e o Render reiniciava a instância ("health check timed out after 5 seconds").
 *
 * Regras:
 * - Um worker só, persistente e reaproveitado, criado na primeira tarefa. `unref`: não segura o processo.
 * - Fila serial: uma tarefa por vez, nunca dois zips descompactados ao mesmo tempo (memória: 512 MB).
 *   Vale para todos os chamadores juntos (relatórios e fichas de ativos).
 * - Nada lança: falha no worker, erro dentro da leitura ou prazo vencido viram null, como antes.
 * - Worker que morre (ou que estoura o prazo, e é encerrado) é recriado na próxima tarefa.
 * - O zip vai sem cópia quando está num SharedArrayBuffer (é como cvm.provider.ts o guarda); um
 *   Uint8Array comum é copiado pelo postMessage.
 *
 * O arquivo do worker é o .ts ao lado deste em desenvolvimento e teste (tsx, vitest), carregado com o
 * tsx, e o .js compilado em dist/ na produção (`node dist/server.js`).
 */

const EM_TS = import.meta.url.endsWith(".ts");
const PRAZO_PADRAO_MS = 120_000;

type SemId<T> = T extends { id: number } ? Omit<T, "id"> : never;
type Resultado = Extract<RespostaCvm, { ok: true }>["resultado"];

let prazoMs = PRAZO_PADRAO_MS;
let atual: Worker | null = null;
let fila: Promise<unknown> = Promise.resolve();
let proximoId = 1;

function criarWorker(): Worker {
  const arquivo = new URL(EM_TS ? "./cvm.worker.ts" : "./cvm.worker.js", import.meta.url);
  const execArgv = EM_TS ? ["--import", pathToFileURL(createRequire(import.meta.url).resolve("tsx/esm")).href] : [];
  const worker = new Worker(arquivo, { execArgv, name: "leitura-cvm" });
  worker.unref();
  worker.on("exit", () => {
    if (atual === worker) atual = null;
  });
  // Sem ouvinte, um erro do worker derrubaria o processo; a tarefa em curso trata o dela.
  worker.on("error", () => undefined);
  return worker;
}

function descartar(worker: Worker): void {
  if (atual === worker) atual = null;
  void worker.terminate().catch(() => undefined);
}

function rodar(tarefa: SemId<TarefaCvm>): Promise<Resultado> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = atual ?? (atual = criarWorker());
    } catch (erro) {
      console.error("[CVM] não foi possível criar o worker:", erro instanceof Error ? erro.message : erro);
      resolve(null);
      return;
    }

    const id = proximoId++;
    let terminou = false;
    const terminar = (resultado: Resultado) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(prazo);
      worker.off("message", aoResponder);
      worker.off("error", aoFalhar);
      worker.off("exit", aoSair);
      resolve(resultado);
    };
    const aoResponder = (resposta: RespostaCvm) => {
      if (resposta.id !== id) return;
      if (!resposta.ok) console.error("[CVM] falha ao ler o zip:", resposta.erro);
      terminar(resposta.ok ? resposta.resultado : null);
    };
    const aoFalhar = (erro: unknown) => {
      console.error("[CVM] o worker da leitura falhou:", erro instanceof Error ? erro.message : erro);
      descartar(worker);
      terminar(null);
    };
    const aoSair = (codigo: number) => {
      console.error(`[CVM] o worker da leitura saiu (código ${codigo}) no meio de uma tarefa`);
      terminar(null);
    };
    const prazo = setTimeout(() => {
      console.error(`[CVM] a leitura passou de ${prazoMs / 1000} s; worker encerrado`);
      descartar(worker);
      terminar(null);
    }, prazoMs);

    worker.on("message", aoResponder);
    worker.on("error", aoFalhar);
    worker.on("exit", aoSair);
    try {
      worker.postMessage({ ...tarefa, id });
    } catch (erro) {
      aoFalhar(erro);
    }
  });
}

function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = fila.then(tarefa, tarefa);
  fila = resultado.catch(() => undefined);
  return resultado;
}

/** `lerCsvsDoZip` no worker. Null se a leitura falhou. */
export function lerCsvsNoTrabalhador(zip: Uint8Array, nomes: string[], cnpj?: string): Promise<Map<string, string> | null> {
  const tarefa = { tipo: "csvs" as const, zip, nomes, ...(cnpj === undefined ? {} : { cnpj }) };
  return naFila(() => rodar(tarefa)) as Promise<Map<string, string> | null>;
}

/** O patrimônio das classes (registro_classe.csv do zip) no worker. Null se o CSV não está no zip ou a leitura falhou. */
export function patrimonioNoTrabalhador(zip: Uint8Array, cnpjs: string[]): Promise<Map<string, PatrimonioDeClasse> | null> {
  return naFila(() => rodar({ tipo: "patrimonio", zip, cnpjs })) as Promise<Map<string, PatrimonioDeClasse> | null>;
}

/** Copia o zip para memória compartilhada: o worker o lê sem uma cópia de 20 a 30 MB por tarefa. */
export function emMemoriaCompartilhada(bytes: Uint8Array): Uint8Array {
  const compartilhado = new Uint8Array(new SharedArrayBuffer(bytes.byteLength));
  compartilhado.set(bytes);
  return compartilhado;
}

/** Só para testes: muda o prazo por tarefa (null volta ao padrão). */
export function definirPrazoDaLeituraCvm(ms: number | null): void {
  prazoMs = ms ?? PRAZO_PADRAO_MS;
}

/** Encerra o worker (testes; a próxima tarefa cria outro). Tarefa em curso vira null. */
export async function encerrarTrabalhadorCvm(): Promise<void> {
  const worker = atual;
  atual = null;
  if (worker) await worker.terminate();
}
