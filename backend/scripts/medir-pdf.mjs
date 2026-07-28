// Mede o texto extraído de um PDF: caracteres, páginas e estimativa de tokens.
// Uso: node scripts/medir-pdf.mjs <caminho-do-pdf>
import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

const caminho = process.argv[2];
if (!caminho) {
  console.error("Uso: node scripts/medir-pdf.mjs <caminho-do-pdf>");
  process.exit(1);
}

const pdf = await getDocumentProxy(new Uint8Array(readFileSync(caminho)));
const { text, totalPages } = await extractText(pdf, { mergePages: true });

console.log(`Páginas:      ${totalPages}`);
console.log(`Caracteres:   ${text.length.toLocaleString("pt-BR")}`);
// Em português, ~1 token a cada 3,5 caracteres (estimativa conservadora)
console.log(`Tokens (est): ${Math.round(text.length / 3.5).toLocaleString("pt-BR")}`);
