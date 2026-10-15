/**
 * Os tipos da aba Aprender. Os textos moram em src/content/aprender; aqui fica só a forma deles,
 * para as páginas e os testes concordarem sobre o que um artigo tem.
 */

/** Os cinco temas do filtro, na ordem em que aparecem. O id vai na URL (?tema=renda-fixa). */
export const CATEGORIAS = [
  { id: "antes-de-investir", rotulo: "Antes de investir" },
  { id: "renda-fixa", rotulo: "Renda fixa" },
  { id: "acoes-e-fiis", rotulo: "Ações e FIIs" },
  { id: "montar-a-carteira", rotulo: "Montar a carteira" },
  { id: "rebalancear", rotulo: "Rebalancear" },
] as const;

export type IdDeCategoria = (typeof CATEGORIAS)[number]["id"];

export function rotuloDaCategoria(id: IdDeCategoria): string {
  return CATEGORIAS.find((c) => c.id === id)?.rotulo ?? id;
}

export function ehCategoria(valor: unknown): valor is IdDeCategoria {
  return CATEGORIAS.some((c) => c.id === valor);
}

export type Fonte = { rotulo: string; url?: string };

/** O cabeçalho YAML de cada .mdx. Ver docs/aprender-conteudo.md. */
export type Frontmatter = {
  titulo: string;
  /** O nome curto do artigo na trilha de navegação, quando o título é longo. */
  tituloCurto?: string;
  subtitulo: string;
  categoria: IdDeCategoria;
  slug: string;
  /** Em minutos. Tem de bater com estimarTempoDeLeitura (um teste confere). */
  tempoLeitura: number;
  /** AAAA-MM-DD: a data da última conferência dos números e das fontes do texto. */
  atualizadoEm: string;
  /** Exatamente três frases: a caixa "Em resumo". */
  resumo: [string, string, string];
  fontes: Fonte[];
  /** Slugs de outros artigos, para "Continue lendo". */
  relacionados: string[];
  /** O artigo que abre o índice. No máximo um. */
  destaque?: boolean;
  /** A folha de caderno do destaque: a conta em duas linhas e uma anotação. Só o destaque usa. */
  ilustracao?: { linhas: [string, string]; nota: string };
};

export type Titulo = { id: string; texto: string };

export type Artigo = Frontmatter & { indice: Titulo[] };

/** Os artigos que existem ou estão planejados: os únicos slugs que o glossário e os relacionados podem citar. */
export const SLUGS_PLANEJADOS = [
  "por-que-o-dinheiro-parado-perde-valor",
  "reserva-de-emergencia",
  "juros-compostos-e-dividas",
  "selic-cdi-sem-misterio",
  "tesouro-direto",
  "cdb-lci-lca-e-fgc",
  "imposto-na-renda-fixa",
  "pl-e-pvp",
  "dividend-yield",
  "roe-margem-e-endividamento",
  "fiis-tijolo-ou-papel",
  "preco-medio",
  "etfs-uma-cota-varios-ativos",
  "rebalancear-com-aportes",
] as const;
