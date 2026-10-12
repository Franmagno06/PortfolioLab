import { Prisma, type Asset, type AssetIndicator, type SnapshotType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buscarCotacao,
  buscarHistoricoMensal,
  buscarIndicadoresFundamentalistas,
  buscarProventosOuNulo,
} from "../quotes/quotes.provider.js";
import { buscarDadosAcao, buscarDadosFii, type ContaCvm, type DadosAcao, type DadosFii, type InformeFii } from "../reports/cvm.provider.js";
import { indicatorsRepository } from "../indicators/indicators.repository.js";
import { atualizarHistorico, noticiasDosUltimosDias } from "../news/news.historico.js";
import { limparBuscasEmVoo } from "./ativos.snapshots.js";
import { fontes } from "./ativos.fontes.js";
import { ativosRepository } from "./ativos.repository.js";
import { ativosService } from "./ativos.service.js";

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
vi.mock("../reports/cvm.provider.js", () => ({ buscarDadosAcao: vi.fn(), buscarDadosFii: vi.fn() }));
vi.mock("../news/news.historico.js", () => ({ atualizarHistorico: vi.fn(), noticiasDosUltimosDias: vi.fn() }));

const D = (v: string | number) => new Prisma.Decimal(v);
const AGORA = new Date("2026-10-12T15:00:00.000Z");
const HORAS = (h: number) => new Date(AGORA.getTime() - h * 60 * 60 * 1000);

// --- fixtures -------------------------------------------------------------

function asset(ticker: string, sobrescrever: Partial<Asset> & { indicator?: AssetIndicator | null } = {}) {
  return {
    id: `id-${ticker}`,
    ticker,
    name: ticker,
    type: "ACAO",
    sector: null,
    currentPrice: D("60.00"),
    priceUpdatedAt: HORAS(0.1),
    cnpj: null,
    indicator: null,
    ...sobrescrever,
  } as Asset & { indicator: AssetIndicator | null };
}

function indicador(assetId: string, sobrescrever: Partial<AssetIndicator> = {}): AssetIndicator {
  return {
    id: `ind-${assetId}`,
    assetId,
    pl: D("6.9"),
    pvp: D("1.3"),
    dividendYield: D("8.4"),
    roe: D("18.2"),
    roa: D("5.1"),
    margemLiquida: D("21.5"),
    dividaEbitda: D("1.04"),
    industria: "Other Industrial Metals & Mining",
    updatedAt: HORAS(1),
    ...sobrescrever,
  };
}

const cotacao = (ticker: string, preco: number, anterior: number | null = null) => ({
  ticker,
  nome: ticker,
  preco,
  tipo: "ACAO" as const,
  fechamentoAnterior: anterior,
  negociadoEm: new Date("2026-10-09T20:00:00.000Z"),
});

const provento = (dataEx: string, valorPorCota: number) => ({ dataEx: new Date(dataEx), valorPorCota });

const conta = (codigo: string, nome: string, atual: number): ContaCvm => ({ codigo, conta: nome, atual: D(atual), anterior: null });

function documento(tipo: "ITR" | "DFP", dataReferencia: string, lucro: number, patrimonio: number): DadosAcao {
  return {
    tipo: "ACAO",
    denominacao: "Empresa S.A.",
    documento: tipo,
    dataReferencia,
    consolidado: true,
    resultado: [conta("3.11.01", "Atribuído a Sócios da Empresa Controladora", lucro)],
    balanco: [conta("2.03", "Patrimônio Líquido Consolidado", patrimonio)],
    link: null,
  };
}

function informeFii(sobrescrever: Partial<InformeFii> = {}): InformeFii {
  return {
    valorAtivo: D(1000),
    patrimonioLiquido: D(950_000_000),
    cotasEmitidas: null,
    valorPatrimonialCota: D("9.00"),
    cotistas: D(1_500_000),
    dividendYieldMes: null,
    rentabilidadeEfetivaMes: null,
    rentabilidadePatrimonialMes: null,
    taxaAdministracaoMes: D("0.00075"),
    amortizacaoMes: null,
    rendimentosADistribuir: null,
    totalInvestido: null,
    imoveisParaRenda: null,
    cri: null,
    cotasDeFii: D(100),
    disponibilidades: null,
    totalPassivo: null,
    imoveisTotal: D(100),
    papelTotal: D(700),
    liquidezTotal: D(100),
    ...sobrescrever,
  };
}

const dadosFii = (mes: InformeFii): DadosFii => ({
  tipo: "FII",
  nome: "FII MAXI RENDA",
  segmento: "Logística",
  mandato: null,
  tipoGestao: "Ativa",
  dataReferencia: "2026-08-01",
  mes,
  mesAnterior: null,
});

// --- cenário padrão -------------------------------------------------------

/** O banco de mentira das fotografias: guarda o que foi salvo e devolve na próxima leitura. */
const fotografias = new Map<string, { dados: unknown; atualizadoEm: Date }>();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  fotografias.clear();
  fontes.limparCaches();
  limparBuscasEmVoo();
  vi.resetAllMocks();

  vi.mocked(ativosRepository.findAssetsWithIndicator).mockResolvedValue([]);
  vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(null);
  vi.mocked(ativosRepository.findSnapshotsByType).mockResolvedValue([]);
  vi.mocked(ativosRepository.updatePrice).mockResolvedValue({ count: 1 });
  // O Prisma devolve uma promessa especial (Prisma__...Client); o serviço só faz await nela, então
  // os mocks devolvem promessas comuns e o tipo é aceito com 'as never'.
  vi.mocked(ativosRepository.ensureAsset).mockImplementation(((d: {
    ticker: string;
    name: string;
    type: Asset["type"];
    currentPrice: number;
  }) =>
    Promise.resolve(
      asset(d.ticker, { name: d.name, type: d.type, currentPrice: D(d.currentPrice) }),
    )) as never);
  vi.mocked(ativosRepository.findSnapshot).mockImplementation(((assetId: string, tipo: SnapshotType) => {
    const guardada = fotografias.get(`${assetId}:${tipo}`);
    return Promise.resolve(
      guardada ? { assetId, type: tipo, data: guardada.dados, updatedAt: guardada.atualizadoEm } : null,
    );
  }) as never);
  vi.mocked(ativosRepository.saveSnapshot).mockImplementation(((
    assetId: string,
    tipo: SnapshotType,
    dados: unknown,
    atualizadoEm: Date,
  ) => {
    fotografias.set(`${assetId}:${tipo}`, { dados, atualizadoEm });
    return Promise.resolve({});
  }) as never);

  vi.mocked(buscarCotacao).mockResolvedValue(null);
  vi.mocked(buscarHistoricoMensal).mockResolvedValue(new Map());
  vi.mocked(buscarProventosOuNulo).mockResolvedValue(null);
  vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue(null);
  vi.mocked(buscarDadosAcao).mockResolvedValue(null);
  vi.mocked(buscarDadosFii).mockResolvedValue(null);
  vi.mocked(atualizarHistorico).mockResolvedValue();
  vi.mocked(noticiasDosUltimosDias).mockResolvedValue([]);
  // Como o Prisma faria: o que entra como número sai como Decimal.
  vi.mocked(indicatorsRepository.upsert).mockImplementation(((assetId: string, dados: Record<string, unknown>) => {
    const campos = Object.fromEntries(
      Object.entries(dados).map(([k, v]) => [k, typeof v === "number" ? D(v) : v]),
    );
    return Promise.resolve(indicador(assetId, { ...campos, updatedAt: new Date() } as never));
  }) as never);
});

afterEach(() => {
  vi.useRealTimers();
});

// --- fichaDaAcao ----------------------------------------------------------

describe("ativosService.fichaDaAcao", () => {
  it("ticker fora do catálogo: 404, e nenhuma fonte externa é consultada", async () => {
    await expect(ativosService.fichaDaAcao("XXXX9")).rejects.toMatchObject({ statusCode: 404 });
    await expect(ativosService.fichaDaAcao("MXRF11")).rejects.toMatchObject({ statusCode: 404 }); // é do catálogo, mas de FII

    expect(buscarCotacao).not.toHaveBeenCalled();
    expect(buscarProventosOuNulo).not.toHaveBeenCalled();
    expect(buscarDadosAcao).not.toHaveBeenCalled();
  });

  it("aceita o ticker em minúsculas", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48, 61.7));

    const ficha = await ativosService.fichaDaAcao("vale3");

    expect(ficha?.ticker).toBe("VALE3");
  });

  it("monta a ficha: preço, variação do dia, data do pregão e dados do catálogo", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48, 61.7));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(
      asset("VALE3", { indicator: indicador("id-VALE3") }),
    );

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha).toMatchObject({
      ticker: "VALE3",
      nome: "Vale S.A.",
      setor: "Mineração",
      especie: "ON",
      banco: false,
      preco: 62.48,
      variacaoDia: 1.26, // 62,48 ÷ 61,70 − 1
      fechamentoEm: "2026-10-09",
    });
  });

  it("indicadores em cache e dentro de 24h: usa o que está gravado, sem ir ao Yahoo", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(
      asset("VALE3", { indicator: indicador("id-VALE3", { updatedAt: HORAS(3) }) }),
    );

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(buscarIndicadoresFundamentalistas).not.toHaveBeenCalled();
    expect(ficha?.indicadores).toMatchObject({
      estado: "ok",
      dados: { pl: 6.9, pvp: 1.3, dy12m: 8.4, roe: 18.2, roa: 5.1, margemLiquida: 21.5, dividaEbitda: 1.04 },
    });
    expect(ficha?.pl).toBe(6.9);
    expect(ficha?.dy12m).toBe(8.4);
  });

  it("indicadores vencidos: renova no Yahoo antes de responder", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(
      asset("VALE3", { indicator: indicador("id-VALE3", { updatedAt: HORAS(30), pl: D("99") }) }),
    );
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 7,
      pvp: 1.4,
      roe: 19,
      roa: null,
      margemLiquida: 20,
      dividaEbitda: 1.1,
      industria: "Other Industrial Metals & Mining",
      precoAtual: 62.48,
    });
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([provento("2026-03-20", 2.5), provento("2026-08-12", 2.7)]);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(buscarIndicadoresFundamentalistas).toHaveBeenCalledWith("VALE3");
    expect(ficha?.indicadores.estado).toBe("ok");
    expect(ficha?.indicadores.dados?.pl).toBe(7);
    // DY = (2,50 + 2,70) ÷ 62,48 × 100, calculado com os proventos do próprio ativo
    expect(ficha?.indicadores.dados?.dy12m).toBeCloseTo(8.32, 1);
  });

  it("Yahoo fora do ar com indicador antigo guardado: devolve o antigo, marcado como desatualizado", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(
      asset("VALE3", { indicator: indicador("id-VALE3", { updatedAt: HORAS(48) }) }),
    );
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue(null);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.indicadores.estado).toBe("desatualizado");
    expect(ficha?.indicadores.dados?.pl).toBe(6.9);
  });

  it("Yahoo fora do ar e nada guardado: bloco indisponível, e a ficha ainda responde", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(asset("VALE3"));

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.indicadores).toMatchObject({ estado: "indisponivel", dados: null });
    expect(ficha?.preco).toBe(62.48);
  });

  it("sem cotação e sem cadastro no banco: responde só com o catálogo, tudo o mais indisponível, sem lançar", async () => {
    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha).toMatchObject({ ticker: "VALE3", nome: "Vale S.A.", preco: null, variacaoDia: null, fechamentoEm: null });
    expect(ficha?.indicadores.estado).toBe("indisponivel");
    expect(ficha?.resultados.estado).toBe("indisponivel");
    expect(ficha?.noticias.estado).toBe("indisponivel");
    expect(ficha?.historico.estado).toBe("indisponivel");
    expect(ficha?.proventos.estado).toBe("indisponivel");
    expect(ativosRepository.ensureAsset).not.toHaveBeenCalled();
  });

  it("sem cotação nova, usa o último preço gravado no banco", async () => {
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(
      asset("VALE3", { currentPrice: D("61.10"), indicator: indicador("id-VALE3") }),
    );

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.preco).toBe(61.1);
    expect(ficha?.variacaoDia).toBeNull(); // sem o fechamento anterior não há variação
  });

  it("cadastra o ativo na primeira visita, com o nome do catálogo e o CNPJ da tabela", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));

    await ativosService.fichaDaAcao("VALE3");

    expect(ativosRepository.ensureAsset).toHaveBeenCalledWith({
      ticker: "VALE3",
      name: "Vale S.A.",
      type: "ACAO",
      currentPrice: 62.48,
      cnpj: expect.stringMatching(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
    });
  });

  it("preço gravado vencido: atualiza o banco com a cotação nova", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(
      asset("VALE3", { priceUpdatedAt: HORAS(2), indicator: indicador("id-VALE3") }),
    );

    await ativosService.fichaDaAcao("VALE3");

    expect(ativosRepository.updatePrice).toHaveBeenCalledWith("VALE3", 62.48, expect.any(Date));
  });

  it("banco: margem líquida e dívida/EBITDA não se aplicam, mesmo que o Yahoo devolva algo", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("ITUB4", 36.9));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(
      asset("ITUB4", { indicator: indicador("id-ITUB4", { margemLiquida: D("30"), dividaEbitda: D("2.5"), roa: D("1.7") }) }),
    );

    const ficha = await ativosService.fichaDaAcao("ITUB4");

    expect(ficha?.banco).toBe(true);
    expect(ficha?.indicadores.dados).toMatchObject({ margemLiquida: null, dividaEbitda: null, roa: 1.7 });
  });

  it("proventos: os quatro mais recentes, do mais novo ao mais velho, só com data-ex e valor", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(asset("VALE3", { indicator: indicador("id-VALE3") }));
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([
      provento("2025-11-10", 1),
      provento("2025-12-12", 2),
      provento("2026-03-20", 3),
      provento("2026-05-15", 4),
      provento("2026-08-12", 5),
    ]);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.proventos.dados).toEqual([
      { dataEx: "2026-08-12", valor: 5 },
      { dataEx: "2026-05-15", valor: 4 },
      { dataEx: "2026-03-20", valor: 3 },
      { dataEx: "2025-12-12", valor: 2 },
    ]);
  });

  it("ativo que não pagou nada em 12 meses: lista vazia e estado ok (não é falha)", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([]);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.proventos).toMatchObject({ estado: "ok", dados: [] });
  });

  it("histórico: doze fechamentos mensais em ordem de data", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    const meses = new Map<string, number>();
    for (let m = 1; m <= 13; m++) meses.set(m <= 12 ? `2025-${String(m).padStart(2, "0")}` : "2026-01", 50 + m);
    vi.mocked(buscarHistoricoMensal).mockResolvedValue(new Map([...meses].reverse()));

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.historico.dados).toHaveLength(12);
    expect(ficha?.historico.dados?.[0]?.mes).toBe("2025-02");
    expect(ficha?.historico.dados?.at(-1)).toEqual({ mes: "2026-01", fechamento: 63 });
  });

  it("resultados trimestrais: os quatro últimos publicados, e o 4T sai do ano menos os três primeiros", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(buscarDadosAcao).mockImplementation(async (_cnpj, p) => {
      const chave = `${p.ano}-${p.trimestre}`;
      const docs: Record<string, DadosAcao> = {
        "2026-2": documento("ITR", "2026-06-30", 7_000_000_000, 200_000_000_000),
        "2026-1": documento("ITR", "2026-03-31", 6_500_000_000, 195_000_000_000),
        "2025-4": documento("DFP", "2025-12-31", 30_000_000_000, 190_000_000_000),
        "2025-3": documento("ITR", "2025-09-30", 8_000_000_000, 185_000_000_000),
        "2025-2": documento("ITR", "2025-06-30", 7_000_000_000, 180_000_000_000),
        "2025-1": documento("ITR", "2025-03-31", 6_000_000_000, 175_000_000_000),
      };
      return docs[chave] ?? null; // 3T26 ainda não foi publicado
    });

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.resultados.estado).toBe("ok");
    expect(ficha?.resultados.dados?.map((r) => [r.periodo, r.lucroLiquido])).toEqual([
      ["3T25", 8_000_000_000],
      ["4T25", 9_000_000_000],
      ["1T26", 6_500_000_000],
      ["2T26", 7_000_000_000],
    ]);
    expect(ficha?.resultados.atualizadoEm).toBe(AGORA.toISOString());
  });

  const documentosDe = (existentes: string[]) => async (_cnpj: string, p: { ano: number; trimestre: number }) => {
    const docs: Record<string, DadosAcao> = {
      "2026-2": documento("ITR", "2026-06-30", 7_000_000_000, 200_000_000_000),
      "2026-1": documento("ITR", "2026-03-31", 6_500_000_000, 195_000_000_000),
      "2025-4": documento("DFP", "2025-12-31", 30_000_000_000, 190_000_000_000),
      "2025-3": documento("ITR", "2025-09-30", 8_000_000_000, 185_000_000_000),
      "2025-2": documento("ITR", "2025-06-30", 7_000_000_000, 180_000_000_000),
      "2025-1": documento("ITR", "2025-03-31", 6_000_000_000, 175_000_000_000),
    };
    const chave = `${p.ano}-${p.trimestre}`;
    return existentes.includes(chave) ? (docs[chave] ?? null) : null;
  };

  it("resultados com buraco no meio (um trimestre falhou): indisponível, e nunca uma série furada gravada como boa", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    // sem a DFP de 2025: o 4T25 não sai, e a série ficaria 2T26, 1T26, 3T25, 2T25
    vi.mocked(buscarDadosAcao).mockImplementation(documentosDe(["2026-2", "2026-1", "2025-3", "2025-2", "2025-1"]) as never);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha.resultados.estado).toBe("indisponivel");
    expect(fotografias.has("id-VALE3:CVM_RESULTS")).toBe(false);
  });

  it("resultados velhos (o zip do ano corrente falhou): indisponível, e não uma série de 2025 apresentada como a mais recente", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(buscarDadosAcao).mockImplementation(documentosDe(["2025-4", "2025-3", "2025-2", "2025-1"]) as never);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha.resultados.estado).toBe("indisponivel");
  });

  it("falha da CVM não apaga o resultado bom que já estava guardado: sai como desatualizado", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(asset("VALE3", { indicator: indicador("id-VALE3") }));
    fotografias.set("id-VALE3:CVM_RESULTS", { dados: [{ periodo: "2T26" }], atualizadoEm: HORAS(60) });
    vi.mocked(buscarDadosAcao).mockImplementation(documentosDe(["2025-4", "2025-3"]) as never);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha.resultados).toMatchObject({ estado: "desatualizado", dados: [{ periodo: "2T26" }] });
  });

  it("o 3T ainda não publicado é normal: a série começa no 2T26 e vale", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(buscarDadosAcao).mockImplementation(
      documentosDe(["2026-2", "2026-1", "2025-4", "2025-3", "2025-2", "2025-1"]) as never,
    );

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha.resultados.estado).toBe("ok");
    expect(ficha.resultados.dados?.map((r) => r.periodo)).toEqual(["3T25", "4T25", "1T26", "2T26"]);
  });

  it("resultados já guardados e dentro de 24h: a CVM não é consultada de novo", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(asset("VALE3", { indicator: indicador("id-VALE3") }));
    fotografias.set("id-VALE3:CVM_RESULTS", {
      dados: [{ periodo: "2T26", dataReferencia: "2026-06-30", lucroLiquido: 1, patrimonioLiquido: 2 }],
      atualizadoEm: HORAS(5),
    });

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(buscarDadosAcao).not.toHaveBeenCalled();
    expect(ficha?.resultados).toMatchObject({ estado: "ok", dados: [{ periodo: "2T26" }] });
  });

  it("CVM fora do ar com resultado antigo guardado: devolve o antigo, marcado como desatualizado", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(asset("VALE3", { indicator: indicador("id-VALE3") }));
    fotografias.set("id-VALE3:CVM_RESULTS", {
      dados: [{ periodo: "1T26", dataReferencia: "2026-03-31", lucroLiquido: 1, patrimonioLiquido: 2 }],
      atualizadoEm: HORAS(60),
    });

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(buscarDadosAcao).toHaveBeenCalled();
    expect(ficha?.resultados.estado).toBe("desatualizado");
    expect(ficha?.resultados.dados?.[0]?.periodo).toBe("1T26");
  });

  it("notícias: só as que citam a empresa, e a ficha guarda o resultado por 30 minutos", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue(cotacao("VALE3", 62.48));
    vi.mocked(noticiasDosUltimosDias).mockResolvedValue([
      { titulo: "VALE3 sobe com minério", resumo: "", link: "https://exemplo.com/1", fonte: "Money Times", publicadoEm: "2026-10-09T12:00:00.000Z" },
      { titulo: "Selic fica estável", resumo: "", link: "https://exemplo.com/2", fonte: "Suno Notícias", publicadoEm: "2026-10-09T13:00:00.000Z" },
    ]);

    const ficha = await ativosService.fichaDaAcao("VALE3");

    expect(ficha?.noticias).toMatchObject({
      estado: "ok",
      dados: [{ titulo: "VALE3 sobe com minério", fonte: "Money Times", url: "https://exemplo.com/1" }],
    });
    expect(fotografias.get("id-VALE3:NEWS")?.atualizadoEm).toEqual(AGORA);
  });
});

// --- fichaDoFii -----------------------------------------------------------

describe("ativosService.fichaDoFii", () => {
  const preparar = (preco = 9.45) => {
    vi.mocked(buscarCotacao).mockResolvedValue({ ...cotacao("MXRF11", preco, 9.4), tipo: "FII" as never });
    vi.mocked(buscarDadosFii).mockImplementation(async (_cnpj, p) =>
      p.ano === 2026 && p.mes === 8 ? dadosFii(informeFii()) : null,
    );
  };

  it("ticker fora do catálogo, ou de ação: 404, sem consultar fonte nenhuma", async () => {
    await expect(ativosService.fichaDoFii("XXXX11")).rejects.toMatchObject({ statusCode: 404 });
    await expect(ativosService.fichaDoFii("VALE3")).rejects.toMatchObject({ statusCode: 404 });

    expect(buscarCotacao).not.toHaveBeenCalled();
    expect(buscarDadosFii).not.toHaveBeenCalled();
  });

  it("tipo e segmento vêm do catálogo; preço e variação, do Yahoo", async () => {
    preparar();

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha).toMatchObject({ ticker: "MXRF11", tipo: "Papel", segmento: "Recebíveis (CRI)", preco: 9.45, variacaoDia: 0.53 });
  });

  it("procura o informe mais recente: setembro ainda não saiu, e agosto vale", async () => {
    preparar();

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(buscarDadosFii).toHaveBeenCalledWith(expect.any(String), { tipo: "mes", ano: 2026, mes: 9 });
    expect(buscarDadosFii).toHaveBeenCalledWith(expect.any(String), { tipo: "mes", ano: 2026, mes: 8 });
    expect(ficha?.informe).toMatchObject({ estado: "ok", competencia: "2026-08" });
  });

  it("P/VP é o preço ÷ valor patrimonial da cota do informe", async () => {
    preparar(9.45);

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha?.indicadores.pvp).toBe(1.05); // 9,45 ÷ 9,00
    expect(ficha?.pvp).toBe(1.05);
  });

  it("DY de 12 meses: soma dos proventos do fundo ÷ preço; DY mensal: o último pagamento ÷ preço", async () => {
    preparar(9.45);
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([
      provento("2026-08-31", 0.1),
      provento("2026-09-30", 0.1),
      provento("2026-10-01", 0.1),
    ]);

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha?.indicadores.dy12m).toBe(3.17); // 0,30 ÷ 9,45
    expect(ficha?.indicadores.dyMensal).toBe(1.06); // 0,10 ÷ 9,45
  });

  it("o DY mensal usa o preço bruto do Yahoo, e não o preço já arredondado da resposta", async () => {
    // preço 0,504 sai como 0,50 na resposta. Com o bruto, 0,005 ÷ 0,504 = 0,99%; com o arredondado seria 1,00%.
    vi.mocked(buscarCotacao).mockResolvedValue({ ...cotacao("MXRF11", 0.504), tipo: "FII" as never });
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([provento("2026-10-01", 0.005)]);

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha.preco).toBe(0.5);
    expect(ficha.indicadores.dyMensal).toBe(0.99);
  });

  it("DY mensal só vale se o último pagamento é recente (fundo mensal): pagamento de 3 meses atrás, não", async () => {
    preparar();
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([provento("2026-07-01", 0.1)]);

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha?.indicadores.dyMensal).toBeNull();
    expect(ficha?.indicadores.dy12m).toBe(1.06); // o de 12 meses continua valendo
  });

  it("Yahoo sem proventos (consulta falhou): DY fica null, e nunca 0%", async () => {
    preparar();
    vi.mocked(buscarProventosOuNulo).mockResolvedValue(null);

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha?.indicadores.dy12m).toBeNull();
    expect(ficha?.indicadores.dyMensal).toBeNull();
    expect(ficha?.proventos.estado).toBe("indisponivel");
  });

  it("patrimônio, cotistas, gestão e taxa efetiva anual (0,075% ao mês = 0,9% ao ano) vêm do informe", async () => {
    preparar();

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha?.indicadores).toMatchObject({
      patrimonioLiquido: 950_000_000,
      cotistas: 1_500_000,
      taxaAdministracao: 0.9,
      gestao: "Ativa",
    });
  });

  it("composição da carteira: as fatias do informe, com a de papel em destaque", async () => {
    preparar();

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha?.composicao).toMatchObject({
      estado: "ok",
      dados: { imoveis: 10, papel: 70, cotasDeFii: 10, liquidez: 10, outros: 0 },
    });
  });

  it("CVM sem informe nos últimos meses: campos da CVM null, bloco indisponível, o resto da ficha segue", async () => {
    vi.mocked(buscarCotacao).mockResolvedValue({ ...cotacao("MXRF11", 9.45, 9.4), tipo: "FII" as never });
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([provento("2026-09-30", 0.1)]);

    const ficha = await ativosService.fichaDoFii("MXRF11");

    expect(ficha?.informe).toMatchObject({ estado: "indisponivel", competencia: null });
    expect(ficha?.indicadores).toMatchObject({ pvp: null, patrimonioLiquido: null, cotistas: null, taxaAdministracao: null });
    expect(ficha?.indicadores.dy12m).toBe(1.06); // do Yahoo, não depende da CVM
    expect(ficha?.composicao.estado).toBe("indisponivel");
  });
});

// --- listagens e aquecimento ----------------------------------------------

describe("ativosService.listarAcoes", () => {
  it("devolve as 15 ações do catálogo, na ordem do catálogo, mesmo sem nada guardado", async () => {
    const lista = await ativosService.listarAcoes();
    await ativosService.aguardarFila();

    expect(lista).toHaveLength(15);
    expect(lista.map((a) => a.ticker).slice(0, 3)).toEqual(["PETR4", "VALE3", "ITUB4"]);
    expect(lista[0]).toMatchObject({ nome: "Petrobras PN", setor: "Petróleo e gás", especie: "PN", preco: null, pl: null });
  });

  it("usa a cotação do Yahoo e os indicadores guardados", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => (t === "VALE3" ? cotacao("VALE3", 62.48, 61.7) : null));
    vi.mocked(ativosRepository.findAssetsWithIndicator).mockResolvedValue([
      asset("VALE3", { indicator: indicador("id-VALE3") }),
    ]);

    const lista = await ativosService.listarAcoes();
    await ativosService.aguardarFila();
    const vale = lista.find((a) => a.ticker === "VALE3");

    expect(vale).toMatchObject({ preco: 62.48, variacaoDia: 1.26, pl: 6.9, pvp: 1.3, dy12m: 8.4, roe: 18.2 });
  });

  it("renova em segundo plano só o que falta ou venceu, e responde sem esperar por isso", async () => {
    vi.mocked(ativosRepository.findAssetsWithIndicator).mockResolvedValue([
      asset("PETR4", { indicator: indicador("id-PETR4", { updatedAt: HORAS(1) }) }), // em dia: não renova
      asset("VALE3", { indicator: indicador("id-VALE3", { updatedAt: HORAS(40) }) }), // vencido
    ]);
    vi.mocked(buscarCotacao).mockImplementation(async (t) => cotacao(t, 10));
    vi.mocked(ativosRepository.findAssetWithIndicator).mockImplementation(((t: string) =>
      Promise.resolve(asset(t, { indicator: indicador(`id-${t}`, { updatedAt: HORAS(40) }) }))) as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue(null);

    await ativosService.listarAcoes();
    await ativosService.aguardarFila();

    const renovados = vi.mocked(buscarIndicadoresFundamentalistas).mock.calls.map(([t]) => t);
    expect(renovados).toContain("VALE3");
    expect(renovados).not.toContain("PETR4");
    expect(renovados).toHaveLength(14); // todos menos a PETR4, que estava em dia
  });
});

describe("ativosService.listarFiis", () => {
  it("devolve os 15 FIIs do catálogo", async () => {
    const lista = await ativosService.listarFiis();
    await ativosService.aguardarFila();

    expect(lista).toHaveLength(15);
    expect(lista.map((f) => f.ticker)).toContain("KFOF11");
    expect(lista.map((f) => f.ticker)).not.toContain("BCFF11"); // deslistado, saiu do catálogo
  });

  it("informe guardado e vencido (mais de 6h): a listagem agenda a renovação, e o P/VP antigo segue aparecendo", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => (t === "MXRF11" ? cotacao("MXRF11", 9.45) : null));
    vi.mocked(ativosRepository.findAssetsWithIndicator).mockResolvedValue([asset("MXRF11", { type: "FII" })]);
    vi.mocked(ativosRepository.findAssetWithIndicator).mockResolvedValue(asset("MXRF11", { type: "FII" }));
    fotografias.set("id-MXRF11:CVM_FUND_REPORT", { dados: { valorPatrimonialCota: 9 }, atualizadoEm: HORAS(10) });
    vi.mocked(ativosRepository.findSnapshotsByType).mockResolvedValue([
      { assetId: "id-MXRF11", type: "CVM_FUND_REPORT", data: { valorPatrimonialCota: 9 }, updatedAt: HORAS(10) } as never,
    ]);

    const lista = await ativosService.listarFiis();
    await ativosService.aguardarFila();

    expect(lista.find((f) => f.ticker === "MXRF11")?.pvp).toBe(1.05);
    expect(buscarDadosFii).toHaveBeenCalled();
  });

  it("o P/VP vem do valor patrimonial já guardado do informe, sem consultar a CVM na hora", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => (t === "MXRF11" ? cotacao("MXRF11", 9.45) : null));
    vi.mocked(ativosRepository.findAssetsWithIndicator).mockResolvedValue([asset("MXRF11", { type: "FII" })]);
    vi.mocked(ativosRepository.findSnapshotsByType).mockResolvedValue([
      { assetId: "id-MXRF11", type: "CVM_FUND_REPORT", data: { valorPatrimonialCota: 9 }, updatedAt: HORAS(1) } as never,
    ]);

    const lista = await ativosService.listarFiis();
    const mxrf = lista.find((f) => f.ticker === "MXRF11");

    expect(mxrf?.pvp).toBe(1.05);
    expect(buscarDadosFii).not.toHaveBeenCalledWith(expect.any(String), expect.anything());
  });
});

describe("ativosService.aquecerCatalogo", () => {
  it("renova os 30 ativos do catálogo, um de cada vez", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => cotacao(t, 10));

    ativosService.aquecerCatalogo();
    await ativosService.aguardarFila();

    const tickers = vi.mocked(buscarCotacao).mock.calls.map(([t]) => t);
    expect(new Set(tickers).size).toBe(30);
  });

  it("chamar duas vezes seguidas não repete o trabalho: o que já está na fila não entra de novo", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => cotacao(t, 10));

    ativosService.aquecerCatalogo();
    ativosService.aquecerCatalogo();
    await ativosService.aguardarFila();

    const porTicker = vi.mocked(buscarCotacao).mock.calls.filter(([t]) => t === "PETR4");
    expect(porTicker).toHaveLength(1);
  });

  it("um ativo que quebra no meio não impede os seguintes", async () => {
    vi.mocked(buscarCotacao).mockImplementation(async (t) => {
      if (t === "VALE3") throw new Error("Yahoo caiu");
      return cotacao(t, 10);
    });
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);

    ativosService.aquecerCatalogo();
    await ativosService.aguardarFila();

    const tickers = vi.mocked(buscarCotacao).mock.calls.map(([t]) => t);
    expect(tickers).toContain("TAEE11"); // o último das ações ainda foi processado
    expect(tickers).toContain("HGCR11"); // e o último dos FIIs também
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
