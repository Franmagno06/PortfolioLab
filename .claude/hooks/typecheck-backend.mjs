// Hook PostToolUse: roda `tsc --noEmit` no backend depois que Claude edita
// um arquivo em backend/src/**.ts.
//
// Recebe o payload do hook em JSON no stdin. Sai com:
//   0 — arquivo fora do escopo, ou typecheck passou
//   2 — typecheck falhou: a saída do tsc volta para o Claude corrigir
//
// Registrado em .claude/settings.json (evento PostToolUse, matcher Write|Edit).

import { spawnSync } from "node:child_process";
import path from "node:path";

const SEPARADOR = String.fromCharCode(92); // barra invertida, sem escapar

function lerStdin() {
  return new Promise((resolve) => {
    let dados = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (pedaco) => (dados += pedaco));
    process.stdin.on("end", () => resolve(dados));
  });
}

const bruto = await lerStdin();

let payload;
try {
  payload = JSON.parse(bruto);
} catch {
  process.exit(0); // payload ilegível não é motivo para travar a edição
}

const caminho = String(
  payload?.tool_input?.file_path ?? payload?.tool_response?.filePath ?? "",
).split(SEPARADOR).join("/");

const marcador = "/backend/src/";
const indice = caminho.indexOf(marcador);

// só interessa TypeScript dentro de backend/src
if (indice === -1 || !caminho.endsWith(".ts")) {
  process.exit(0);
}

const raizBackend = path.join(caminho.slice(0, indice), "backend");

const tsc = spawnSync("npx", ["tsc", "--noEmit"], {
  cwd: raizBackend,
  encoding: "utf8",
  shell: true,
});

if (tsc.status === 0) {
  process.exit(0);
}

// Exit 2 devolve o stderr ao Claude como erro bloqueante — é o que faz o
// erro de tipo aparecer na hora, em vez de só no próximo build.
process.stderr.write(
  `tsc --noEmit falhou em backend/ apos editar ${path.basename(caminho)}:\n` +
    `${(tsc.stdout || "") + (tsc.stderr || "")}`,
);
process.exit(2);
