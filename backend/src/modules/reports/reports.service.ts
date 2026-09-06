import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../../shared/errors/AppError.js";
import { analisarRelatorio, perguntarAoRelatorio, type Analise } from "./gemini.js";
import { selecionarSecoesRelevantes } from "./trechos.js";
import type { AskInput } from "./reports.schemas.js";
import { reportsRepository } from "./reports.repository.js";
import { montarPagina, type PaginacaoInput } from "../../shared/paginacao.js";

// Releases trimestrais de banco passam de 300 páginas (o do Banco do Brasil
// tem 760 mil caracteres), então o limite precisa acomodar documentos grandes.
// ~2 milhões de caracteres ≈ 570 mil tokens — dentro da janela do modelo,
// mas ainda barra arquivos absurdos.
const LIMITE_CARACTERES = 2_000_000;

// Achado 8: cada análise custa cota paga do Gemini e cada relatório guardado
// carrega o texto inteiro do PDF no banco. A cota limita os dois de uma vez.
export const COTA_RELATORIOS = 50;

// Teto do que a análise inicial manda para a IA. O release trimestral do Banco
// do Brasil tem 760 mil caracteres: mandado inteiro levava ~70s e consumia a
// cota de um minuto inteiro numa tacada. 150 mil (~43 mil tokens) cobrem as
// seções de resultado com folga.
const CONTEXTO_ANALISE = 150_000;

/**
 * Extrai o texto do PDF silenciando os avisos do pdf.js.
 *
 * A biblioteca imprime coisas como "Warning: TT: undefined function: 21" ao
 * interpretar programas de fontes TrueType que ela não reconhece. O aviso é
 * inofensivo — o texto sai completo mesmo assim —, mas assusta quem lê o log e
 * some no meio de erros de verdade. Um relatório de banco produz dezenas deles.
 */
async function extrairTexto(buffer: Buffer): Promise<string> {
  const avisoOriginal = console.warn;
  const logOriginal = console.log;
  const ehRuidoDePdf = (args: unknown[]) =>
    typeof args[0] === "string" && /^Warning: TT:/.test(args[0]);

  console.warn = (...args: unknown[]) => {
    if (!ehRuidoDePdf(args)) avisoOriginal(...args);
  };
  console.log = (...args: unknown[]) => {
    if (!ehRuidoDePdf(args)) logOriginal(...args);
  };

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } finally {
    console.warn = avisoOriginal;
    console.log = logOriginal;
  }
}

export const reportsService = {
  async analisar(userId: string, arquivo: { originalname: string; buffer: Buffer }) {
    // 0. a checagem mais barata primeiro: nem lê o PDF, nem chama a IA.
    // Entre esta contagem e o create lá embaixo há uma janela em que uploads
    // simultâneos passam juntos — escolha consciente: o limitadorRelatorios
    // (20/h por usuário) contém o estrago, e uma transação aqui seguraria a
    // conexão durante a chamada à IA, que é a parte lenta.
    const guardados = await reportsRepository.countByUser(userId);
    if (guardados >= COTA_RELATORIOS) {
      throw new AppError(
        `Você atingiu o limite de ${COTA_RELATORIOS} relatórios guardados. ` +
          `Apague algum em /reports antes de analisar outro.`,
        429,
      );
    }

    // 1. extrai o texto do PDF
    const texto = (await extrairTexto(arquivo.buffer)).trim();

    if (!texto) {
      throw new AppError(
        "Não foi possível extrair texto deste PDF — ele pode ser digitalizado como imagem",
        400,
      );
    }
    if (texto.length > LIMITE_CARACTERES) {
      throw new AppError(
        `Relatório muito grande para análise: ${texto.length.toLocaleString("pt-BR")} caracteres (limite de ${LIMITE_CARACTERES.toLocaleString("pt-BR")}).`,
        400,
      );
    }

    // 2. envia para o Gemini com structured outputs.
    // Documento grande é recortado antes: mandar 760 mil caracteres numa
    // tacada levava ~70s e queimava a cota de um minuto inteiro. O recorte
    // fica com as seções de maior densidade financeira, e o prompt avisa a
    // IA de que ela não recebeu o documento completo.
    const paraAnalise = selecionarSecoesRelevantes(texto, CONTEXTO_ANALISE);
    const analise = await analisarRelatorio(paraAnalise, paraAnalise.length < texto.length);

    // 3. persiste (o texto extraído alimenta o chat depois)
    const relatorio = await reportsRepository.create({
      userId,
      fileName: arquivo.originalname,
      extractedText: texto,
      analysis: analise,
    });

    return {
      id: relatorio.id,
      fileName: relatorio.fileName,
      createdAt: relatorio.createdAt,
      analysis: analise,
    };
  },

  async list(userId: string, { limite, cursor }: PaginacaoInput) {
    const linhas = await reportsRepository.findManyByUser(userId, {
      take: limite + 1,
      ...(cursor ? { cursor } : {}),
    });
    return montarPagina(linhas, limite);
  },

  async ask(userId: string, reportId: string, input: AskInput) {
    const relatorio = await reportsRepository.findByIdAndUser(reportId, userId);
    if (!relatorio) {
      throw new AppError("Relatório não encontrado", 404);
    }

    const resposta = await perguntarAoRelatorio(
      relatorio.fileName,
      relatorio.extractedText,
      input.question,
      input.history,
    );

    return { answer: resposta };
  },

  async remove(userId: string, reportId: string) {
    const relatorio = await reportsRepository.findByIdAndUser(reportId, userId);
    if (!relatorio) {
      throw new AppError("Relatório não encontrado", 404);
    }
    await reportsRepository.delete(reportId);
  },
};

export type { Analise };
