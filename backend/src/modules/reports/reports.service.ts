import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../../shared/errors/AppError.js";
import { analisarRelatorio, perguntarAoRelatorio, type Analise } from "./gemini.js";
import type { AskInput } from "./reports.schemas.js";
import { reportsRepository } from "./reports.repository.js";

// ~150 mil tokens — bem dentro da janela de 1M do modelo, mas evita custos surpresa
const LIMITE_CARACTERES = 600_000;

export const reportsService = {
  async analisar(userId: string, arquivo: { originalname: string; buffer: Buffer }) {
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
      throw new AppError("Relatório muito grande para análise (limite de ~600 mil caracteres)", 400);
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
