import { Prisma, type Asset } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { quotesService } from "../quotes/quotes.service.js";
import { VERSAO_DA_ANALISE } from "./analise.js";
import { buscarDadosAcao, buscarDadosFii } from "./cvm.provider.js";
import { INFORME_DE_FII, ITR_DE_BANCO } from "./dados-de-teste.js";
import { reportsRepository } from "./reports.repository.js";
import { COTA_RELATORIOS, reportsService } from "./reports.service.js";
import { montarAnalise } from "./resumo-cvm.js";

// Regra do service, sem rede e sem banco: a CVM e o repository são simulados.
vi.mock("./cvm.provider.js", () => ({ buscarDadosAcao: vi.fn(), buscarDadosFii: vi.fn() }));

const ativo = (campos: Partial<Asset>): Asset => ({
  id: "asset-1",
  ticker: "BBAS3",
  name: "Banco do Brasil",
  type: "ACAO",
  sector: null,
  currentPrice: new Prisma.Decimal(20),
  priceUpdatedAt: new Date(),
  cnpj: "00.000.000/0001-91",
  ...campos,
});
const BBAS3 = ativo({});
const MXRF11 = ativo({ id: "asset-2", ticker: "MXRF11", name: "Maxi Renda", type: "FII", cnpj: "97.521.225/0001-25" });

const HOJE = new Date(2026, 10, 10, 12); // 10/11/2026: o último trimestre encerrado é o 3T26

type Criado = Parameters<typeof reportsRepository.create>[0];
let criados: Criado[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOJE);
  criados = [];
  vi.mocked(buscarDadosAcao).mockReset().mockResolvedValue(null);
  vi.mocked(buscarDadosFii).mockReset().mockResolvedValue(null);
  vi.spyOn(quotesService, "buscarOuCadastrar").mockResolvedValue(BBAS3);
  vi.spyOn(reportsRepository, "findCvmSummary").mockResolvedValue(null);
  vi.spyOn(reportsRepository, "saveCvmSummary").mockResolvedValue({} as never);
  vi.spyOn(reportsRepository, "findCvmByUserAssetPeriod").mockResolvedValue(null);
  vi.spyOn(reportsRepository, "updateAnalysis").mockResolvedValue({ id: "rep-1" });
  vi.spyOn(reportsRepository, "countByUser").mockResolvedValue(0);
  vi.spyOn(reportsRepository, "create").mockImplementation(((data: Criado) => {
    criados.push(data);
    return Promise.resolve({ id: `rep-${criados.length}`, ...data, createdAt: HOJE });
  }) as unknown as typeof reportsRepository.create);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A CVM "tem" só os trimestres listados (chaves como "2026-T2"). */
function cvmTemTrimestres(...chaves: string[]) {
  vi.mocked(buscarDadosAcao).mockImplementation(async (_cnpj, p) =>
    chaves.includes(`${p.ano}-T${p.trimestre}`) ? ITR_DE_BANCO : null,
  );
}

describe("reportsService.consultar: período pedido", () => {
  it("guarda o relatório com os números da CVM, o nome 'TICKER período' e nenhum texto de PDF", async () => {
    cvmTemTrimestres("2026-T1");

    const { relatorio, novo } = await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" });

    expect(novo).toBe(true);
    expect(buscarDadosAcao).toHaveBeenCalledWith(BBAS3.cnpj, { tipo: "trimestre", ano: 2026, trimestre: 1 });
    expect(criados).toHaveLength(1);
    expect(criados[0]).toMatchObject({
      userId: "u1",
      fileName: "BBAS3 1T26",
      source: "CVM",
      assetId: BBAS3.id,
      period: "2026-T1",
      extractedText: null,
    });
    expect(relatorio).toMatchObject({
      id: "rep-1",
      source: "CVM",
      period: "2026-T1",
      asset: { ticker: "BBAS3", name: "Banco do Brasil", type: "ACAO" },
    });
    expect(relatorio.analysis).toEqual(montarAnalise(ITR_DE_BANCO, "1T26"));
  });

  it("grava a análise no cache compartilhado do ativo e período", async () => {
    cvmTemTrimestres("2026-T1");

    await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "2026-T1" });

    expect(reportsRepository.saveCvmSummary).toHaveBeenCalledWith(BBAS3.id, "2026-T1", montarAnalise(ITR_DE_BANCO, "1T26"));
  });

  it("cache montado pelas regras atuais é usado sem ir à CVM", async () => {
    const guardada = montarAnalise(ITR_DE_BANCO, "1T26");
    vi.mocked(reportsRepository.findCvmSummary).mockResolvedValue({ analysis: guardada } as never);

    const { relatorio } = await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" });

    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(relatorio.analysis).toEqual(guardada);
  });

  it("cache de outra versão (IA, regras antigas, texto escrito à mão na seed) é ignorado e regravado com o dado da CVM", async () => {
    const inventada = {
      tipoDocumento: "ITR — Informações Trimestrais (CVM)",
      resumoExecutivo: ["Lucro líquido ajustado atingiu R$ 9,3 bilhões no trimestre."],
      alertas: [],
      indicadores: [{ nome: "ROE", valor: "21,40%" }],
    };
    vi.mocked(reportsRepository.findCvmSummary).mockResolvedValue({ analysis: inventada } as never);
    cvmTemTrimestres("2026-T1");

    const { relatorio } = await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" });

    expect(buscarDadosAcao).toHaveBeenCalledTimes(1);
    expect(relatorio.analysis.versao).toBe(VERSAO_DA_ANALISE);
    expect(JSON.stringify(relatorio.analysis)).not.toContain("9,3 bilhões");
    expect(reportsRepository.saveCvmSummary).toHaveBeenCalledWith(BBAS3.id, "2026-T1", relatorio.analysis);
  });

  it("período que a CVM não tem: 404 dizendo o ativo e o período, e nada é guardado", async () => {
    await expect(reportsService.consultar("u1", { ticker: "BBAS3", periodo: "3T26" })).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining("BBAS3 para 3T26"),
    });
    expect(criados).toHaveLength(0);
    expect(buscarDadosAcao).toHaveBeenCalledTimes(1); // pedido explícito não anda para trás
  });

  it.each(["abc", "2026-T9", "13/2026"])("período inválido (%s): 400", async (periodo) => {
    await expect(reportsService.consultar("u1", { ticker: "BBAS3", periodo })).rejects.toMatchObject({ statusCode: 400 });
    expect(buscarDadosAcao).not.toHaveBeenCalled();
  });

  it("mês para ação e trimestre para fundo são recusados antes de ir à CVM", async () => {
    await expect(reportsService.consultar("u1", { ticker: "BBAS3", periodo: "2026-03" })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("trimestre"),
    });

    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValue(MXRF11);
    await expect(reportsService.consultar("u1", { ticker: "MXRF11", periodo: "1T26" })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("mês"),
    });

    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(buscarDadosFii).not.toHaveBeenCalled();
  });

  it("falha ao gravar o cache não derruba a consulta", async () => {
    cvmTemTrimestres("2026-T1");
    vi.mocked(reportsRepository.saveCvmSummary).mockRejectedValue(new Error("banco fora"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { novo } = await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" });

    expect(novo).toBe(true);
  });
});

describe("reportsService.consultar: sem período, o mais recente que a CVM já publicou", () => {
  it("em 10/11 o 3T26 ainda não foi entregue: fica com o 2T26", async () => {
    cvmTemTrimestres("2026-T2", "2026-T1");

    const { relatorio } = await reportsService.consultar("u1", { ticker: "BBAS3" });

    expect(relatorio.period).toBe("2026-T2");
    expect(criados[0]?.fileName).toBe("BBAS3 2T26");
    expect(vi.mocked(buscarDadosAcao).mock.calls.map(([, p]) => `${p.ano}-T${p.trimestre}`)).toEqual(["2026-T3", "2026-T2"]);
  });

  it("se o mais recente já saiu, é ele, e não procura mais", async () => {
    cvmTemTrimestres("2026-T3", "2026-T2");

    const { relatorio } = await reportsService.consultar("u1", { ticker: "BBAS3" });

    expect(relatorio.period).toBe("2026-T3");
    expect(buscarDadosAcao).toHaveBeenCalledTimes(1);
  });

  it("anda para trás atravessando o ano, e desiste depois de 4 períodos com 404", async () => {
    vi.setSystemTime(new Date(2026, 1, 15, 12)); // fevereiro: último encerrado é o 4T25

    await expect(reportsService.consultar("u1", { ticker: "BBAS3" })).rejects.toMatchObject({ statusCode: 404 });

    expect(vi.mocked(buscarDadosAcao).mock.calls.map(([, p]) => `${p.ano}-T${p.trimestre}`)).toEqual([
      "2025-T4",
      "2025-T3",
      "2025-T2",
      "2025-T1",
    ]);
    expect(criados).toHaveLength(0);
  });

  it("fundo imobiliário usa o informe mensal: outubro ainda não saiu, fica setembro", async () => {
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValue(MXRF11);
    vi.mocked(buscarDadosFii).mockImplementation(async (_cnpj, p) => (p.mes === 9 ? INFORME_DE_FII : null));

    const { relatorio } = await reportsService.consultar("u1", { ticker: "MXRF11" });

    expect(relatorio.period).toBe("2026-09");
    expect(criados[0]?.fileName).toBe("MXRF11 setembro de 2026");
    expect(relatorio.analysis.tipoDocumento).toBe("Informe Mensal de FII");
    expect(buscarDadosAcao).not.toHaveBeenCalled();
  });
});

describe("reportsService.consultar: o que a conta já tem", () => {
  it("mesmo ativo e período de novo devolve o relatório existente, sem criar outro nem contar na cota", async () => {
    cvmTemTrimestres("2026-T1");
    const analise = montarAnalise(ITR_DE_BANCO, "1T26");
    vi.mocked(reportsRepository.findCvmByUserAssetPeriod).mockResolvedValue({
      id: "rep-antigo",
      fileName: "BBAS3 1T26",
      createdAt: new Date("2026-05-20T12:00:00Z"),
      analysis: analise,
    } as never);
    vi.mocked(reportsRepository.countByUser).mockResolvedValue(COTA_RELATORIOS);

    const { relatorio, novo } = await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" });

    expect(novo).toBe(false);
    expect(relatorio.id).toBe("rep-antigo");
    expect(criados).toHaveLength(0);
    expect(reportsRepository.findCvmByUserAssetPeriod).toHaveBeenCalledWith("u1", BBAS3.id, "2026-T1");
    expect(reportsRepository.updateAnalysis).not.toHaveBeenCalled();
  });

  it("relatório existente com análise antiga passa a guardar a atual", async () => {
    cvmTemTrimestres("2026-T1");
    vi.mocked(reportsRepository.findCvmByUserAssetPeriod).mockResolvedValue({
      id: "rep-antigo",
      fileName: "BBAS3-Demonstracoes-Financeiras-1T26.pdf",
      createdAt: new Date("2026-05-20T12:00:00Z"),
      analysis: { tipoDocumento: "ITR — Informações Trimestrais (CVM)", resumoExecutivo: [], alertas: [], indicadores: [] },
    } as never);

    const { relatorio } = await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" });

    expect(reportsRepository.updateAnalysis).toHaveBeenCalledWith("rep-antigo", montarAnalise(ITR_DE_BANCO, "1T26"));
    expect(relatorio.analysis.versao).toBe(VERSAO_DA_ANALISE);
  });

  it(`na cota de ${COTA_RELATORIOS}, um relatório novo é recusado com 429`, async () => {
    cvmTemTrimestres("2026-T1");
    vi.mocked(reportsRepository.countByUser).mockResolvedValue(COTA_RELATORIOS);

    await expect(reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" })).rejects.toMatchObject({ statusCode: 429 });
    expect(criados).toHaveLength(0);
  });

  it("um abaixo da cota ainda cria", async () => {
    cvmTemTrimestres("2026-T1");
    vi.mocked(reportsRepository.countByUser).mockResolvedValue(COTA_RELATORIOS - 1);

    expect((await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" })).novo).toBe(true);
  });
});

describe("reportsService.consultar: ativo que não tem demonstração na CVM", () => {
  it("ticker desconhecido: 404", async () => {
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValue(null);

    await expect(reportsService.consultar("u1", { ticker: "XXXX3" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(["ETF", "RENDA_FIXA"] as const)("%s: 400, sem ir à CVM", async (type) => {
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValue(ativo({ ticker: "BOVA11", type }));

    await expect(reportsService.consultar("u1", { ticker: "BOVA11" })).rejects.toMatchObject({ statusCode: 400 });
    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(buscarDadosFii).not.toHaveBeenCalled();
  });

  it("ação sem CNPJ conhecido: 400 dizendo o motivo", async () => {
    vi.mocked(quotesService.buscarOuCadastrar).mockResolvedValue(ativo({ ticker: "ZZZZ3", cnpj: null }));

    await expect(reportsService.consultar("u1", { ticker: "ZZZZ3" })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("CNPJ"),
    });
  });
});

describe("reportsService.consultar: leitura da CVM em série", () => {
  it("duas consultas ao mesmo tempo nunca leem a CVM em paralelo", async () => {
    let emVoo = 0;
    let pico = 0;
    vi.mocked(buscarDadosAcao).mockImplementation(async () => {
      emVoo++;
      pico = Math.max(pico, emVoo);
      await Promise.resolve();
      await Promise.resolve();
      emVoo--;
      return ITR_DE_BANCO;
    });

    await Promise.all([
      reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" }),
      reportsService.consultar("u2", { ticker: "BBAS3", periodo: "2T26" }),
    ]);

    expect(pico).toBe(1);
  });

  it("uma leitura que explode não trava as seguintes", async () => {
    vi.mocked(buscarDadosAcao).mockRejectedValueOnce(new Error("zip corrompido")).mockResolvedValue(ITR_DE_BANCO);

    await expect(reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" })).rejects.toThrow("zip corrompido");
    expect((await reportsService.consultar("u1", { ticker: "BBAS3", periodo: "1T26" })).novo).toBe(true);
  });
});

describe("reportsService.remove", () => {
  it("relatório de outra conta (ou inexistente): 404, e nada é apagado", async () => {
    vi.spyOn(reportsRepository, "findByIdAndUser").mockResolvedValue(null);
    const apagar = vi.spyOn(reportsRepository, "delete").mockResolvedValue({} as never);

    await expect(reportsService.remove("u1", "rep-de-outro")).rejects.toMatchObject({ statusCode: 404 });
    expect(apagar).not.toHaveBeenCalled();
  });

  it("apaga o relatório da própria conta", async () => {
    vi.spyOn(reportsRepository, "findByIdAndUser").mockResolvedValue({ id: "rep-1" });
    const apagar = vi.spyOn(reportsRepository, "delete").mockResolvedValue({} as never);

    await reportsService.remove("u1", "rep-1");

    expect(reportsRepository.findByIdAndUser).toHaveBeenCalledWith("rep-1", "u1");
    expect(apagar).toHaveBeenCalledWith("rep-1");
  });
});
