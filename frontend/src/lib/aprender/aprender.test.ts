import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { idDoVerbete, letraDoVerbete, VERBETES } from "../../content/aprender/glossario";
import { ANCORA_DA_DICA, INDICADORES } from "../../content/aprender/indicadores";
import { DICAS } from "../indicadores-explicados";
import { buscarArtigo, lerArquivoDoArtigo, listarArtigos, PASTA_DOS_ARTIGOS } from "./artigos";
import { validarFrontmatter } from "./frontmatter";
import { caixaAlta, estimarTempoDeLeitura, slugify, textoLegivel, titulosDoMdx } from "./texto";
import { CATEGORIAS, SLUGS_PLANEJADOS } from "./tipos";

describe("slugify", () => {
  it("tira acento e símbolo e junta com hífen", () => {
    expect(slugify("P/L: quantos anos de lucro pagam a ação")).toBe("p-l-quantos-anos-de-lucro-pagam-a-acao");
    expect(slugify("Data-ex")).toBe("data-ex");
    expect(slugify("  Preço médio (PM) ")).toBe("preco-medio-pm");
  });
});

describe("caixaAlta", () => {
  it("põe em maiúsculas, mas mantém a sigla FIIs", () => {
    expect(caixaAlta("Ações e FIIs")).toBe("AÇÕES E FIIs");
    expect(caixaAlta("Antes de investir")).toBe("ANTES DE INVESTIR");
    expect(caixaAlta("Em destaque · Ações e FIIs")).toBe("EM DESTAQUE · AÇÕES E FIIs");
  });
});

describe("estimarTempoDeLeitura", () => {
  const palavras = (n: number) => Array.from({ length: n }, () => "palavra").join(" ");
  it("arredonda para cima e nunca devolve menos de 1 minuto", () => {
    expect(estimarTempoDeLeitura("")).toBe(1);
    expect(estimarTempoDeLeitura(palavras(10))).toBe(1);
    expect(estimarTempoDeLeitura(palavras(180))).toBe(1);
    expect(estimarTempoDeLeitura(palavras(181))).toBe(2);
    expect(estimarTempoDeLeitura(palavras(900))).toBe(5);
  });

  it("não conta as marcas do MDX, o frontmatter nem o código", () => {
    const mdx = `---\ntitulo: "x"\n---\n\n## Título\n\nUm dois três.\n\n<Conta>\n</Conta>\n\n\`\`\`\ncodigo codigo codigo\n\`\`\`\n`;
    expect(textoLegivel(mdx).split(/\s+/).filter(Boolean)).toEqual(["Título", "Um", "dois", "três."]);
  });
});

describe("titulosDoMdx", () => {
  it("lista só os ## (não # nem ###) e ignora o que está dentro de bloco de código", () => {
    const mdx = "# Título\n\n## Primeira seção\n\ntexto\n\n### Subseção\n\n```\n## não é título\n```\n\n## Segunda: com acento\n";
    expect(titulosDoMdx(mdx)).toEqual([
      { id: "primeira-secao", texto: "Primeira seção" },
      { id: "segunda-com-acento", texto: "Segunda: com acento" },
    ]);
  });

  it("recusa título com formatação: o id da âncora sairia diferente do texto", () => {
    expect(() => titulosDoMdx("## Um **negrito**")).toThrow(/formatação/);
    expect(() => titulosDoMdx("## Com [link](/x)")).toThrow(/formatação/);
  });
});

describe("validarFrontmatter", () => {
  const base = {
    titulo: "Um título",
    subtitulo: "Um subtítulo",
    categoria: "renda-fixa",
    slug: "um-artigo",
    tempoLeitura: 4,
    atualizadoEm: "2026-10-02",
    resumo: ["a", "b", "c"],
    fontes: [{ rotulo: "Fonte", url: "https://exemplo.com" }],
    relacionados: [],
  };
  const validar = (mudancas: Record<string, unknown>) => validarFrontmatter({ ...base, ...mudancas }, "um-artigo.mdx");

  it("aceita um cabeçalho completo, inclusive a data como Date (o YAML converte 2026-10-02 em Date)", () => {
    expect(validar({}).slug).toBe("um-artigo");
    expect(validar({ atualizadoEm: new Date("2026-10-02T00:00:00Z") }).atualizadoEm).toBe("2026-10-02");
  });

  it.each([
    ["categoria", { categoria: "inventada" }, /categoria/],
    ["slug diferente do arquivo", { slug: "outro" }, /nome do arquivo/],
    ["resumo com duas frases", { resumo: ["a", "b"] }, /3 frases/],
    ["fontes vazias", { fontes: [] }, /fontes/],
    ["fonte sem https", { fontes: [{ rotulo: "x", url: "http://exemplo.com" }] }, /https/],
    ["data fora do formato", { atualizadoEm: "02/10/2026" }, /AAAA-MM-DD/],
    ["tempo de leitura fracionado", { tempoLeitura: 2.5 }, /tempoLeitura/],
    ["título vazio", { titulo: "  " }, /titulo/],
  ])("recusa: %s", (_nome, mudancas, mensagem) => {
    expect(() => validar(mudancas)).toThrow(mensagem);
  });
});

describe("os artigos publicados", () => {
  const artigos = listarArtigos();
  const arquivos = readdirSync(PASTA_DOS_ARTIGOS).filter((a) => a.endsWith(".mdx"));

  it("há ao menos um artigo e cada arquivo vira um artigo", () => {
    expect(artigos.length).toBeGreaterThanOrEqual(1);
    expect(artigos).toHaveLength(arquivos.length);
  });

  it("todo slug é um dos planejados, sem repetir", () => {
    const slugs = artigos.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(SLUGS_PLANEJADOS as readonly string[], s).toContain(s);
  });

  it("o tempo de leitura do cabeçalho é o que o texto pede", () => {
    for (const a of artigos) {
      const estimado = estimarTempoDeLeitura(textoLegivel(lerArquivoDoArtigo(`${a.slug}.mdx`)));
      expect(a.tempoLeitura, `${a.slug}: o texto tem ~${estimado} min`).toBe(estimado);
    }
  });

  it("o índice lateral bate com os ## do texto, e todo artigo tem ao menos duas seções", () => {
    for (const a of artigos) {
      expect(a.indice.length, a.slug).toBeGreaterThanOrEqual(2);
      expect(new Set(a.indice.map((t) => t.id)).size, `${a.slug}: ids de seção repetidos`).toBe(a.indice.length);
    }
  });

  it("os relacionados existem e nenhum artigo cita a si mesmo", () => {
    for (const a of artigos) {
      for (const r of a.relacionados) {
        expect(buscarArtigo(r), `${a.slug} → ${r}`).toBeDefined();
        expect(r).not.toBe(a.slug);
      }
    }
  });

  it("cada tema do filtro é válido e há no máximo um destaque", () => {
    const temas = new Set(CATEGORIAS.map((c) => c.id));
    for (const a of artigos) expect(temas.has(a.categoria)).toBe(true);
    expect(artigos.filter((a) => a.destaque).length).toBeLessThanOrEqual(1);
  });

  it("nenhum artigo diz que algo é bom, barato ou oportunidade de compra (Resolução CVM 20)", () => {
    const proibidas = /\b(compre|vale a pena comprar|oportunidade de compra|imperd[ií]vel|recomendamos comprar)\b/i;
    for (const a of artigos) expect(lerArquivoDoArtigo(`${a.slug}.mdx`), a.slug).not.toMatch(proibidas);
  });

  it("todo artigo mostra a data da conferência e ao menos uma fonte", () => {
    for (const a of artigos) {
      expect(a.atualizadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.fontes.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("o glossário", () => {
  const ids = VERBETES.map(idDoVerbete);

  it("tem as âncoras únicas (#data-ex, #pl...) e o termo sem repetir", () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(VERBETES.map((v) => v.termo)).size).toBe(VERBETES.length);
    expect(ids).toContain("data-ex");
    expect(ids).toContain("pl");
  });

  it("toda definição é uma frase curta, sem número que muda e sem recomendação", () => {
    for (const v of VERBETES) {
      expect(v.definicao.length, v.termo).toBeLessThan(260);
      expect(v.definicao, `${v.termo}: número de mercado vai no artigo, com fonte e data`).not.toMatch(/R\$ ?\d|\d+ ?%/);
      expect(v.definicao.toLowerCase(), v.termo).not.toMatch(/compre|oportunidade|recomend/);
    }
  });

  it("os artigos citados são dos planejados, e as páginas de consulta existem", () => {
    for (const v of VERBETES) {
      if (v.artigo) expect(SLUGS_PLANEJADOS as readonly string[], v.termo).toContain(v.artigo);
      if (v.consulta) expect(v.consulta.href, v.termo).toMatch(/^\/aprender\/(indicadores|como-calculamos)(#[a-z-]+)?$/);
    }
  });

  it("as letras vão de A a V, sem acento, e cada letra do índice tem verbete", () => {
    const letras = [...new Set(VERBETES.map(letraDoVerbete))];
    for (const l of letras) expect(l).toMatch(/^[A-Z]$/);
    expect(letraDoVerbete({ termo: "Ação", definicao: "" })).toBe("A");
    expect(letraDoVerbete({ termo: "P/L", definicao: "" })).toBe("P");
    expect(letras.sort().join("")).toBe("ABCDEFIJLMPRSTV");
  });

  it("os links de indicador apontam para âncoras que existem em /aprender/indicadores", () => {
    const ancoras = new Set(INDICADORES.map((i) => i.id));
    for (const v of VERBETES) {
      const m = v.consulta?.href.match(/^\/aprender\/indicadores#(.+)$/);
      if (m) expect(ancoras.has(m[1] as never), `${v.termo} → #${m[1]}`).toBe(true);
    }
  });
});

describe("indicadores explicados", () => {
  it("tem as nove âncoras (as cinco do protótipo e as quatro que faltavam) e cada cartão está completo", () => {
    expect(INDICADORES.map((i) => i.id)).toEqual(["pl", "pvp", "dy", "roe", "roa", "margem", "divida", "vacancia", "fii"]);
    for (const i of INDICADORES) {
      for (const campo of ["nome", "formula", "comoLer", "armadilha", "exemploRotulo", "exemplo"] as const) expect(i[campo], `${i.id}.${campo}`).toBeTruthy();
    }
  });

  it("o exemplo de ação vem do ativo da página inicial; o resto é hipotético e diz isso", () => {
    const porId = Object.fromEntries(INDICADORES.map((i) => [i.id, i]));
    expect(porId.pl?.exemplo).toBe("9,66");
    expect(porId.pvp?.exemplo).toBe("1,96");
    // o brlComCasas põe um espaço que não separa depois do "R$"
    expect(porId.dy?.exemplo?.replace(/ /g, " ")).toBe("6,55% (R$ 3,0065 em 4 pagamentos)");
    expect(porId.roe?.exemplo).toBe("20,86%");
    for (const id of ["pl", "pvp", "dy", "roe"]) expect(porId[id]?.exemploRotulo).toBe("No exemplo (TAEE11)");
    for (const id of ["roa", "margem", "divida", "vacancia", "fii"]) expect(porId[id]?.exemploRotulo, id).toBe("Exemplo hipotético");
    expect(porId.roa?.exemplo).toMatch(/^2,0%/);
    expect(porId.margem?.exemplo).toMatch(/^12,5%/);
    expect(porId.divida?.exemplo).toMatch(/^2,0x/);
    expect(porId.vacancia?.exemplo).toMatch(/^7,5%/);
    expect(porId.fii?.exemplo.startsWith("DY 11,0% e P/VP 0,95")).toBe(true);
  });

  it("todo '?' das fichas que aponta para um indicador aponta para um que existe", () => {
    const ancoras = new Set(INDICADORES.map((i) => i.id));
    for (const [dica, ancora] of Object.entries(ANCORA_DA_DICA)) {
      expect(Object.keys(DICAS), dica).toContain(dica);
      expect(ancoras.has(ancora!), `${dica} → #${ancora}`).toBe(true);
    }
  });
});
