import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { validarFrontmatter } from "./frontmatter";
import { titulosDoMdx } from "./texto";
import type { Artigo } from "./tipos";

/**
 * Lê os artigos de src/content/aprender/artigos no servidor, em tempo de build (as páginas são
 * estáticas). Só metadados e o índice saem daqui; quem desenha o texto é o import do próprio .mdx
 * (ver carregarConteudo em conteudo.ts). Este arquivo usa fs: não o importe de um componente de cliente.
 */
export const PASTA_DOS_ARTIGOS = join(process.cwd(), "src", "content", "aprender", "artigos");

export function lerArquivoDoArtigo(arquivo: string): string {
  return readFileSync(join(PASTA_DOS_ARTIGOS, arquivo), "utf8");
}

let cache: Artigo[] | null = null;

/** Todos os artigos, do mais recente ao mais antigo (empate: ordem alfabética do título). */
export function listarArtigos(): Artigo[] {
  if (cache && process.env.NODE_ENV === "production") return cache;

  const arquivos = readdirSync(PASTA_DOS_ARTIGOS).filter((a) => a.endsWith(".mdx"));
  const artigos = arquivos.map((arquivo): Artigo => {
    const { data, content } = matter(lerArquivoDoArtigo(arquivo));
    return { ...validarFrontmatter(data, arquivo), indice: titulosDoMdx(content) };
  });

  const slugs = new Set(artigos.map((a) => a.slug));
  for (const a of artigos) {
    const orfao = a.relacionados.find((r) => !slugs.has(r));
    if (orfao) throw new Error(`${a.slug}.mdx: "relacionados" cita "${orfao}", que não existe`);
  }
  if (artigos.filter((a) => a.destaque).length > 1) throw new Error("Só um artigo pode ter destaque: true");

  artigos.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  cache = artigos;
  return artigos;
}

export function buscarArtigo(slug: string): Artigo | undefined {
  return listarArtigos().find((a) => a.slug === slug);
}

/** O artigo em destaque; sem nenhum marcado, o mais recente. Undefined só se não há artigo. */
export function artigoEmDestaque(): Artigo | undefined {
  const todos = listarArtigos();
  return todos.find((a) => a.destaque) ?? todos[0];
}
