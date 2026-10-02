import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { selecionarTrechos } from "./trechos.js";

// Integração com a API do Gemini (Google).
// Cliente único, criado sob demanda — e com erro amigável se faltar a chave.

let cliente: GoogleGenAI | null = null;

// Teto do que o chat manda de relatório por pergunta. O release trimestral do
// Banco do Brasil tem 760 mil caracteres: mandá-lo inteiro custava ~217 mil
// tokens POR PERGUNTA e estourava o limite por minuto da API.
//
// O teto anterior, 40 mil caracteres, foi estimado em ~11 mil tokens. Medido
// com o countTokens (scripts/medir-tokens-relatorios.ts), texto financeiro
// cheio de números sai a ~0,6 token por caractere: eram ~25 mil tokens por
// pergunta. 12 mil caracteres (~7 mil tokens no pior caso) ainda carregam os
// seis blocos que mais citam os termos da pergunta.
export const CONTEXTO_CHAT = 12_000;

// O histórico vem do navegador e viaja inteiro em toda pergunta: a décima
// pergunta pagava pelas nove anteriores e por todas as respostas. Só as
// últimas trocas dão contexto útil, e cada mensagem antiga é truncada. Cortar
// aqui, e não no cliente, porque o servidor é quem paga o token.
export const HISTORICO_MAX_MENSAGENS = 6;
export const HISTORICO_MAX_CHARS = 1_500;

// Quanto o modelo "pensa" antes de responder. Pensamento é token de saída
// cobrado e conta no limite por minuto. Medido com uma pergunta trivial:
// "low" gastou 58 tokens pensando, "minimal" gastou 0.
// A análise inicial é leitura crítica de um documento (o que mudou, o que
// preocupa) e se beneficia de algum raciocínio; o chat localiza um número num
// trecho já recortado, e não precisa.
const RACIOCINIO_ANALISE = "low";
const RACIOCINIO_CHAT = "minimal";

// Teto de saída, incluindo o pensamento. Não é a meta, é a trava: um resumo
// de 5 a 8 tópicos com alertas e indicadores cabe em ~1.500 tokens. Sem teto,
// uma resposta descontrolada poderia gerar dezenas de milhares.
const SAIDA_MAX_ANALISE = 4_096;
const SAIDA_MAX_CHAT = 1_024;

// O SDK tenta 5 vezes com espera crescente quando a API recusa. Diante de um
// 429 por cota estourada isso é inútil: a cota não volta em segundos, e o
// usuário esperava 136s por um erro que a API já tinha dado em 9s — pior, o
// timeout de 120s cortava antes e culpava a demora, escondendo a causa real.
// Duas tentativas cobrem a falha passageira de rede sem insistir no que não
// tem conserto imediato.
const TENTATIVAS = 2;


// A API às vezes demora sem devolver erro. Sem teto, a requisição do usuário
// fica pendurada até o navegador desistir, e o servidor segue esperando.
//
// 240s, e não 120s: a análise completa gera saída estruturada longa — resumo,
// alertas e indicadores — e isso custa tempo de geração, não de leitura.
// Medido no relatório do MXRF11 com gemini-3.6-flash: 87,9s de média, com
// picos acima de 120s que o teto anterior cortava. Falhar uma análise que
// ia responder é pior do que esperar mais.
const TIMEOUT_MS = 240_000;

/** Aborta a chamada à IA se ela passar do tempo, com erro explicável. */
async function comTimeout<T>(promessa: Promise<T>, oQue: string): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(
      () =>
        rejeitar(
          new AppError(
            `A IA demorou mais de ${TIMEOUT_MS / 1000}s para ${oQue}. Tente novamente em instantes.`,
            504,
          ),
        ),
      TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promessa, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

function clienteGemini(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      "IA não configurada: defina GEMINI_API_KEY no backend/.env (crie sua chave em aistudio.google.com/apikey)",
      503,
    );
  }
  cliente ??= new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: { retryOptions: { attempts: TENTATIVAS } },
  });
  return cliente;
}

/**
 * Traduz falhas da API de IA em erros com mensagem útil.
 * Sem isto, um 401 de chave inválida virava um genérico "Erro interno do servidor".
 */
function traduzirErro(err: unknown): never {
  // O timeout já é um AppError com mensagem própria: repassar em vez de
  // reembrulhar em "Falha ao consultar a IA".
  if (err instanceof AppError) throw err;

  const mensagem = err instanceof Error ? err.message : String(err);

  if (/401|API key not valid|API_KEY_INVALID|unauthenticated/i.test(mensagem)) {
    throw new AppError(
      "A chave da IA é inválida. Confira GEMINI_API_KEY no backend/.env (gere uma em aistudio.google.com/apikey).",
      502,
    );
  }
  if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(mensagem)) {
    throw new AppError(
      "Limite de uso da IA atingido. Aguarde alguns minutos e tente novamente.",
      502,
    );
  }
  if (/permission|PERMISSION_DENIED|403/i.test(mensagem)) {
    throw new AppError(
      "A chave da IA não tem permissão para usar este modelo. Verifique o modelo em GEMINI_MODEL.",
      502,
    );
  }
  // Sobrecarga do lado do Google, não cota nossa: nada foi cobrado e a mesma
  // requisição passa minutos depois. Sem esta regra, o usuário lia o 503 cru,
  // em inglês, e não tinha como distinguir de "limite de uso atingido".
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(mensagem)) {
    console.warn("[IA] modelo sobrecarregado no Google:", mensagem);
    throw new AppError(
      "O serviço de IA do Google está sobrecarregado agora. Nada foi cobrado; tente de novo em alguns minutos.",
      503,
    );
  }

  // só a mensagem: o objeto de erro do SDK tem ~150 linhas de cabeçalhos HTTP
  console.error("[falha na API de IA]", mensagem);
  throw new AppError(`Falha ao consultar a IA: ${mensagem}`, 502);
}

export type Analise = {
  tipoDocumento: string;
  resumoExecutivo: string[];
  alertas: { titulo: string; severidade: "info" | "atencao" | "critico"; detalhe: string }[];
  indicadores: { nome: string; valor: string }[];
};

// Schema de saída: o Gemini GARANTE um JSON que obedece a este formato,
// então não precisamos de parsing frágil de texto livre
const ESQUEMA_ANALISE = {
  type: "object",
  properties: {
    tipoDocumento: {
      type: "string",
      description: "Ex: 'Relatório gerencial de FII', 'Release de resultados trimestral'",
    },
    resumoExecutivo: {
      type: "array",
      items: { type: "string" },
      description: "5 a 8 tópicos objetivos — leitura de no máximo 1 minuto",
    },
    alertas: {
      type: "array",
      description:
        "Pontos de atenção: vacância, emissões de cotas, alavancagem, mudança nos dividendos, inadimplência, desinvestimentos",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          severidade: { type: "string", enum: ["info", "atencao", "critico"] },
          detalhe: { type: "string" },
        },
        required: ["titulo", "severidade", "detalhe"],
      },
    },
    indicadores: {
      type: "array",
      description: "Indicadores citados no documento com seus valores (DY, P/VP, vacância...)",
      items: {
        type: "object",
        properties: { nome: { type: "string" }, valor: { type: "string" } },
        required: ["nome", "valor"],
      },
    },
  },
  required: ["tipoDocumento", "resumoExecutivo", "alertas", "indicadores"],
};

const PROMPT_ANALISTA = `Você é analista de investimentos sênior do PortfolioLab, com experiência em renda variável e fundos imobiliários da B3. Escreve para o comitê de análise: gente que entende do assunto e tem pouco tempo.

Como trabalhar:
- Leia o documento como um analista profissional leria: o que mudou em relação ao período anterior, o que explica a mudança, e o que isso pressiona adiante.
- Priorize o material: lucro e sua composição, margem, alavancagem, qualidade do crédito ou da carteira de imóveis, geração de caixa, distribuição a acionistas ou cotistas, e mudanças de guidance.
- Sempre que houver variação relevante, dê o número e a base de comparação (trimestre anterior, mesmo trimestre do ano passado).
- Use o vocabulário técnico correto e preciso. Na primeira ocorrência de uma sigla, abra o significado entre parênteses uma vez, e depois use a sigla.
- Separe fato de leitura: quando apontar uma consequência, deixe claro que é leitura sua sobre o número, não algo escrito no documento.

Limites que não se negociam:
- NUNCA recomende comprar, vender ou manter um ativo, e não projete preço-alvo. Analisar o desempenho reportado é o trabalho; indicar decisão de investimento, não.
- Não encha o texto de ressalva institucional. O limite acima é seu, não do leitor: cumpra-o em silêncio, sem declarar em cada tópico que isto não é recomendação.
- Nunca invente número. Valores e percentuais saem exatamente como aparecem no documento.
- Se o documento não traz algo relevante que você esperaria encontrar, diga que não consta — a ausência é informação.
- Quando o relatório vier marcado com recorte="true", você recebeu as seções de maior densidade financeira, não o documento completo. Trabalhe com o que está ali e não afirme que algo não existe no relatório — apenas que não consta no trecho recebido.`;

const PROMPT_CHAT = `Você é analista de investimentos sênior do PortfolioLab respondendo a perguntas sobre um relatório que acabou de ler.

Como responder:
- Use APENAS o conteúdo do relatório fornecido. Se a resposta não está nele, diga isso — não complete com conhecimento geral sobre a empresa.
- Comece pela resposta. Contexto e ressalva vêm depois, se couberem.
- Cite o número exato do documento e a base de comparação sempre que houver.
- Vocabulário técnico correto; abra a sigla na primeira vez que usá-la.
- De 1 a 3 parágrafos. Sem saudação e sem repetir a pergunta.

Limites que não se negociam:
- NUNCA recomende comprar, vender ou manter, e não projete preço-alvo.
- Não repita aviso institucional em toda resposta. A interface já informa que o conteúdo é educacional, e um analista não fecha cada parágrafo com ressalva jurídica. Mencione o limite apenas quando a pergunta pedir recomendação — aí sim, diga que não cabe a você indicar decisão de investimento e ofereça a leitura dos números.
- O trecho recebido pode ser um recorte do relatório, selecionado pela pergunta. Se o que foi perguntado parece estar noutra parte do documento, diga que não consta no trecho disponível em vez de deduzir.`;

export async function analisarRelatorio(
  textoDoRelatorio: string,
  recortado = false,
): Promise<Analise> {
  return gerarAnalise(
    `Analise o relatório a seguir e produza o resumo executivo, os alertas e os indicadores citados.\n\n` +
      `<relatorio${recortado ? ' recorte="true"' : ""}>\n${textoDoRelatorio}\n</relatorio>`,
  );
}

/**
 * Análise a partir dos números oficiais entregues à CVM (ITR, DFP ou Informe
 * Mensal de FII). O PDF enviado só identificou o período; o que a IA lê aqui
 * são as demonstrações, já formatadas e com a base de comparação — bem menos
 * texto que o relatório inteiro, e sem número extraído errado do PDF.
 */
export async function analisarDadosCvm(dadosFormatados: string): Promise<Analise> {
  return gerarAnalise(
    `Analise as demonstrações oficiais a seguir, entregues pela empresa à CVM, e produza o resumo executivo, os alertas e os indicadores. ` +
      `Elas trazem apenas números: comentário da administração, guidance e dados operacionais não constam.\n\n` +
      `<relatorio fonte="CVM">\n${dadosFormatados}\n</relatorio>`,
  );
}

type Consumo = {
  total_input_tokens?: number | undefined;
  total_thought_tokens?: number | undefined;
  total_output_tokens?: number | undefined;
  total_tokens?: number | undefined;
};

/**
 * Uma linha de log por chamada, com o que ela custou. Sem medir não há como
 * saber se um ajuste de teto economizou de verdade — foi assim que se
 * descobriu que a estimativa antiga errava pela metade.
 */
function registrarConsumo(oQue: string, consumo: Consumo | undefined) {
  if (!consumo) return;
  console.info(
    `[IA] ${oQue}: ${consumo.total_input_tokens ?? "?"} de entrada, ` +
      `${consumo.total_thought_tokens ?? 0} pensando, ` +
      `${consumo.total_output_tokens ?? "?"} de saída — ${consumo.total_tokens ?? "?"} no total`,
  );
}

/** Só as últimas mensagens, cada uma truncada — ver HISTORICO_MAX_*. */
export function enxugarHistorico<T extends { content: string }>(historico: T[]): T[] {
  return historico.slice(-HISTORICO_MAX_MENSAGENS).map((m) =>
    m.content.length > HISTORICO_MAX_CHARS
      ? { ...m, content: `${m.content.slice(0, HISTORICO_MAX_CHARS)} [...]` }
      : m,
  );
}

async function gerarAnalise(input: string): Promise<Analise> {
  let saida: string | undefined;

  try {
    const interacao = await comTimeout(
      clienteGemini().interactions.create({
        model: env.GEMINI_MODEL,
        system_instruction: PROMPT_ANALISTA,
        input,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: ESQUEMA_ANALISE,
        },
        generation_config: {
          thinking_level: RACIOCINIO_ANALISE,
          max_output_tokens: SAIDA_MAX_ANALISE,
        },
      }),
      "analisar o relatório",
    );
    registrarConsumo("análise", interacao.usage);
    saida = interacao.output_text;
  } catch (err) {
    traduzirErro(err);
  }

  if (!saida) {
    throw new AppError("A IA não retornou uma análise válida", 502);
  }

  try {
    return JSON.parse(saida) as Analise;
  } catch {
    throw new AppError("A IA retornou uma análise em formato inesperado", 502);
  }
}

export async function perguntarAoRelatorio(
  fileName: string,
  textoDoRelatorio: string,
  pergunta: string,
  historico: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  // Esta versão da API usa "steps": cada turno é um user_input ou um
  // model_output (o equivalente ao "assistant" de outras APIs)
  const passo = (texto: string, deQuem: "user" | "assistant") =>
    deQuem === "assistant"
      ? { type: "model_output" as const, content: [{ type: "text" as const, text: texto }] }
      : { type: "user_input" as const, content: [{ type: "text" as const, text: texto }] };

  // Só os trechos que respondem à pergunta viajam. Documento pequeno passa
  // inteiro; o release de 760 mil caracteres vira 12 mil.
  const trecho = selecionarTrechos(textoDoRelatorio, pergunta, CONTEXTO_CHAT);
  const recortado = trecho.length < textoDoRelatorio.length;

  try {
    const interacao = await comTimeout(
      clienteGemini().interactions.create({
        model: env.GEMINI_MODEL,
        system_instruction:
          `${PROMPT_CHAT}\n\n<relatorio arquivo="${fileName}"${recortado ? ' recorte="true"' : ""}>\n` +
          `${trecho}\n</relatorio>`,
        input: [
          ...enxugarHistorico(historico).map((m) => passo(m.content, m.role)),
          passo(pergunta, "user"),
        ],
        generation_config: {
          thinking_level: RACIOCINIO_CHAT,
          max_output_tokens: SAIDA_MAX_CHAT,
        },
      }),
      "responder à pergunta",
    );
    registrarConsumo("pergunta", interacao.usage);

    return interacao.output_text ?? "Não consegui responder a essa pergunta.";
  } catch (err) {
    traduzirErro(err);
  }
}
