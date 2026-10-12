import { Prisma, type Asset, type SnapshotType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { atualizarHistorico, noticiasDosUltimosDias } from "../news/news.historico.js";
import { buscarCotacao, buscarHistoricoMensal, buscarProventosOuNulo, type Cotacao } from "../quotes/quotes.provider.js";
import { buscarPatrimonioDeClasses } from "../reports/cvm.provider.js";
import { fontes } from "./ativos.fontes.js";
import { ativosRepository } from "./ativos.repository.js";
import { ativosService } from "./ativos.service.js";
import { limparBuscasEmVoo } from "./ativos.snapshots.js";

vi.mock("./ativos.repository.js", () => ({
  ativosRepository: {
    findAssetsWithIndicator: vi.fn(),
    findAssetWithIndicator: vi.fn(),
    ensureAsset: vi.fn(),
    updatePrice: vi.fn(),
    findSnapshot: vi.fn(),
    findSnapshotsByType: vi.fn(),
    saveSnapshot: vi.fn(),
  },
}));
vi.mock("../indicators/indicators.repository.js", () => ({ indicatorsRepository: { upsert: vi.fn() } }));
vi.mock("../quotes/quotes.provider.js", () => ({
  buscarCotacao: vi.fn(),
  buscarHistoricoMensal: vi.fn(),
  buscarIndicadoresFundamentalistas: vi.fn(),
  buscarProventosOuNulo: vi.fn(),
}));
vi.mock("../reports/cvm.provider.js", () => ({
  buscarDadosAcao: vi.fn(),
  buscarDadosFii: vi.fn(),
  buscarPatrimonioDeClasses: vi.fn(),
}));
vi.mock("../news/news.historico.js", () => ({ atualizarHistorico: vi.fn(), noticiasDosUltimosDias: vi.fn() }));

const cotacao = (ticker: string, preco: number, anterior: number): Cotacao =>
  ({ ticker, preco, fechamentoAnterior: anterior, negociadoEm: new Date("2026-10-09T20:00:00.000Z") }) as Cotacao;

/** 13 fechamentos mensais, de 2025-10 a 2026-10, com o primeiro valendo `inicial`. */
function treze(inicial: number, ultimo: number): Map<string, number> {
  const meses = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  return new Map(meses.map((m, i) => [m, i === 0 ? inicial : i === 12 ? ultimo : inicial + i]));
}

const CNPJ_DO_BOVA11 = "10406511000161";

beforeEach(() => {
  vi.resetAllMocks();
  limparBuscasEmVoo();
  fontes.limparCaches();
  const salvas = new Map<string, { dados: unknown; atualizadoEm: Date }>();
  vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(null);
  vi.mocked(ativosRepository.ensureAsset).mockImplementation(((d: { ticker: string; name: string; type: Asset["type"]; currentPrice: number }) =>
    Promise.resolve({ id: `id-${d.ticker}`, ticker: d.ticker, name: d.name, type: d.type, currentPrice: new Prisma.Decimal(d.currentPrice), priceUpdatedAt: new Date(), indicator: null })) as never);
  vi.mocked(ativosRepository.findSnapshot).mockImplementation(((assetId: string, tipo: SnapshotType) => {
    const s = salvas.get(`${assetId}:${tipo}`);
    return Promise.resolve(s ? { assetId, type: tipo, data: s.dados, updatedAt: s.atualizadoEm } : null);
  }) as never);
  vi.mocked(ativosRepository.saveSnapshot).mockImplementation(((assetId: string, tipo: SnapshotType, dados: unknown, atualizadoEm: Date) => {
    salvas.set(`${assetId}:${tipo}`, { dados, atualizadoEm });
    return Promise.resolve({});
  }) as never);
  vi.mocked(buscarCotacao).mockResolvedValue(null);
  vi.mocked(buscarHistoricoMensal).mockResolvedValue(new Map());
  vi.mocked(buscarProventosOuNulo).mockResolvedValue(null);
  vi.mocked(buscarPatrimonioDeClasses).mockResolvedValue(null);
  vi.mocked(atualizarHistorico).mockResolvedValue();
  vi.mocked(noticiasDosUltimosDias).mockResolvedValue([]);
});

describe("ativosService.fichaDoEtf", () => {
  it("ticker fora do catálogo de ETFs: 404, e nenhuma fonte externa é consultada", async () => {
    await expect(ativosService.fichaDoEtf("XXXX11")).rejects.toMatchObject({ statusCode: 404 });
    await expect(ativosService.fichaDoEtf("MXRF11")).rejects.toMatchObject({ statusCode: 404 });
    expect(buscarCotacao).not.toHaveBeenCalled();
    expect(buscarPatrimonioDeClasses).not.toHaveBeenCalled();
  });

  it("monta a ficha: descrição, índice, preço, variação, retorno em 12 meses e patrimônio da CVM", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("BOVA11", 150, 148.5));
    vi.mocked(buscarHistoricoMensal).mockResolvedValue(treze(100, 150));
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([]);
    vi.mocked(buscarPatrimonioDeClasses).mockResolvedValue(
      new Map([[CNPJ_DO_BOVA11, { patrimonioLiquido: 17_669_434_547.72, dataReferencia: "2026-10-05" }]]),
    );

    const ficha = await ativosService.fichaDoEtf("bova11");

    expect(ficha).toMatchObject({
      ticker: "BOVA11",
      categoria: "Ações do Brasil",
      indice: "Ibovespa",
      preco: 150,
      variacaoDia: 1.01,
      retorno12m: 50,
      dy12m: 0,
      fechamentoEm: "2026-10-09",
    });
    expect(ficha.descricao).toContain("Ibovespa");
    expect(ficha.patrimonio).toMatchObject({
      estado: "ok",
      dados: { patrimonioLiquido: 17_669_434_547.72, dataReferencia: "2026-10-05" },
    });
    expect(ficha.historico.dados).toHaveLength(12);
  });

  it("CVM fora do ar: o patrimônio fica indisponível e o resto da ficha segue", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("BOVA11", 150, 148.5));
    vi.mocked(buscarHistoricoMensal).mockResolvedValue(treze(100, 150));

    const ficha = await ativosService.fichaDoEtf("BOVA11");

    expect(ficha.patrimonio).toEqual({ estado: "indisponivel", atualizadoEm: null, dados: null });
    expect(ficha.preco).toBe(150);
    expect(ficha.historico.estado).toBe("ok");
  });

  it("Yahoo fora do ar: preço, retorno e proventos ficam nulos, sem lançar", async () => {
    const ficha = await ativosService.fichaDoEtf("BOVA11");

    expect(ficha).toMatchObject({ preco: null, variacaoDia: null, retorno12m: null, dy12m: null });
    expect(ficha.historico.dados).toBeNull();
    expect(ficha.proventos.dados).toBeNull();
  });

  it("histórico com menos de 13 meses: não inventa retorno de 12 meses", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("HASH11", 10, 10));
    vi.mocked(buscarHistoricoMensal).mockResolvedValue(new Map([["2026-09", 9], ["2026-10", 10]]));

    const ficha = await ativosService.fichaDoEtf("HASH11");

    expect(ficha.retorno12m).toBeNull();
  });
});

describe("ativosService.listarEtfs", () => {
  it("devolve os dez ETFs, na ordem do catálogo, sem tocar no banco", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => cotacao(t, 100, 99));

    const lista = await ativosService.listarEtfs();

    expect(lista).toHaveLength(10);
    expect(lista[0]?.ticker).toBe("BOVA11");
    expect(lista[0]?.preco).toBe(100);
    expect(ativosRepository.findAssetsWithIndicator).not.toHaveBeenCalled();
  });

  it("um ETF sem cotação sai com preço nulo, e os outros não são afetados", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => (t === "GOLD11" ? null : cotacao(t, 100, 99)));

    const lista = await ativosService.listarEtfs();

    expect(lista.find((e) => e.ticker === "GOLD11")?.preco).toBeNull();
    expect(lista.find((e) => e.ticker === "BOVA11")?.preco).toBe(100);
  });
});
