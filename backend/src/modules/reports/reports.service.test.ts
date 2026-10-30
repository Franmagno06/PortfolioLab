import { createHash } from "node:crypto";
import { Prisma, type Asset } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../../shared/errors/AppError.js";
import { reportsRepository } from "./reports.repository.js";
import {
  COTA_RELATORIOS,
  MENSAGEM_CHAT_INDISPONIVEL,
  reportsService,
} from "./reports.service.js";
import { buscarDadosAcao, buscarDadosFii, type DadosAcao } from "./cvm.provider.js";
import { quotesService } from "../quotes/quotes.service.js";
import { analiseSemIa } from "./resumo-cvm.js";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn().mockResolvedValue({}),
  extractText: vi.fn().mockResolvedValue({ text: "" }),
}));

vi.mock("./cvm.provider.js", () => ({
  buscarDadosAcao: vi.fn().mockResolvedValue(null),
  buscarDadosFii: vi.fn().mockResolvedValue(null),
}));

vi.mock("../quotes/quotes.service.js", () => ({
  quotesService: { buscarOuCadastrar: vi.fn() },
}));

function comRelatoriosGuardados(quantidade: number) {
  return vi.spyOn(reportsRepository, "countByUser").mockResolvedValue(quantidade);
}

const arquivoQualquer = { originalname: "irrelevante.pdf", buffer: Buffer.from("%PDF-") };

const statusDe = async (userId: string) =>
  reportsService
    .analisar(userId, arquivoQualquer)
    .then(() => undefined)
    .catch((e: AppError) => e.statusCode);

beforeEach(() => {
  vi.spyOn(reportsRepository, "findPdfByContentHash").mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cota de relatórios por usuário", () => {
  it("recusa com 429 quem já está na cota", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS);
    expect(await statusDe("usuario-qualquer")).toBe(429);
  });

  it("recusa também quem passou da cota", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS + 10);
    expect(await statusDe("usuario-qualquer")).toBe(429);
  });

  it("a mensagem diz o que fazer para voltar a analisar", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS);
    await expect(
      reportsService.analisar("usuario-qualquer", arquivoQualquer),
    ).rejects.toThrow(/apag/i);
  });

  it("quem está um abaixo da cota passa pela checagem", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS - 1);
    expect(await statusDe("usuario-qualquer")).not.toBe(429);
  });

  it("a cota é contada por usuário", async () => {
    const espia = comRelatoriosGuardados(0);
    await statusDe("usuario-especifico");
    expect(espia).toHaveBeenCalledWith("usuario-especifico");
  });
});

describe("extração de texto do PDF", () => {
  it("recusa PDF sem texto extraível com 400", async () => {
    comRelatoriosGuardados(0);
    vi.mocked(extractText).mockResolvedValueOnce({ text: "   " } as Awaited<
      ReturnType<typeof extractText>
    >);
    expect(await statusDe("usuario-qualquer")).toBe(400);
  });

  it("recusa texto maior que o limite de caracteres com 400", async () => {
    comRelatoriosGuardados(0);
    vi.mocked(extractText).mockResolvedValueOnce({ text: "a".repeat(2_000_001) } as Awaited<
      ReturnType<typeof extractText>
    >);
    expect(await statusDe("usuario-qualquer")).toBe(400);
  });

  it("processa o texto extraído deterministicamente e persiste a análise", async () => {
    comRelatoriosGuardados(0);
    const textoRelatorio = "Relatório Gerencial do Fundo. A distribuição de rendimentos no mês foi de R$ 0,85 por cota.";
    vi.mocked(extractText).mockResolvedValueOnce({ text: textoRelatorio } as Awaited<
      ReturnType<typeof extractText>
    >);
    const criar = vi.spyOn(reportsRepository, "create").mockResolvedValue({
      id: "relatorio-1",
      userId: "usuario-qualquer",
      fileName: arquivoQualquer.originalname,
      extractedText: textoRelatorio,
      analysis: {},
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof reportsRepository.create>>);

    const resultado = await reportsService.analisar("usuario-qualquer", arquivoQualquer);

    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usuario-qualquer",
        extractedText: textoRelatorio,
      }),
    );
    expect(resultado.analysis.tipoDocumento).toBe("Relatório Gerencial de FII");
    expect(resultado.analysis.resumoExecutivo.length).toBeGreaterThan(0);
  });
});

describe("mesmo PDF enviado de novo", () => {
  const pdfDeTeste = { originalname: "MXRF11-maio.pdf", buffer: Buffer.from("%PDF-1.7 conteúdo") };
  const hashReal = () => createHash("sha256").update(pdfDeTeste.buffer).digest("hex");

  function espiarCreate() {
    return vi.spyOn(reportsRepository, "create").mockImplementation(((
      data: Parameters<typeof reportsRepository.create>[0],
    ) => Promise.resolve({ ...data, id: "novo", createdAt: new Date() })) as unknown as typeof reportsRepository.create);
  }

  it("reaproveita análise e texto sem reler o PDF", async () => {
    comRelatoriosGuardados(0);
    const busca = vi.spyOn(reportsRepository, "findPdfByContentHash").mockResolvedValue({
      extractedText: "texto já extraído",
      analysis: { tipoDocumento: "da vez anterior", resumoExecutivo: [], alertas: [], indicadores: [] },
    });
    const criar = espiarCreate();
    vi.mocked(extractText).mockClear();

    const r = await reportsService.analisar("outra-conta", pdfDeTeste);

    expect(busca).toHaveBeenCalledWith(hashReal());
    expect(extractText).not.toHaveBeenCalled();
    expect(r.analysis.tipoDocumento).toBe("da vez anterior");
    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "outra-conta",
        extractedText: "texto já extraído",
        contentHash: hashReal(),
      }),
    );
  });

  it("PDF inédito guarda o hash para o próximo envio", async () => {
    comRelatoriosGuardados(0);
    vi.mocked(extractText).mockResolvedValueOnce({ text: "conteúdo novo sobre Fundo Imobiliário" } as Awaited<
      ReturnType<typeof extractText>
    >);
    const criar = espiarCreate();

    await reportsService.analisar("u1", pdfDeTeste);

    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ contentHash: hashReal() }));
  });

  it("arquivos diferentes não se confundem", async () => {
    comRelatoriosGuardados(0);
    const busca = vi.spyOn(reportsRepository, "findPdfByContentHash").mockResolvedValue(null);
    espiarCreate();
    const comTexto = { text: "conteúdo de fundo" } as Awaited<ReturnType<typeof extractText>>;
    vi.mocked(extractText).mockResolvedValueOnce(comTexto).mockResolvedValueOnce(comTexto);

    await reportsService.analisar("u1", { originalname: "a.pdf", buffer: Buffer.from("%PDF- versão 1") });
    await reportsService.analisar("u1", { originalname: "a.pdf", buffer: Buffer.from("%PDF- versão 2") });

    const [primeiro, segundo] = busca.mock.calls.map(([hash]) => hash);
    expect(primeiro).not.toBe(segundo);
  });
});

describe("arquivo que não é PDF", () => {
  it("recusa com 400 pelo conteúdo, mesmo com nome .pdf, sem abrir o parser", async () => {
    comRelatoriosGuardados(0);
    vi.mocked(getDocumentProxy).mockClear();

    const erro = await reportsService
      .analisar("u1", { originalname: "falso.pdf", buffer: Buffer.from("<html>não sou pdf</html>") })
      .catch((e: AppError) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).statusCode).toBe(400);
    expect(getDocumentProxy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Relatório via CVM: o PDF identifica o período, os números vêm da CVM
// ---------------------------------------------------------------------------

const BBAS3 = {
  id: "asset-bbas3",
  ticker: "BBAS3",
  name: "Banco do Brasil",
  type: "ACAO",
  sector: null,
  currentPrice: new Prisma.Decimal(20),
  priceUpdatedAt: new Date(),
  cnpj: "00.000.000/0001-91",
} satisfies Asset;

const DADOS_ITR: DadosAcao = {
  tipo: "ACAO",
  denominacao: "BCO BRASIL S.A.",
  documento: "ITR",
  dataReferencia: "2026-03-31",
  consolidado: true,
  resultado: [
    {
      codigo: "3.01",
      conta: "Receitas de Intermediação Financeira",
      atual: new Prisma.Decimal("78452578000"),
      anterior: new Prisma.Decimal("71720089000"),
    },
    {
      codigo: "3.11",
      conta: "Lucro Líquido Consolidado",
      atual: new Prisma.Decimal("9000000000"),
      anterior: new Prisma.Decimal("8000000000"),
    },
  ],
  balanco: [
    {
      codigo: "1",
      conta: "Ativo Total",
      atual: new Prisma.Decimal("2000000000000"),
      anterior: new Prisma.Decimal("1900000000000"),
    },
    {
      codigo: "2.03",
      conta: "Patrimônio Líquido",
      atual: new Prisma.Decimal("180000000000"),
      anterior: new Prisma.Decimal("170000000000"),
    },
  ],
  link: null,
};

function pdfCom(capa: string, completo = "texto completo do relatório") {
  vi.mocked(getDocumentProxy).mockResolvedValue({
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: [{ str: capa }] }) }),
  } as unknown as Awaited<ReturnType<typeof getDocumentProxy>>);
  vi.mocked(extractText).mockResolvedValue({ text: completo } as Awaited<ReturnType<typeof extractText>>);
}

function espiarCreate() {
  return vi.spyOn(reportsRepository, "create").mockImplementation(((
    data: Parameters<typeof reportsRepository.create>[0],
  ) =>
    Promise.resolve({ ...data, id: "relatorio-cvm", createdAt: new Date() })) as unknown as typeof reportsRepository.create);
}

const arquivo = { originalname: "BBAS3-1T26.pdf", buffer: Buffer.from("%PDF-") };

describe("relatório com ativo informado ou autodetectado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comRelatoriosGuardados(0);
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValue(BBAS3);
    vi.spyOn(reportsRepository, "findCvmSummary").mockResolvedValue(null);
    vi.spyOn(reportsRepository, "saveCvmSummary").mockResolvedValue(
      {} as Awaited<ReturnType<typeof reportsRepository.saveCvmSummary>>,
    );
  });

  it("período detectado e documento na CVM: gera análise determinística oficial CVM", async () => {
    pdfCom("Análise do Desempenho 1T26");
    vi.mocked(buscarDadosAcao).mockResolvedValueOnce(DADOS_ITR);
    const criar = espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(buscarDadosAcao).toHaveBeenCalledWith("00.000.000/0001-91", {
      tipo: "trimestre",
      ano: 2026,
      trimestre: 1,
    });
    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "CVM",
        period: "2026-T1",
        assetId: "asset-bbas3",
        extractedText: "texto completo do relatório",
      }),
    );
    expect(r.source).toBe("CVM");
    expect(r.analysis.resumoExecutivo[0]).toContain("Análise Fundamentalista Oficial CVM");
    expect(r.analysis.indicadores).toEqual(
      expect.arrayContaining([
        { nome: "Receitas de Intermediação Financeira", valor: "R$ 78,45 bi (+9,4%)" },
      ]),
    );
    expect(reportsRepository.saveCvmSummary).toHaveBeenCalledWith("asset-bbas3", "2026-T1", r.analysis);
  });

  it("autodetecta ticker pelo nome do arquivo se não fornecido no input", async () => {
    pdfCom("Release 1T26");
    vi.mocked(buscarDadosAcao).mockResolvedValueOnce(DADOS_ITR);
    espiarCreate();

    const r = await reportsService.analisar("u1", { originalname: "relatorio_BBAS3_1T26.pdf", buffer: Buffer.from("%PDF-") });

    expect(quotesService.buscarOuCadastrar).toHaveBeenCalledWith("BBAS3");
    expect(r.source).toBe("CVM");
  });

  it("análise já em cache: não baixa da CVM", async () => {
    pdfCom("Análise do Desempenho 1T26");
    const guardada = { tipoDocumento: "cache", resumoExecutivo: [], alertas: [], indicadores: [] };
    vi.mocked(reportsRepository.findCvmSummary).mockResolvedValueOnce({
      analysis: guardada,
    } as unknown as Awaited<ReturnType<typeof reportsRepository.findCvmSummary>>);
    espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(r.analysis).toEqual(guardada);
    expect(buscarDadosAcao).not.toHaveBeenCalled();
  });

  it("fallback: sem período na capa, analisa o PDF via unpdf/trechos", async () => {
    pdfCom("Relatório Geral de Atividades", "Texto completo do relatório de atividades da companhia.");
    const criar = espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "PDF",
        period: null,
        assetId: "asset-bbas3",
        extractedText: "Texto completo do relatório de atividades da companhia.",
      }),
    );
    expect(r.source).toBe("PDF");
  });

  it("fallback: CVM ainda não tem o documento do período", async () => {
    pdfCom("Release de Resultados 2T26", "Texto completo do release trimestral.");
    vi.mocked(buscarDadosAcao).mockResolvedValueOnce(null);
    const criar = espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(buscarDadosAcao).toHaveBeenCalled();
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ source: "PDF", period: "2026-T2" }));
    expect(r.source).toBe("PDF");
  });

  it("fallback: ETF não tem documento na CVM", async () => {
    pdfCom("Relatório mensal março de 2026", "Texto do fundo de índice.");
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValueOnce({
      ...BBAS3,
      ticker: "BOVA11",
      type: "ETF",
      cnpj: null,
    });
    espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BOVA11" });

    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(buscarDadosFii).not.toHaveBeenCalled();
    expect(r.source).toBe("PDF");
  });

  it("fallback: ticker que não existe segue sem ativo", async () => {
    pdfCom("1T26", "Relatório de empresa sem cotação cadastrada.");
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValueOnce(null);
    const criar = espiarCreate();

    await reportsService.analisar("u1", { originalname: "arquivo.pdf", buffer: Buffer.from("%PDF-") }, { ticker: "XPTO3" });

    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ source: "PDF", assetId: null }));
  });

  it("FII usa o mês da capa e o Informe Mensal", async () => {
    pdfCom("Relatório Gerencial Maio de 2026");
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValueOnce({
      ...BBAS3,
      id: "asset-mxrf11",
      ticker: "MXRF11",
      type: "FII",
      cnpj: "97.521.225/0001-25",
    });
    espiarCreate();

    await reportsService.analisar("u1", arquivo, { ticker: "MXRF11" });

    expect(buscarDadosFii).toHaveBeenCalledWith("97.521.225/0001-25", { tipo: "mes", ano: 2026, mes: 5 });
  });

  it("sem ticker nem no input nem no arquivo: analisa o PDF diretamente", async () => {
    pdfCom("1T26", "Relatório sem nenhuma menção a código de negociação.");
    espiarCreate();

    const r = await reportsService.analisar("u1", { originalname: "documento_sem_ticker.pdf", buffer: Buffer.from("%PDF-") });

    expect(quotesService.buscarOuCadastrar).not.toHaveBeenCalled();
    expect(r.source).toBe("PDF");
  });
});

describe("chat e busca contextual do relatório", () => {
  const relatorio = {
    id: "r1",
    userId: "u1",
    assetId: "asset-bbas3",
    fileName: "x.pdf",
    period: "2026-T1",
    contentHash: null,
    analysis: {},
    createdAt: new Date(),
  };

  it("recusa com 409 quando o relatório não tiver texto extraído", async () => {
    vi.spyOn(reportsRepository, "findByIdAndUser").mockResolvedValueOnce({
      ...relatorio,
      source: "CVM",
      extractedText: null,
    });

    const erro = await reportsService
      .ask("u1", "r1", { question: "qual o lucro?", history: [] })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(AppError);
    expect((erro as AppError).statusCode).toBe(409);
    expect((erro as AppError).message).toBe(MENSAGEM_CHAT_INDISPONIVEL);
  });

  it("responde com busca contextual no documento sem IA externa", async () => {
    const textoDoc = "O lucro líquido contábil somou R$ 9,2 bilhões, crescimento de 12% no trimestre.";
    vi.spyOn(reportsRepository, "findByIdAndUser").mockResolvedValueOnce({
      ...relatorio,
      source: "CVM",
      extractedText: textoDoc,
    });

    const r = await reportsService.ask("u1", "r1", { question: "qual o lucro líquido?", history: [] });

    expect(r.answer).toContain("Busca Contextual no Documento");
    expect(r.answer).toContain("lucro líquido");
  });
  it("responde busca contextual quando chamado com campo termo em vez de question", async () => {
    const textoDoc = "A vacância financeira do fundo encerrou o período em 4,2%.";
    vi.spyOn(reportsRepository, "findByIdAndUser").mockResolvedValueOnce({
      ...relatorio,
      source: "PDF",
      extractedText: textoDoc,
    });

    const r = await reportsService.ask("u1", "r1", { termo: "vacância", history: [] });

    expect(r.answer).toContain("Busca Contextual no Documento");
    expect(r.answer).toContain("vacância");
  });
});

describe("reportsService.analisarDiretoCvm", () => {
  it("recusa com 429 quando atinge a cota de relatórios guardados", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS);

    await expect(
      reportsService.analisarDiretoCvm("u1", { ticker: "BBAS3" }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it("recusa com 404 quando o ativo não existe", async () => {
    comRelatoriosGuardados(0);
    vi.spyOn(quotesService, "buscarOuCadastrar").mockResolvedValueOnce(null);

    await expect(
      reportsService.analisarDiretoCvm("u1", { ticker: "INEXISTENTE" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("gera análise direta da CVM aproveitando resumo em cache", async () => {
    comRelatoriosGuardados(0);
    const mockAsset = {
      id: "asset-bbas3",
      ticker: "BBAS3",
      type: "ACAO",
      cnpj: "00.000.000/0001-91",
    } as any;
    vi.spyOn(quotesService, "buscarOuCadastrar").mockResolvedValueOnce(mockAsset);

    const analiseMock = {
      tipoDocumento: "ITR",
      resumoExecutivo: ["Lucro em alta"],
      alertas: [],
      indicadores: [],
    };
    vi.spyOn(reportsRepository, "findCvmSummary").mockResolvedValueOnce({
      id: "cvm-1",
      assetId: mockAsset.id,
      period: "2026-T1",
      analysis: analiseMock as any,
      createdAt: new Date(),
    });

    vi.spyOn(reportsRepository, "create").mockImplementationOnce(async (data: any) => ({
      id: "rep-123",
      ...data,
      createdAt: new Date(),
    }));

    const res = await reportsService.analisarDiretoCvm("u1", { ticker: "BBAS3", periodo: "2026-T1" });

    expect(res.source).toBe("CVM");
    expect(res.period).toBe("2026-T1");
    expect(res.asset?.ticker).toBe("BBAS3");
    expect(res.analysis).toEqual(analiseMock);
  });
});
