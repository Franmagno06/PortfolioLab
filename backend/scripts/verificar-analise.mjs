// Confere se os dados citados pela IA existem mesmo no PDF original.
// Uso: node scripts/verificar-analise.mjs <caminho-do-pdf>
import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

const caminho = process.argv[2];
if (!caminho) {
  console.error("Uso: node scripts/verificar-analise.mjs <caminho-do-pdf>");
  process.exit(1);
}

const pdf = await getDocumentProxy(new Uint8Array(readFileSync(caminho)));
const { text } = await extractText(pdf, { mergePages: true });
const normalizado = text.replace(/\s+/g, " ");

// Valores que a IA afirmou — cada um precisa aparecer no texto do PDF
const afirmacoes = [
  ["Rendimento por cota", "0,10"],
  ["Yield mensal", "1,00%"],
  ["Yield anualizado", "12,71%"],
  ["% do CDI", "104,56%"],
  ["Patrimônio líquido", "4.313.692.471,65"],
  ["Valor patrimonial da cota", "9,3721"],
  ["Número de cotistas", "1.468.513"],
  ["Quantidade de cotas", "460.269.531"],
  ["Taxa de administração", "0,90%"],
  ["CRI vencido #1", "14B0058368"],
  ["CRI vencido #2", "14K0050601"],
  ["CRI vencido #3", "15H0698161"],
  ["CRI Urbplan (recuperação judicial)", "11L0005713"],
  ["Devedora AIZ/Pesa", "Pesa"],
  ["Devedora Arquiplan", "Arquiplan"],
  ["CRI Mitre Michigan", "Michigan"],
];

let acertos = 0;
for (const [rotulo, valor] of afirmacoes) {
  const existe = normalizado.includes(valor);
  if (existe) acertos++;
  console.log(`${existe ? "✅" : "❌"} ${rotulo.padEnd(36)} "${valor}"`);
}

console.log(`\n${acertos}/${afirmacoes.length} valores conferidos no PDF original.`);
if (acertos < afirmacoes.length) {
  console.log("⚠️  Algum valor não foi encontrado — investigue possível alucinação.");
}
