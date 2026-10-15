import { ehCategoria, type Fonte, type Frontmatter } from "./tipos";

/**
 * Confere o cabeçalho de um artigo e devolve com o tipo certo. Falha alto, com o nome do arquivo:
 * um artigo com dado faltando não pode ir ao ar com um "undefined" no lugar do título.
 */
export function validarFrontmatter(dados: Record<string, unknown>, arquivo: string): Frontmatter {
  const erro = (msg: string): never => {
    throw new Error(`${arquivo}: ${msg}`);
  };
  const texto = (campo: string): string => {
    const v = dados[campo];
    return typeof v === "string" && v.trim() ? v.trim() : erro(`campo "${campo}" ausente ou vazio`);
  };

  const slug = texto("slug");
  if (slug !== arquivo.replace(/\.mdx$/, "")) erro(`"slug" (${slug}) tem de ser igual ao nome do arquivo`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) erro(`"slug" só aceita minúsculas, números e hífen`);

  const categoria = dados.categoria;
  if (!ehCategoria(categoria)) erro(`"categoria" inválida: ${String(categoria)}`);

  const tempoLeitura = dados.tempoLeitura;
  if (typeof tempoLeitura !== "number" || !Number.isInteger(tempoLeitura) || tempoLeitura < 1) {
    erro(`"tempoLeitura" tem de ser um número inteiro de minutos`);
  }

  // gray-matter entrega datas YAML como Date; o formato aceito é só AAAA-MM-DD, que ordena como texto.
  const bruta = dados.atualizadoEm;
  const atualizadoEm = bruta instanceof Date ? bruta.toISOString().slice(0, 10) : bruta;
  if (typeof atualizadoEm !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(atualizadoEm)) {
    erro(`"atualizadoEm" tem de ser AAAA-MM-DD`);
  }

  const resumo = dados.resumo;
  if (!Array.isArray(resumo) || resumo.length !== 3 || resumo.some((r) => typeof r !== "string" || !r.trim())) {
    erro(`"resumo" tem de ter exatamente 3 frases`);
  }

  const fontesBrutas = dados.fontes;
  if (!Array.isArray(fontesBrutas) || fontesBrutas.length === 0) erro(`"fontes" não pode ficar vazio`);
  const fontes: Fonte[] = (fontesBrutas as unknown[]).map((f, i) => {
    if (!f || typeof f !== "object") return erro(`fontes[${i}] inválida`);
    const { rotulo, url } = f as Record<string, unknown>;
    if (typeof rotulo !== "string" || !rotulo.trim()) return erro(`fontes[${i}] sem "rotulo"`);
    if (url !== undefined && (typeof url !== "string" || !/^https:\/\//.test(url))) {
      return erro(`fontes[${i}].url tem de começar com https://`);
    }
    return url === undefined ? { rotulo } : { rotulo, url };
  });

  const relacionados = dados.relacionados ?? [];
  if (!Array.isArray(relacionados) || relacionados.some((r) => typeof r !== "string")) {
    erro(`"relacionados" tem de ser uma lista de slugs`);
  }

  let ilustracao: Frontmatter["ilustracao"];
  if (dados.ilustracao !== undefined) {
    const i = dados.ilustracao as { linhas?: unknown; nota?: unknown };
    const linhasOk = Array.isArray(i?.linhas) && i.linhas.length === 2 && i.linhas.every((l) => typeof l === "string");
    if (!linhasOk || typeof i.nota !== "string") erro(`"ilustracao" precisa de linhas (2 textos) e nota`);
    ilustracao = { linhas: i.linhas as [string, string], nota: i.nota as string };
  }

  return {
    titulo: texto("titulo"),
    ...(typeof dados.tituloCurto === "string" && dados.tituloCurto.trim() && { tituloCurto: dados.tituloCurto.trim() }),
    subtitulo: texto("subtitulo"),
    categoria: categoria as Frontmatter["categoria"],
    slug,
    tempoLeitura: tempoLeitura as number,
    atualizadoEm: atualizadoEm as string,
    resumo: resumo as Frontmatter["resumo"],
    fontes,
    relacionados: relacionados as string[],
    ...(dados.destaque === true && { destaque: true }),
    ...(ilustracao && { ilustracao }),
  };
}
