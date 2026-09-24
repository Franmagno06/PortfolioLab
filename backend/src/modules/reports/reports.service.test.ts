import { Prisma, type Asset } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { analisarDadosCvm, analisarRelatorio, perguntarAoRelatorio } from "./gemini.js";
import { AppError } from "../../shared/errors/AppError.js";
import { reportsRepository } from "./reports.repository.js";
import { COTA_RELATORIOS, MENSAGEM_CHAT_INDISPONIVEL, reportsService } from "./reports.service.js";
import { buscarDadosAcao, buscarDadosFii, type DadosAcao } from "./cvm.provider.js";
import { quotesService } from "../quotes/quotes.service.js";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn().mockResolvedValue({}),
  extractText: vi.fn().mockResolvedValue({ text: "" }),
}));

vi.mock("./gemini.js", () => ({
  analisarRelatorio: vi.fn().mockResolvedValue({
    tipoDocumento: "Relatório de teste",
    resumoExecutivo: ["ponto 1"],
    alertas: [],
    indicadores: [],
  }),
  analisarDadosCvm: vi.fn().mockResolvedValue({
    tipoDocumento: "o que a IA disser",
    resumoExecutivo: ["leitura da IA sobre os números da CVM"],
    alertas: [],
    indicadores: [{ nome: "número inventado", valor: "999" }],
  }),
  perguntarAoRelatorio: vi.fn().mockResolvedValue("resposta"),
}));

vi.mock("./cvm.provider.js", () => ({
  buscarDadosAcao: vi.fn().mockResolvedValue(null),
  buscarDadosFii: vi.fn().mockResolvedValue(null),
}));

vi.mock("../quotes/quotes.service.js", () => ({
  quotesService: { buscarOuCadastrar: vi.fn() },
}));

// Achado 8: além do teto por requisição, uma cota de relatórios ARMAZENADOS por
// usuário. A cota é uma comparação de inteiro — não precisa de banco para ser
// provada, e neste repositório *.service.test.ts significa teste puro
// (cf. portfolio.service.test.ts). O que a suíte precisa saber é quantos
// relatórios o usuário tem; de onde esse número vem é problema do repository.
function comRelatoriosGuardados(quantidade: number) {
  return vi.spyOn(reportsRepository, "countByUser").mockResolvedValue(quantidade);
}

/** Buffer irrelevante: a cota é conferida antes de qualquer leitura dele. */
const arquivoQualquer = { originalname: "irrelevante.pdf", buffer: Buffer.from("") };

const statusDe = async (userId: string) =>
  reportsService
    .analisar(userId, arquivoQualquer)
    .then(() => undefined)
    .catch((e: AppError) => e.statusCode);

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

    // segue o fluxo e falha adiante, no PDF vazio — o que importa é não ser 429
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

  it("envia o texto extraído para a IA e persiste a análise", async () => {
    comRelatoriosGuardados(0);
    vi.mocked(extractText).mockResolvedValueOnce({ text: "conteúdo do relatório" } as Awaited<
      ReturnType<typeof extractText>
    >);
    const criar = vi.spyOn(reportsRepository, "create").mockResolvedValue({
      id: "relatorio-1",
      userId: "usuario-qualquer",
      fileName: arquivoQualquer.originalname,
      extractedText: "conteúdo do relatório",
      analysis: {},
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof reportsRepository.create>>);

    const resultado = await reportsService.analisar("usuario-qualquer", arquivoQualquer);

    // false = documento pequeno, foi inteiro; a IA não precisa se precaver
    expect(vi.mocked(analisarRelatorio)).toHaveBeenCalledWith("conteúdo do relatório", false);
    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usuario-qualquer",
        extractedText: "conteúdo do relatório",
      }),
    );
    expect(resultado.analysis.tipoDocumento).toBe("Relatório de teste");
  });

  it("recorta o documento grande antes de mandar para a IA, e avisa que recortou", async () => {
    // O release trimestral do Banco do Brasil tem 760 mil caracteres. Mandado
    // inteiro, custa ~217 mil tokens e queima a cota de um minuto.
    comRelatoriosGuardados(0);
    const gigante = "O lucro liquido somou R$ 3,4 bilhoes, queda de 53,5%. ".repeat(20_000);
    vi.mocked(extractText).mockResolvedValueOnce({ text: gigante } as Awaited<
      ReturnType<typeof extractText>
    >);
    vi.spyOn(reportsRepository, "create").mockResolvedValue({
      id: "relatorio-2",
      userId: "usuario-qualquer",
      fileName: arquivoQualquer.originalname,
      extractedText: gigante,
      analysis: {},
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof reportsRepository.create>>);

    await reportsService.analisar("usuario-qualquer", arquivoQualquer);

    const [enviado, recortado] = vi.mocked(analisarRelatorio).mock.calls.at(-1) ?? [];
    expect(recortado).toBe(true);
    expect(enviado?.length).toBeLessThanOrEqual(150_000);
    expect(enviado?.length).toBeLessThan(gigante.length);
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
  ],
  balanco: [],
  link: null,
};

/** PDF cuja primeira página diz `capa` e cujo texto completo é `completo`. */
function pdfCom(capa: string, completo = "texto completo do relatório") {
  vi.mocked(getDocumentProxy).mockResolvedValueOnce({
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: [{ str: capa }] }) }),
  } as unknown as Awaited<ReturnType<typeof getDocumentProxy>>);
  vi.mocked(extractText).mockResolvedValueOnce({ text: completo } as Awaited<ReturnType<typeof extractText>>);
}

function espiarCreate() {
  // devolve o que recebeu, como o banco devolveria a linha criada
  return vi.spyOn(reportsRepository, "create").mockImplementation(((
    data: Parameters<typeof reportsRepository.create>[0],
  ) =>
    Promise.resolve({ ...data, id: "relatorio-cvm", createdAt: new Date() })) as unknown as typeof reportsRepository.create);
}

const arquivo = { originalname: "BBAS3-1T26.pdf", buffer: Buffer.from("") };

describe("relatório com ativo informado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comRelatoriosGuardados(0);
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValue(BBAS3);
    vi.spyOn(reportsRepository, "findCvmSummary").mockResolvedValue(null);
    vi.spyOn(reportsRepository, "saveCvmSummary").mockResolvedValue(
      {} as Awaited<ReturnType<typeof reportsRepository.saveCvmSummary>>,
    );
  });

  it("período detectado e documento na CVM: analisa os números oficiais sem ler o PDF inteiro", async () => {
    pdfCom("Análise do Desempenho 1T26");
    vi.mocked(buscarDadosAcao).mockResolvedValueOnce(DADOS_ITR);
    const criar = espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(buscarDadosAcao).toHaveBeenCalledWith("00.000.000/0001-91", {
      tipo: "trimestre",
      ano: 2026,
      trimestre: 1,
    });
    expect(analisarDadosCvm).toHaveBeenCalledWith(expect.stringContaining("R$ 78,45 bi"));
    expect(analisarRelatorio).not.toHaveBeenCalled();
    expect(extractText).not.toHaveBeenCalled();
    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "CVM",
        period: "2026-T1",
        assetId: "asset-bbas3",
        extractedText: null,
      }),
    );
    expect(r.source).toBe("CVM");
    // o texto é da IA; os indicadores saem do cálculo, nunca da IA
    expect(r.analysis.resumoExecutivo).toEqual(["leitura da IA sobre os números da CVM"]);
    expect(r.analysis.indicadores).toEqual([
      { nome: "Receitas de Intermediação Financeira", valor: "R$ 78,45 bi (+9,4%)" },
    ]);
    expect(reportsRepository.saveCvmSummary).toHaveBeenCalledWith("asset-bbas3", "2026-T1", r.analysis);
  });

  it("análise já em cache: não baixa da CVM nem chama a IA", async () => {
    pdfCom("Análise do Desempenho 1T26");
    const guardada = { tipoDocumento: "cache", resumoExecutivo: [], alertas: [], indicadores: [] };
    vi.mocked(reportsRepository.findCvmSummary).mockResolvedValueOnce({
      analysis: guardada,
    } as unknown as Awaited<ReturnType<typeof reportsRepository.findCvmSummary>>);
    espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(r.analysis).toEqual(guardada);
    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(analisarDadosCvm).not.toHaveBeenCalled();
  });

  it("IA fora do ar: entrega os números da CVM por template, sem guardar no cache", async () => {
    pdfCom("Análise do Desempenho 1T26");
    vi.mocked(buscarDadosAcao).mockResolvedValueOnce(DADOS_ITR);
    vi.mocked(analisarDadosCvm).mockRejectedValueOnce(new AppError("IA não configurada", 503));
    espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(r.source).toBe("CVM");
    expect(r.analysis.indicadores[0]?.valor).toBe("R$ 78,45 bi (+9,4%)");
    expect(r.analysis.alertas.map((a) => a.titulo)).toContain("Resumo sem leitura da IA");
    expect(reportsRepository.saveCvmSummary).not.toHaveBeenCalled();
  });

  it("fallback: sem período na capa, lê o PDF inteiro", async () => {
    pdfCom("Relatório de Sustentabilidade");
    const criar = espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(analisarRelatorio).toHaveBeenCalledWith("texto completo do relatório", false);
    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "PDF",
        period: null,
        assetId: "asset-bbas3",
        extractedText: "texto completo do relatório",
      }),
    );
    expect(r.source).toBe("PDF");
  });

  it("fallback: CVM ainda não tem o documento do período", async () => {
    pdfCom("Release de Resultados 2T26");
    vi.mocked(buscarDadosAcao).mockResolvedValueOnce(null);
    const criar = espiarCreate();

    const r = await reportsService.analisar("u1", arquivo, { ticker: "BBAS3" });

    expect(buscarDadosAcao).toHaveBeenCalled();
    expect(analisarDadosCvm).not.toHaveBeenCalled();
    expect(analisarRelatorio).toHaveBeenCalled();
    // o período detectado fica registrado mesmo no fallback
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ source: "PDF", period: "2026-T2" }));
    expect(r.source).toBe("PDF");
  });

  it("fallback: ETF não tem documento na CVM", async () => {
    pdfCom("Relatório mensal março de 2026");
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
    pdfCom("1T26");
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValueOnce(null);
    const criar = espiarCreate();

    await reportsService.analisar("u1", arquivo, { ticker: "XPTO3" });

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

  it("sem ticker: nem consulta o ativo, vai direto para o PDF inteiro", async () => {
    pdfCom("1T26");
    espiarCreate();

    const r = await reportsService.analisar("u1", arquivo);

    expect(quotesService.buscarOuCadastrar).not.toHaveBeenCalled();
    expect(r.source).toBe("PDF");
  });
});

describe("chat do relatório", () => {
  const relatorio = {
    id: "r1",
    userId: "u1",
    assetId: "asset-bbas3",
    fileName: "x.pdf",
    period: "2026-T1",
    analysis: {},
    createdAt: new Date(),
  };

  it("recusa com 409 o relatório montado com dados da CVM, e diz como conseguir o chat", async () => {
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
    expect(perguntarAoRelatorio).not.toHaveBeenCalled();
  });

  it("responde normalmente no relatório com o PDF inteiro", async () => {
    vi.spyOn(reportsRepository, "findByIdAndUser").mockResolvedValueOnce({
      ...relatorio,
      source: "PDF",
      extractedText: "texto",
    });

    const r = await reportsService.ask("u1", "r1", { question: "qual o lucro?", history: [] });

    expect(r.answer).toBe("resposta");
  });
});
