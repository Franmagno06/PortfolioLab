import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../../shared/errors/AppError.js";
import { analisarRelatorio, perguntarAoRelatorio, type Analise } from "./gemini.js";
import type { AskInput } from "./reports.schemas.js";
import { reportsRepository } from "./reports.repository.js";

// Releases trimestrais de banco passam de 300 páginas (o do Banco do Brasil
// tem 760 mil caracteres), então o limite precisa acomodar documentos grandes.
// ~2 milhões de caracteres ≈ 570 mil tokens — dentro da janela do modelo,
// mas ainda barra arquivos absurdos.
const LIMITE_CARACTERES = 2_000_000;

// Achado 8: cada análise custa cota paga do Gemini e cada relatório guardado
// carrega o texto inteiro do PDF no banco. A cota limita os dois de uma vez.
export const COTA_RELATORIOS = 50;

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
    const pdf = await getDocumentProxy(new Uint8Array(arquivo.buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const texto = text.trim();

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

    // 2. envia para o Claude com structured outputs
    const analise = await analisarRelatorio(texto);

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

  list(userId: string) {
    return reportsRepository.findManyByUser(userId);
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
