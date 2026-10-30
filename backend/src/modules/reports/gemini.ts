import { selecionarSecoesRelevantes, selecionarTrechos } from "./trechos.js";

export type Analise = {
  tipoDocumento: string;
  resumoExecutivo: string[];
  alertas: { titulo: string; severidade: "info" | "atencao" | "critico"; detalhe: string }[];
  indicadores: { nome: string; valor: string }[];
};

export const CONTEXTO_CHAT = 4_000;
export const HISTORICO_MAX_MENSAGENS = 6;
export const HISTORICO_MAX_CHARS = 1_500;

/** Só as últimas mensagens, cada uma truncada */
export function enxugarHistorico<T extends { content: string }>(historico: T[]): T[] {
  return historico.slice(-HISTORICO_MAX_MENSAGENS).map((m) =>
    m.content.length > HISTORICO_MAX_CHARS
      ? { ...m, content: `${m.content.slice(0, HISTORICO_MAX_CHARS)} [...]` }
      : m,
  );
}

/**
 * Análise determinística direta de PDF extraído via unpdf/trechos.
 * Extrai tipo do documento, destaques como resumo executivo, alertas e indicadores citados.
 */
export function analisarRelatorioDeterministico(
  textoDoRelatorio: string,
  nomeArquivo?: string,
): Analise {
  const recorte = selecionarSecoesRelevantes(textoDoRelatorio, 15_000);
  const linhas = recorte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20 && !l.startsWith("[...]"));

  // Detectar tipo de documento
  let tipoDocumento = "Relatório Financeiro";
  if (/informe\s+mensal/i.test(textoDoRelatorio)) {
    tipoDocumento = "Informe Mensal de FII";
  } else if (/relat[oó]rio\s+gerencial/i.test(textoDoRelatorio)) {
    tipoDocumento = "Relatório Gerencial de FII";
  } else if (/demonstra[cç][oõ]es\s+financeiras|itr|dfp/i.test(textoDoRelatorio)) {
    tipoDocumento = "Demonstrações Financeiras";
  } else if (/release|desempenho/i.test(textoDoRelatorio)) {
    tipoDocumento = "Release de Resultados";
  }

  // Resumo executivo a partir dos primeiros parágrafos informativos mais ricos
  const resumoExecutivo: string[] = [];
  resumoExecutivo.push(`Documento processado: ${nomeArquivo ?? tipoDocumento}.`);
  for (const linha of linhas) {
    if (resumoExecutivo.length >= 6) break;
    // Evita cabeçalhos curtos ou linhas repetidas
    if (!resumoExecutivo.some((r) => r.includes(linha.slice(0, 30)))) {
      resumoExecutivo.push(linha.endsWith(".") ? linha : `${linha}.`);
    }
  }

  // Indicadores citados no documento
  const indicadores: Analise["indicadores"] = [];
  const padroesIndicadores = [
    { nome: "Dividend Yield", regex: /(?:dividend\s+yield|dy)(?:\s*(?:de|do\s+m[eê]s|anualizado))?\s*[:=]?\s*([0-9]+[.,][0-9]+\s*%)/i },
    { nome: "P/VP", regex: /(?:p\/vp|p\/vpa)(?:\s*(?:de|fechou\s+em|em))?\s*[:=]?\s*([0-9]+[.,][0-9]+)/i },
    { nome: "Vacância Financeira", regex: /vac[aâ]ncia\s+financeira(?:\s*(?:de|em))?\s*[:=]?\s*([0-9]+[.,][0-9]+\s*%)/i },
    { nome: "Vacância Física", regex: /vac[aâ]ncia\s+f[ií]sica(?:\s*(?:de|em))?\s*[:=]?\s*([0-9]+[.,][0-9]+\s*%)/i },
    { nome: "ROE", regex: /\broe\b(?:\s*(?:de|em))?\s*[:=]?\s*([0-9]+[.,][0-9]+\s*%)/i },
    { nome: "Margem Líquida", regex: /margem\s+l[ií]quida(?:\s*(?:de|em))?\s*[:=]?\s*([0-9]+[.,][0-9]+\s*%)/i },
    { nome: "Patrimônio Líquido", regex: /patrim[oô]nio\s+l[ií]quido(?:\s*(?:de|em))?\s*[:=]?\s*(R\$\s*[0-9.,]+(?:\s*(?:mi|bi|milhões|bilhões))?)/i },
  ];

  for (const { nome, regex } of padroesIndicadores) {
    const match = textoDoRelatorio.match(regex);
    if (match && match[1]) {
      indicadores.push({ nome, valor: match[1].trim() });
    }
  }

  // Alertas determinísticos no documento
  const alertas: Analise["alertas"] = [];
  if (/preju[ií]zo/i.test(textoDoRelatorio)) {
    alertas.push({
      titulo: "Menção a prejuízo contábil",
      severidade: "critico",
      detalhe: "O documento contém termos associados a prejuízo ou resultado contábil negativo.",
    });
  }
  if (/inadimpl[eê]ncia/i.test(textoDoRelatorio)) {
    alertas.push({
      titulo: "Menção a inadimplência",
      severidade: "atencao",
      detalhe: "Foram identificadas passagens tratando de inadimplência de locatários ou devedores.",
    });
  }
  if (/emiss[aã]o\s+de\s+cotas|subscri[cç][aã]o/i.test(textoDoRelatorio)) {
    alertas.push({
      titulo: "Emissão de cotas ou subscrição",
      severidade: "info",
      detalhe: "O relatório cita processos recentes ou em andamento de oferta ou subscrição de cotas.",
    });
  }

  return {
    tipoDocumento,
    resumoExecutivo,
    alertas,
    indicadores,
  };
}

/**
 * Resposta contextual de busca e destaques no documento, sem IA externa.
 */
export function responderBuscaContextual(
  fileName: string,
  textoDoRelatorio: string,
  pergunta: string,
): string {
  const trechos = selecionarTrechos(textoDoRelatorio, pergunta, CONTEXTO_CHAT);

  if (!trechos || trechos.trim().length === 0) {
    return `### Busca Contextual: "${pergunta}"\n\nNenhuma ocorrência relevante encontrada no documento \`${fileName}\`.`;
  }

  return [
    `### Busca Contextual no Documento: "${pergunta}"`,
    `*Arquivo consultado:* \`${fileName}\``,
    "",
    "#### Trechos e dados mais relevantes identificados:",
    trechos,
  ].join("\n");
}

// Wrappers para compatibilidade reversa
export const analisarRelatorio = async (texto: string) => analisarRelatorioDeterministico(texto);
export const analisarDadosCvm = async (_dadosFormatados: string) => {
  throw new Error("analisarDadosCvm não deve ser chamada: motor agora é 100% determinístico via resumo-cvm.ts");
};
export const perguntarAoRelatorio = async (
  fileName: string,
  texto: string,
  pergunta: string,
  _historico?: unknown,
) => responderBuscaContextual(fileName, texto, pergunta);
