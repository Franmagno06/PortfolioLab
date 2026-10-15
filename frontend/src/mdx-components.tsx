import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Children } from "react";
import { Armadilha } from "@/components/aprender/armadilha";
import { Conta, Parcela, Sinal } from "@/components/aprender/conta";
import { Trecho } from "@/components/aprender/trecho";
import { VejaNoSite } from "@/components/aprender/veja-no-site";
import { slugify } from "@/lib/aprender/texto";

/**
 * Como o MDX dos artigos vira HTML. O texto corrido usa a escala "Artigo/*" (globals.css) e os
 * blocos do protótipo viram componentes. Ver docs/aprender-conteudo.md para a lista do que um
 * artigo pode usar.
 */
/**
 * "R$ 42,85" não pode quebrar entre o "R$" e o número: o texto corrido vira "se a ação custa R$" numa
 * linha e "42,85" na seguinte. Troca o espaço depois de "R$" por um espaço que não separa.
 */
function moedaSemQuebra(filhos: React.ReactNode): React.ReactNode {
  return Children.map(filhos, (f) => (typeof f === "string" ? f.replace(/R\$ (?=\d)/g, "R$\u00a0") : f));
}

const components: MDXComponents = {
  p: ({ children }) => <p className="artigo-corpo text-ink">{moedaSemQuebra(children)}</p>,

  // O id da âncora sai do texto do título (slugify), o mesmo cálculo que lib/aprender/texto.ts faz
  // para montar o índice. Por isso o título é sempre texto puro.
  h2: ({ children }) => {
    if (typeof children !== "string") throw new Error("Título de seção (##) só aceita texto puro.");
    return (
      <h2 id={slugify(children)} className="artigo-secao mt-4 text-ink">
        {children}
      </h2>
    );
  },

  blockquote: ({ children }) => (
    <blockquote className="artigo-citacao border-l-4 border-anotacao-margem py-1 pl-6 text-anotacao [&_p]:font-[inherit] [&_p]:text-[length:inherit] [&_p]:leading-[inherit] [&_p]:text-anotacao">
      {children}
    </blockquote>
  ),

  ul: ({ children }) => <ul className="artigo-corpo list-disc pl-6 marker:text-anotacao text-ink">{children}</ul>,
  ol: ({ children }) => <ol className="artigo-corpo list-decimal pl-6 marker:text-anotacao text-ink">{children}</ol>,
  li: ({ children }) => <li className="pl-1 [&_p]:inline">{moedaSemQuebra(children)}</li>,

  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,

  // Tabela de markdown (remark-gfm). Rola sozinha no celular, sem empurrar a página para o lado.
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border border-pauta bg-card">
      <table className="w-full border-collapse text-[15px] leading-[22px] text-ink">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="bg-paper px-4 py-2.5 text-left text-xs leading-4 font-medium text-mute">{children}</th>,
  td: ({ children }) => <td className="border-t border-pauta px-4 py-3 align-top">{moedaSemQuebra(children)}</td>,

  a: ({ href = "", children }) => {
    const estilo = "rounded underline decoration-1 underline-offset-4";
    return href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href} className={estilo}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={estilo}>
        {children}
      </a>
    );
  },

  Conta,
  Parcela,
  Sinal,
  Armadilha,
  Trecho,
  VejaNoSite,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
