import { createHash } from "node:crypto";
import type { Asset } from "@prisma/client";
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../../shared/errors/AppError.js";
import {
  analisarRelatorioDeterministico,
  analisarRelatorio,
  responderBuscaContextual,
  perguntarAoRelatorio,
  type Analise,
} from "./gemini.js";
import { selecionarTrechos } from "./trechos.js";
import type { AskInput, ConsultaCvmInput, UploadInput } from "./reports.schemas.js";
import { reportsRepository } from "./reports.repository.js";
import { montarPagina, type PaginacaoInput } from "../../shared/paginacao.js";
import { quotesService } from "../quotes/quotes.service.js";
import { cnpjDoTicker } from "../assets/cnpj.js";
import { buscarDadosAcao, buscarDadosFii } from "./cvm.provider.js";
import { chaveDoPeriodo, detectarPeriodos, detectarTicker, parsearPeriodo, rotuloDoPeriodo, type Periodo } from "./periodo.js";
import { analiseSemIa } from "./resumo-cvm.js";

// Releases trimestrais de banco passam de 300 páginas (o do Banco do Brasil
// tem 760 mil caracteres), então o limite precisa acomodar documentos grandes.
const LIMITE_CARACTERES = 2_000_000;

export const COTA_RELATORIOS = 50;

// Assinatura de arquivo PDF ("%PDF-"). O multer só confere o Content-Type
// declarado pelo cliente, que é forjável — isto confere o conteúdo de verdade
// antes de o buffer seguir para o parser.
const ASSINATURA_PDF = Buffer.from("%PDF-", "ascii");

function pareceUmPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, ASSINATURA_PDF.length).equals(ASSINATURA_PDF);
}

const TIMEOUT_PARSING_MS = 30_000;

async function comTimeout<T>(promessa: Promise<T>): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(
      () =>
        rejeitar(
          new AppError(
            `A leitura do PDF demorou mais de ${TIMEOUT_PARSING_MS / 1000}s. Tente outro arquivo.`,
            400,
          ),
        ),
      TIMEOUT_PARSING_MS,
    );
  });
  try {
    return await Promise.race([promessa, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

export const CONTEXTO_ANALISE = 30_000;

// Páginas lidas para achar o período.
const PAGINAS_DA_CAPA = 2;

export const MENSAGEM_CHAT_INDISPONIVEL =
  "O chat não está disponível para este relatório: o documento não possui texto extraído.";

type DocumentoPdf = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * Roda uma leitura do PDF silenciando os avisos do pdf.js.
 */
async function semRuidoDePdf<T>(leitura: () => Promise<T>): Promise<T> {
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
    return await leitura();
  } finally {
    console.warn = avisoOriginal;
    console.log = logOriginal;
  }
}

async function extrairTexto(pdf: DocumentoPdf): Promise<string> {
  const { text } = await comTimeout(semRuidoDePdf(() => extractText(pdf, { mergePages: true })));
  return text;
}

/** Texto só das primeiras páginas — o release de 301 páginas do BB não precisa ser lido inteiro para achar período e ticker. */
async function extrairCapa(pdf: DocumentoPdf): Promise<string> {
  try {
    return await semRuidoDePdf(async () => {
      const partes: string[] = [];
      for (let i = 1; i <= Math.min(PAGINAS_DA_CAPA, pdf.numPages); i++) {
        const conteudo = await (await pdf.getPage(i)).getTextContent();
        const itens = conteudo.items as { str?: string }[];
        partes.push(itens.map((item) => item.str ?? "").join(" "));
      }
      return partes.join("\n");
    });
  } catch {
    return "";
  }
}

type ResultadoCvm = {
  asset: Asset | null;
  periodo: string | null;
  analise: Analise | null;
};

/**
 * Monta a análise com os dados oficiais da CVM deterministicamente.
 */
async function tentarViaCvm(capa: string, ticker: string): Promise<ResultadoCvm> {
  const resultado: ResultadoCvm = { asset: null, periodo: null, analise: null };

  try {
    resultado.asset = await quotesService.buscarOuCadastrar(ticker);
    const asset = resultado.asset;
    if (!asset) return resultado;

    // ETF e renda fixa não entregam ITR nem Informe Mensal de FII
    if (asset.type !== "ACAO" && asset.type !== "FII") return resultado;

    const cnpj = asset.cnpj ?? cnpjDoTicker(asset.ticker);
    if (!cnpj) return resultado;

    const { trimestre, mes } = detectarPeriodos(capa);
    const periodo = asset.type === "ACAO" ? trimestre : mes;
    if (!periodo) return resultado;
    resultado.periodo = chaveDoPeriodo(periodo);

    const guardada = await reportsRepository.findCvmSummary(asset.id, resultado.periodo);
    if (guardada) {
      resultado.analise = guardada.analysis as Analise;
      return resultado;
    }

    const dados =
      periodo.tipo === "trimestre"
        ? await buscarDadosAcao(cnpj, periodo)
        : await buscarDadosFii(cnpj, periodo);
    if (!dados) return resultado;

    const rotulo = rotuloDoPeriodo(periodo);
    resultado.analise = analiseSemIa(dados, rotulo);

    await reportsRepository
      .saveCvmSummary(asset.id, resultado.periodo, resultado.analise)
      .catch((err: unknown) => console.error("[CVM] falha ao guardar o cache:", err));

    return resultado;
  } catch (err) {
    console.error("[CVM] caminho da CVM falhou:", err);
    return { ...resultado, analise: null };
  }
}

export const reportsService = {
  async analisar(
    userId: string,
    arquivo: { originalname: string; buffer: Buffer },
    input: UploadInput = {},
  ) {
    const guardados = await reportsRepository.countByUser(userId);
    if (guardados >= COTA_RELATORIOS) {
      throw new AppError(
        `Você atingiu o limite de ${COTA_RELATORIOS} relatórios guardados. ` +
          `Apague algum em /reports antes de analisar outro.`,
        429,
      );
    }

    if (!pareceUmPdf(arquivo.buffer)) {
      throw new AppError("O arquivo enviado não é um PDF válido", 400);
    }

    const contentHash = createHash("sha256").update(arquivo.buffer).digest("hex");

    const pdf = await comTimeout(
      semRuidoDePdf(() => getDocumentProxy(new Uint8Array(arquivo.buffer))),
    );

    // Extrair capa do PDF para detectar período e ticker (se não informado)
    const capa = await extrairCapa(pdf);
    const tickerIdentificado =
      input.ticker ?? detectarTicker(arquivo.originalname) ?? detectarTicker(capa);

    // Tentar via CVM se houver ticker identificado
    const viaCvm = tickerIdentificado
      ? await tentarViaCvm(capa, tickerIdentificado)
      : { asset: null, periodo: null, analise: null };

    if (viaCvm.analise && viaCvm.asset && viaCvm.periodo) {
      // Mesmo com CVM, guardamos o texto extraído do PDF para a ferramenta de busca no documento funcionar!
      let textoPdf: string | null = null;
      try {
        textoPdf = (await extrairTexto(pdf)).trim();
      } catch {
        textoPdf = null;
      }

      const relatorio = await reportsRepository.create({
        userId,
        fileName: arquivo.originalname,
        source: "CVM",
        assetId: viaCvm.asset.id,
        period: viaCvm.periodo,
        extractedText: textoPdf,
        contentHash,
        analysis: viaCvm.analise,
      });

      return {
        id: relatorio.id,
        fileName: relatorio.fileName,
        source: relatorio.source,
        period: relatorio.period,
        asset: { ticker: viaCvm.asset.ticker },
        createdAt: relatorio.createdAt,
        analysis: viaCvm.analise,
      };
    }

    // 2. Se o mesmo arquivo já foi analisado antes, reaproveita análise e texto
    const anterior = await reportsRepository.findPdfByContentHash(contentHash);
    let texto: string;
    let analise: Analise;

    if (anterior?.extractedText && anterior.analysis) {
      texto = anterior.extractedText;
      analise = anterior.analysis as Analise;
    } else {
      texto = (await extrairTexto(pdf)).trim();
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
      analise = await analisarRelatorio(texto);
    }

    // 3. Persiste
    const relatorio = await reportsRepository.create({
      userId,
      fileName: arquivo.originalname,
      source: "PDF",
      assetId: viaCvm.asset?.id ?? null,
      period: viaCvm.periodo,
      extractedText: texto,
      contentHash,
      analysis: analise,
    });

    return {
      id: relatorio.id,
      fileName: relatorio.fileName,
      source: relatorio.source,
      period: relatorio.period,
      asset: viaCvm.asset ? { ticker: viaCvm.asset.ticker } : null,
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

    if (!relatorio.extractedText) {
      throw new AppError(MENSAGEM_CHAT_INDISPONIVEL, 409);
    }

    // Busca contextual e destaques no documento via trechos.ts (sem IA externa)
    const resposta = await perguntarAoRelatorio(
      relatorio.fileName,
      relatorio.extractedText,
      // o askSchema preenche um pelo outro; o "" só satisfaz o tipo
      input.question ?? input.termo ?? "",
    );

    return { answer: resposta };
  },


  async analisarDiretoCvm(userId: string, input: ConsultaCvmInput) {
    const guardados = await reportsRepository.countByUser(userId);
    if (guardados >= COTA_RELATORIOS) {
      throw new AppError(
        `Você atingiu o limite de ${COTA_RELATORIOS} relatórios guardados. ` +
          `Apague algum em /reports antes de analisar outro.`,
        429,
      );
    }

    const asset = await quotesService.buscarOuCadastrar(input.ticker);
    if (!asset) {
      throw new AppError(`Ativo ${input.ticker} não encontrado`, 404);
    }

    if (asset.type !== "ACAO" && asset.type !== "FII") {
      throw new AppError("Apenas ações e fundos imobiliários possuem demonstrações na CVM", 400);
    }

    const cnpj = asset.cnpj ?? cnpjDoTicker(asset.ticker);
    if (!cnpj) {
      throw new AppError(`CNPJ não disponível para o ativo ${asset.ticker}`, 400);
    }

    let periodo: Periodo | null = null;
    if (input.periodo) {
      periodo = parsearPeriodo(input.periodo);
      if (!periodo) {
        throw new AppError("Formato de período inválido. Use AAAA-T1 a T4, 1T26 ou AAAA-MM", 400);
      }
    } else {
      const hoje = new Date();
      const anoHoje = hoje.getFullYear();
      const mesHoje = hoje.getMonth() + 1;
      if (asset.type === "ACAO") {
        let tri = Math.floor((mesHoje - 1) / 3);
        let ano = anoHoje;
        if (tri === 0) {
          tri = 4;
          ano = anoHoje - 1;
        }
        periodo = { tipo: "trimestre", ano, trimestre: tri as 1 | 2 | 3 | 4 };
      } else {
        let mes = mesHoje - 1;
        let ano = anoHoje;
        if (mes === 0) {
          mes = 12;
          ano = anoHoje - 1;
        }
        periodo = { tipo: "mes", ano, mes };
      }
    }

    const chave = chaveDoPeriodo(periodo);
    const rotulo = rotuloDoPeriodo(periodo);

    const guardada = await reportsRepository.findCvmSummary(asset.id, chave);
    let analise: Analise | null = guardada ? (guardada.analysis as Analise) : null;

    if (!analise) {
      const dados =
        periodo.tipo === "trimestre"
          ? await buscarDadosAcao(cnpj, periodo)
          : await buscarDadosFii(cnpj, periodo);

      if (!dados) {
        throw new AppError(
          `Não foram encontrados dados na CVM para ${asset.ticker} no período ${rotulo}.`,
          404,
        );
      }

      analise = analiseSemIa(dados, rotulo);

      await reportsRepository
        .saveCvmSummary(asset.id, chave, analise)
        .catch((err: unknown) => console.error("[CVM] falha ao guardar o cache:", err));
    }

    const fileName = `${asset.ticker}_CVM_${chave}.pdf`;
    const relatorio = await reportsRepository.create({
      userId,
      fileName,
      source: "CVM",
      assetId: asset.id,
      period: chave,
      extractedText: null,
      analysis: analise,
    });

    return {
      id: relatorio.id,
      fileName: relatorio.fileName,
      source: relatorio.source,
      period: relatorio.period,
      asset: { ticker: asset.ticker },
      createdAt: relatorio.createdAt,
      analysis: analise,
    };
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


