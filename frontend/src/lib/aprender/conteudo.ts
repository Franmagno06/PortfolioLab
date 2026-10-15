import type { ComponentType } from "react";

/**
 * O texto de um artigo, já compilado pelo @next/mdx. O slug TEM de ter vindo de listarArtigos():
 * o import dinâmico aceita qualquer caminho que case com o padrão, e a lista é o que garante que
 * só artigo publicado chega aqui.
 */
export async function carregarConteudo(slug: string): Promise<ComponentType> {
  const modulo = (await import(`@/content/aprender/artigos/${slug}.mdx`)) as { default: ComponentType };
  return modulo.default;
}
