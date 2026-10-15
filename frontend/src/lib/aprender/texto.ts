import type { Titulo } from "./tipos";

// Os acentos, depois de normalizar para NFD, viram marcas combinadas nesta faixa Unicode.
const MARCAS_DE_ACENTO = /[̀-ͯ]/g;

/** "P/L: quantos anos de lucro pagam a ação" → "p-l-quantos-anos-de-lucro-pagam-a-acao". */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(MARCAS_DE_ACENTO, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Caixa alta para as etiquetas de categoria ("AÇÕES E FIIs"). Não dá para deixar isso ao CSS
 * (text-transform): ele escreveria "FIIS", e a sigla é FIIs, com o "s" do plural em minúscula.
 */
export function caixaAlta(texto: string): string {
  return texto.toLocaleUpperCase("pt-BR").replace(/FIIS/g, "FIIs");
}

const PALAVRAS_POR_MINUTO = 180;

/**
 * Minutos de leitura, arredondados para cima, nunca menos de 1. 180 palavras por minuto é
 * conservador de propósito: o texto tem contas e números, que se leem mais devagar que prosa.
 */
export function estimarTempoDeLeitura(texto: string): number {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(palavras / PALAVRAS_POR_MINUTO));
}

/** Tira o frontmatter, os blocos de código e as marcas do MDX, deixando o que a pessoa lê. */
export function textoLegivel(mdx: string): string {
  return mdx
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`]/g, " ");
}

/**
 * Os `## títulos` do artigo, para o índice "Neste artigo". O texto do título tem de ser puro
 * (sem **negrito**, `código`, [link] nem JSX): é o mesmo texto que vira o id da âncora no HTML,
 * e os dois lados só concordam se ninguém formatar o título.
 */
export function titulosDoMdx(mdx: string): Titulo[] {
  const titulos: Titulo[] = [];
  let emCodigo = false;
  for (const linha of mdx.split(/\r?\n/)) {
    if (linha.startsWith("```")) emCodigo = !emCodigo;
    if (emCodigo) continue;
    const m = /^##\s+(.+?)\s*$/.exec(linha);
    if (!m?.[1]) continue;
    const texto = m[1];
    if (/[*_`[\]<>]/.test(texto)) {
      throw new Error(`Título "## ${texto}" tem formatação. Títulos de seção são texto puro.`);
    }
    titulos.push({ id: slugify(texto), texto });
  }
  return titulos;
}
