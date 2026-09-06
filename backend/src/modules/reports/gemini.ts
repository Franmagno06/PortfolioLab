import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { selecionarTrechos } from "./trechos.js";

// Integração com a API do Gemini (Google).
// Cliente único, criado sob demanda — e com erro amigável se faltar a chave.

let cliente: GoogleGenAI | null = null;

// Teto do que o chat manda de relatório por pergunta. O release trimestral do
// Banco do Brasil tem 760 mil caracteres: mandá-lo inteiro custava ~217 mil
// tokens POR PERGUNTA e estourava o limite por minuto da API — a segunda
// pergunta seguida já voltava com "limite de uso atingido". 40 mil caracteres
// (~11 mil tokens) cabem com folga e carregam os trechos que respondem.
const CONTEXTO_CHAT = 40_000;

// O SDK tenta 5 vezes com espera crescente quando a API recusa. Diante de um
// 429 por cota estourada isso é inútil: a cota não volta em segundos, e o
// usuário esperava 136s por um erro que a API já tinha dado em 9s — pior, o
// timeout de 120s cortava antes e culpava a demora, escondendo a causa real.
// Duas tentativas cobrem a falha passageira de rede sem insistir no que não
// tem conserto imediato.
const TENTATIVAS = 2;


// A API às vezes demora sem devolver erro. Sem teto, a requisição do usuário
// fica pendurada até o navegador desistir, e o servidor segue esperando.
const TIMEOUT_MS = 120_000;

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

  console.error("[falha na API de IA]", err);
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
- NUNCA recomende comprar, vender ou manter um ativo, e não projete preço-alvo. O PortfolioLab é educacional e não presta consultoria de investimento. Analisar o desempenho reportado é o trabalho; indicar decisão de investimento, não.
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
- NUNCA recomende comprar, vender ou manter, e não projete preço-alvo. O PortfolioLab é educacional e não presta consultoria de investimento.
- O trecho recebido pode ser um recorte do relatório, selecionado pela pergunta. Se o que foi perguntado parece estar noutra parte do documento, diga que não consta no trecho disponível em vez de deduzir.`;

export async function analisarRelatorio(
  textoDoRelatorio: string,
  recortado = false,
): Promise<Analise> {
  let saida: string | undefined;

  try {
    const interacao = await comTimeout(
      clienteGemini().interactions.create({
        model: env.GEMINI_MODEL,
        system_instruction: PROMPT_ANALISTA,
        input:
          `Analise o relatório a seguir e produza o resumo executivo, os alertas e os indicadores citados.\n\n` +
          `<relatorio${recortado ? ' recorte="true"' : ""}>\n${textoDoRelatorio}\n</relatorio>`,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: ESQUEMA_ANALISE,
        },
      }),
      "analisar o relatório",
    );
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
  // inteiro; o release de 760 mil caracteres vira 40 mil.
  const trecho = selecionarTrechos(textoDoRelatorio, pergunta, CONTEXTO_CHAT);
  const recortado = trecho.length < textoDoRelatorio.length;

  try {
    const interacao = await comTimeout(
      clienteGemini().interactions.create({
        model: env.GEMINI_MODEL,
        system_instruction:
          `${PROMPT_CHAT}\n\n<relatorio arquivo="${fileName}"${recortado ? ' recorte="true"' : ""}>\n` +
          `${trecho}\n</relatorio>`,
        input: [...historico.map((m) => passo(m.content, m.role)), passo(pergunta, "user")],
      }),
      "responder à pergunta",
    );

    return interacao.output_text ?? "Não consegui responder a essa pergunta.";
  } catch (err) {
    traduzirErro(err);
  }
}
