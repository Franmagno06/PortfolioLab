// Confere se os valores citados pela IA existem mesmo no PDF original.
// Serve para auditar alucinação em qualquer relatório.
//
// Uso: node scripts/verificar-analise.mjs <caminho-do-pdf> "valor1" "valor2" ...
// Ex.:  node scripts/verificar-analise.mjs relatorio.pdf "5,05%" "R$ 3.431" "14,23%"
import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

const [caminho, ...valores] = process.argv.slice(2);

if (!caminho || valores.length === 0) {
  console.error('Uso: node scripts/verificar-analise.mjs <pdf> "valor1" "valor2" ...');
  process.exit(1);
}

const pdf = await getDocumentProxy(new Uint8Array(readFileSync(caminho)));
const { text, totalPages } = await extractText(pdf, { mergePages: true });
// normaliza espaços para não falhar por quebra de linha no meio de um número
const conteudo = text.replace(/\s+/g, " ");

console.log(`PDF: ${caminho}`);
console.log(`${totalPages} páginas, ${text.length.toLocaleString("pt-BR")} caracteres\n`);

let encontrados = 0;
for (const valor of valores) {
  const existe = conteudo.includes(valor);
  if (existe) encontrados++;
  console.log(`${existe ? "✅" : "❌"} "${valor}"`);
}

console.log(`\n${encontrados}/${valores.length} valores encontrados no documento original.`);
if (encontrados < valores.length) {
  console.log("⚠️  Valores não encontrados podem ser alucinação — ou apenas formatação diferente.");
  process.exitCode = 1;
}
