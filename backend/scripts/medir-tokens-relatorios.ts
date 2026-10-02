import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { extractText, getDocumentProxy } from "unpdf";
import { CONTEXTO_ANALISE } from "../src/modules/reports/reports.service.js";
import { selecionarSecoesRelevantes } from "../src/modules/reports/trechos.js";

/**
 * Quanto cada PDF de relatorios-para-teste/ custaria em tokens de ENTRADA na
 * análise inicial, com o recorte atual e com tetos alternativos.
 *
 *   npx tsx scripts/medir-tokens-relatorios.ts
 *
 * Usa o countTokens do Gemini, que conta sem gerar nada: não consome a cota de
 * geração, que é a que estoura. Exige GEMINI_API_KEY no .env.
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
const modelo = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const pasta = new URL("../../relatorios-para-teste/", import.meta.url);

async function contar(texto: string): Promise<number> {
  const r = await ai.models.countTokens({ model: modelo, contents: texto });
  return r.totalTokens ?? -1;
}

// tetos alternativos pela linha de comando: npx tsx scripts/medir-tokens-relatorios.ts 150000 40000
const tetos = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [CONTEXTO_ANALISE];
const linhas: Record<string, string | number>[] = [];

for (const nome of readdirSync(pasta).filter((f) => f.endsWith(".pdf"))) {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(new URL(nome, pasta))));
  const { text } = await extractText(pdf, { mergePages: true });
  const linha: Record<string, string | number> = {
    pdf: nome.replace(/\.pdf$/, "").slice(0, 34),
    paginas: pdf.numPages,
    caracteres: text.length,
  };
  for (const teto of tetos) {
    linha[`tokens (teto ${teto / 1000} mil)`] = await contar(
      selecionarSecoesRelevantes(text.trim(), teto),
    );
  }
  linhas.push(linha);
}

console.table(linhas);
