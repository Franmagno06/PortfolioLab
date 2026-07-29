import { XMLParser } from "fast-xml-parser";

// Leitura dos feeds RSS de notícias financeiras.
// Sem chave de API: RSS é público e não exige autenticação.

export type ItemNoticia = {
  titulo: string;
  link: string;
  fonte: string;
  publicadoEm: string; // ISO 8601
};

// Escolhidas por serem focadas em mercado e virem com UTF-8 correto.
// (O feed do InfoMoney mistura esporte; o do Investing.com vem com
// encoding quebrado — por isso ficaram de fora.)
const FONTES = [
  { nome: "Money Times", url: "https://www.moneytimes.com.br/feed/" },
  { nome: "Suno Notícias", url: "https://www.suno.com.br/noticias/feed/" },
];

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

type ItemRss = { title?: unknown; link?: unknown; pubDate?: unknown };

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "'",
  rsquo: "'",
  ldquo: "“",
  rdquo: "”",
};

/**
 * Decodifica entidades HTML nos títulos.
 * Feeds de WordPress costumam vir com dupla codificação (`&amp;#8220;`),
 * então uma passada só deixaria `&#8220;` visível para o leitor.
 */
function decodificarEntidades(texto: string): string {
  let anterior: string;
  let atual = texto;

  // repete enquanto houver o que decodificar (limite evita laço infinito)
  for (let i = 0; i < 3; i++) {
    anterior = atual;
    atual = atual
      .replace(/&#(\d+);/g, (_, cod: string) => String.fromCodePoint(Number(cod)))
      .replace(/&#x([0-9a-f]+);/gi, (_, cod: string) => String.fromCodePoint(parseInt(cod, 16)))
      .replace(/&([a-z]+);/gi, (inteiro, nome: string) => ENTIDADES[nome.toLowerCase()] ?? inteiro);
    if (atual === anterior) break;
  }

  return atual;
}

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  // alguns feeds trazem o valor dentro de #text ou CDATA
  if (valor && typeof valor === "object" && "#text" in valor) {
    return String((valor as { "#text": unknown })["#text"]).trim();
  }
  return "";
}

async function lerFeed(fonte: { nome: string; url: string }): Promise<ItemNoticia[]> {
  // timeout próprio: um feed lento não pode travar a resposta da API
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(fonte.url, {
      signal: controller.signal,
      headers: { "User-Agent": "PortfolioLab/1.0 (projeto educacional)" },
    });
    if (!res.ok) return [];

    const xml = parser.parse(await res.text()) as {
      rss?: { channel?: { item?: ItemRss | ItemRss[] } };
    };

    const bruto = xml.rss?.channel?.item;
    const itens = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];

    return itens.flatMap((item) => {
      const titulo = decodificarEntidades(texto(item.title));
      const link = texto(item.link);
      if (!titulo || !link) return [];

      const data = new Date(texto(item.pubDate));
      return [
        {
          titulo,
          link,
          fonte: fonte.nome,
          publicadoEm: isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString(),
        },
      ];
    });
  } catch {
    // um feed fora do ar não pode derrubar o restante
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Busca todas as fontes em paralelo e devolve as notícias mais recentes primeiro. */
export async function buscarNoticias(): Promise<ItemNoticia[]> {
  const resultados = await Promise.all(FONTES.map(lerFeed));

  // dedupe por link (a mesma notícia pode ser sindicada em mais de um feed)
  const porLink = new Map<string, ItemNoticia>();
  for (const item of resultados.flat()) {
    if (!porLink.has(item.link)) porLink.set(item.link, item);
  }

  return [...porLink.values()].sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
}
