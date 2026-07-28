import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

// Integração com a API do Gemini (Google).
// Cliente único, criado sob demanda — e com erro amigável se faltar a chave.

let cliente: GoogleGenAI | null = null;

function clienteGemini(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      "IA não configurada: defina GEMINI_API_KEY no backend/.env (crie sua chave em aistudio.google.com/apikey)",
      503,
    );
  }
  cliente ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return cliente;
}

/**
 * Traduz falhas da API de IA em erros com mensagem útil.
 * Sem isto, um 401 de chave inválida virava um genérico "Erro interno do servidor".
 */
function traduzirErro(err: unknown): never {
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

const PROMPT_ANALISTA = `Você é o analista educacional do PortfolioLab, uma plataforma de aprendizado para investidores iniciantes no Brasil.
Sua função é explicar relatórios financeiros de forma didática e honesta.
Regras:
- Linguagem simples, sem jargão — quando usar um termo técnico, explique entre parênteses.
- NUNCA recomende compra ou venda de ativos. Você informa e educa, não aconselha.
- Alertas devem ser baseados apenas no que está escrito no documento, sem especulação.
- Valores e percentuais devem ser citados exatamente como aparecem no documento.`;

const PROMPT_CHAT = `Você é o assistente "Pergunte ao Relatório" do PortfolioLab (plataforma educacional para investidores iniciantes no Brasil).
Responda perguntas usando APENAS o conteúdo do relatório fornecido.
Regras:
- Se a resposta não está no relatório, diga isso claramente — não invente.
- Linguagem simples e didática; explique termos técnicos entre parênteses.
- NUNCA recomende compra ou venda de ativos.
- Respostas curtas e diretas (1 a 3 parágrafos).`;

export async function analisarRelatorio(textoDoRelatorio: string): Promise<Analise> {
  let saida: string | undefined;

  try {
    const interacao = await clienteGemini().interactions.create({
      model: env.GEMINI_MODEL,
      system_instruction: PROMPT_ANALISTA,
      input: `Analise o relatório a seguir e produza o resumo executivo, os alertas e os indicadores citados.\n\n<relatorio>\n${textoDoRelatorio}\n</relatorio>`,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: ESQUEMA_ANALISE,
      },
    });
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

  try {
    const interacao = await clienteGemini().interactions.create({
      model: env.GEMINI_MODEL,
      system_instruction: `${PROMPT_CHAT}\n\n<relatorio arquivo="${fileName}">\n${textoDoRelatorio}\n</relatorio>`,
      input: [...historico.map((m) => passo(m.content, m.role)), passo(pergunta, "user")],
    });

    return interacao.output_text ?? "Não consegui responder a essa pergunta.";
  } catch (err) {
    traduzirErro(err);
  }
}
