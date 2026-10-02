import type { Asset } from "@prisma/client";
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../../shared/errors/AppError.js";
import { analisarDadosCvm, analisarRelatorio, perguntarAoRelatorio, type Analise } from "./gemini.js";
import { selecionarSecoesRelevantes } from "./trechos.js";
import type { AskInput, UploadInput } from "./reports.schemas.js";
import { reportsRepository } from "./reports.repository.js";
import { montarPagina, type PaginacaoInput } from "../../shared/paginacao.js";
import { quotesService } from "../quotes/quotes.service.js";
import { cnpjDoTicker } from "../assets/cnpj.js";
import { buscarDadosAcao, buscarDadosFii } from "./cvm.provider.js";
import { chaveDoPeriodo, detectarPeriodos, rotuloDoPeriodo } from "./periodo.js";
import {
  analiseSemIa,
  contextoParaIa,
  indicadoresCvm,
  tipoDocumentoCvm,
} from "./resumo-cvm.js";

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

// Páginas lidas para achar o período. A capa do release do BB diz "1T26" na
// primeira; a do MXRF11 diz "Maio de 2026" na primeira e repete na segunda.
const PAGINAS_DA_CAPA = 2;

export const MENSAGEM_CHAT_INDISPONIVEL =
  "O chat não está disponível para este relatório: a análise foi montada com os dados oficiais da CVM " +
  "e o texto do PDF não foi guardado. Para conversar sobre o documento, envie o PDF de novo sem informar o ativo.";

type DocumentoPdf = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * Roda uma leitura do PDF silenciando os avisos do pdf.js.
 *
 * A biblioteca imprime coisas como "Warning: TT: undefined function: 21" ao
 * interpretar programas de fontes TrueType que ela não reconhece. O aviso é
 * inofensivo — o texto sai completo mesmo assim —, mas assusta quem lê o log e
 * some no meio de erros de verdade. Um relatório de banco produz dezenas deles.
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
  const { text } = await semRuidoDePdf(() => extractText(pdf, { mergePages: true }));
  return text;
}

/** Texto só das primeiras páginas — o release de 301 páginas do BB não precisa ser lido inteiro para achar "1T26". */
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
 * Tenta montar a análise com os dados oficiais da CVM. Qualquer coisa que
 * falte — ativo desconhecido, sem CNPJ, classe sem documento na CVM, período
 * não detectado, documento ainda não publicado — devolve analise = null, e o
 * chamador segue para a leitura do PDF inteiro. Nunca lança.
 */
async function tentarViaCvm(pdf: DocumentoPdf, ticker: string): Promise<ResultadoCvm> {
  const resultado: ResultadoCvm = { asset: null, periodo: null, analise: null };

  try {
    resultado.asset = await quotesService.buscarOuCadastrar(ticker);
    const asset = resultado.asset;
    if (!asset) return resultado;

    // ETF e renda fixa não entregam ITR nem Informe Mensal de FII
    if (asset.type !== "ACAO" && asset.type !== "FII") return resultado;

    const cnpj = asset.cnpj ?? cnpjDoTicker(asset.ticker);
    if (!cnpj) return resultado;

    const { trimestre, mes } = detectarPeriodos(await extrairCapa(pdf));
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
    try {
      const daIa = await analisarDadosCvm(contextoParaIa(dados, rotulo));
      // A IA escreve o resumo e os alertas; tipo de documento e indicadores
      // são calculados aqui, direto dos números oficiais.
      resultado.analise = {
        ...daIa,
        tipoDocumento: tipoDocumentoCvm(dados, rotulo),
        indicadores: indicadoresCvm(dados),
      };
      // Só a análise com leitura da IA vai para o cache. A de template fica
      // de fora para que o próximo envio tente a IA de novo.
      await reportsRepository
        .saveCvmSummary(asset.id, resultado.periodo, resultado.analise)
        .catch((err: unknown) => console.error("[CVM] falha ao guardar o cache:", err));
    } catch (err) {
      console.error("[CVM] IA indisponível, usando o template:", err instanceof Error ? err.message : err);
      resultado.analise = analiseSemIa(dados, rotulo);
    }
    return resultado;
  } catch (err) {
    console.error("[CVM] caminho da CVM falhou, lendo o PDF inteiro:", err);
    return { ...resultado, analise: null };
  }
}

export const reportsService = {
  async analisar(
    userId: string,
    arquivo: { originalname: string; buffer: Buffer },
    input: UploadInput = {},
  ) {
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

    const pdf = await semRuidoDePdf(() => getDocumentProxy(new Uint8Array(arquivo.buffer)));

    // 1. com o ativo informado, o PDF só identifica o período e os números
    // vêm da CVM. Sem ativo, ou sem o documento na CVM, lê o PDF inteiro.
    const viaCvm = input.ticker
      ? await tentarViaCvm(pdf, input.ticker)
      : { asset: null, periodo: null, analise: null };

    if (viaCvm.analise && viaCvm.asset && viaCvm.periodo) {
      const relatorio = await reportsRepository.create({
        userId,
        fileName: arquivo.originalname,
        source: "CVM",
        assetId: viaCvm.asset.id,
        period: viaCvm.periodo,
        extractedText: null,
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

    // 2. extrai o texto do PDF inteiro
    const texto = (await extrairTexto(pdf)).trim();

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

    // 3. envia para o Gemini com structured outputs.
    // Documento grande é recortado antes: mandar 760 mil caracteres numa
    // tacada levava ~70s e queimava a cota de um minuto inteiro. O recorte
    // fica com as seções de maior densidade financeira, e o prompt avisa a
    // IA de que ela não recebeu o documento completo.
    const paraAnalise = selecionarSecoesRelevantes(texto, CONTEXTO_ANALISE);
    const analise = await analisarRelatorio(paraAnalise, paraAnalise.length < texto.length);

    // 4. persiste (o texto extraído alimenta o chat depois)
    const relatorio = await reportsRepository.create({
      userId,
      fileName: arquivo.originalname,
      source: "PDF",
      assetId: viaCvm.asset?.id ?? null,
      period: viaCvm.periodo,
      extractedText: texto,
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

    // Relatório da CVM não guardou o texto do PDF: não há o que consultar.
    // 409 e não 404 — o relatório existe, o que falta é o conteúdo do chat.
    if (relatorio.source === "CVM" || !relatorio.extractedText) {
      throw new AppError(MENSAGEM_CHAT_INDISPONIVEL, 409);
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
