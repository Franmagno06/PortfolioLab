import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

// Integração com a API do Claude (Anthropic).
// Cliente único, criado sob demanda — e com erro amigável se faltar a chave.

let cliente: Anthropic | null = null;

function clienteClaude(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(
      "IA não configurada: defina ANTHROPIC_API_KEY no backend/.env (crie sua chave em console.anthropic.com)",
      503,
    );
  }
  cliente ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cliente;
}

export type Analise = {
  tipoDocumento: string;
  resumoExecutivo: string[];
  alertas: { titulo: string; severidade: "info" | "atencao" | "critico"; detalhe: string }[];
  indicadores: { nome: string; valor: string }[];
};

// JSON Schema para structured outputs: a API GARANTE que a resposta
// respeita este formato — sem parsing frágil de texto livre
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
        additionalProperties: false,
      },
    },
    indicadores: {
      type: "array",
      description: "Indicadores citados no documento com seus valores (DY, P/VP, vacância...)",
      items: {
        type: "object",
        properties: { nome: { type: "string" }, valor: { type: "string" } },
        required: ["nome", "valor"],
        additionalProperties: false,
      },
    },
  },
  required: ["tipoDocumento", "resumoExecutivo", "alertas", "indicadores"],
  additionalProperties: false,
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
  const resposta = await clienteClaude().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: ESQUEMA_ANALISE as Record<string, unknown> },
    },
    system: PROMPT_ANALISTA,
    messages: [
      {
        role: "user",
        content: `Analise o relatório a seguir e produza o resumo executivo, os alertas e os indicadores citados.\n\n<relatorio>\n${textoDoRelatorio}\n</relatorio>`,
      },
    ],
  });

  if (resposta.stop_reason === "refusal") {
    throw new AppError("A análise foi recusada pelos filtros de segurança do modelo", 502);
  }

  const blocoTexto = resposta.content.find((b) => b.type === "text");
  if (!blocoTexto || blocoTexto.type !== "text") {
    throw new AppError("A IA não retornou uma análise válida", 502);
  }

  // structured outputs garante JSON válido no formato do schema
  return JSON.parse(blocoTexto.text) as Analise;
}

export async function perguntarAoRelatorio(
  fileName: string,
  textoDoRelatorio: string,
  pergunta: string,
  historico: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const resposta = await clienteClaude().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: PROMPT_CHAT },
      {
        type: "text",
        text: `<relatorio arquivo="${fileName}">\n${textoDoRelatorio}\n</relatorio>`,
        // prompt caching: o relatório (a parte pesada) fica em cache entre
        // as perguntas — leituras de cache custam ~10% do preço normal
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [...historico, { role: "user", content: pergunta }],
  });

  if (resposta.stop_reason === "refusal") {
    throw new AppError("A pergunta foi recusada pelos filtros de segurança do modelo", 502);
  }

  const blocoTexto = resposta.content.find((b) => b.type === "text");
  return blocoTexto && blocoTexto.type === "text"
    ? blocoTexto.text
    : "Não consegui responder a essa pergunta.";
}
