import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarIndicadoresFundamentalistas } from "../quotes/quotes.provider.js";
import { indicatorsRepository } from "./indicators.repository.js";
import {
  calcularDividendYield,
  indicatorsService,
  industriaEhBanco,
} from "./indicators.service.js";

vi.mock("./indicators.repository.js", () => ({
  indicatorsRepository: {
    ativosAcaoDoUsuario: vi.fn(),
    somaProventosUltimos12Meses: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("../quotes/quotes.provider.js", () => ({
  buscarIndicadoresFundamentalistas: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(buscarIndicadoresFundamentalistas).mockReset();
  vi.mocked(indicatorsRepository.somaProventosUltimos12Meses).mockReset();
  vi.mocked(indicatorsRepository.upsert).mockReset();
});

// Cache fresco (agora mesmo) — as chamadas do provedor não devem disparar,
// o teste testa só o mapeamento Decimal → number.
const AGORA = new Date();

const COM_INDICADOR = {
  ticker: "WEGE3",
  name: "WEG S.A.",
  indicator: {
    pl: new Prisma.Decimal("28.40"),
    pvp: new Prisma.Decimal("9.10"),
    dividendYield: new Prisma.Decimal("1.20"),
    roe: new Prisma.Decimal("32.50"),
    roa: new Prisma.Decimal("12.00"),
    margemLiquida: new Prisma.Decimal("15.80"),
    industria: "Electrical Equipment & Parts",
    updatedAt: AGORA,
  },
};

// Job nunca rodou para este ativo (recém-cadastrado) — indicator é null,
// não um erro. Sem provider mockado para responder, o refresh preguiçoso
// tenta e falha-seguro: o ativo continua aparecendo, com null.
const SEM_INDICADOR = {
  id: "asset-1",
  ticker: "RECM11",
  name: "Recém-Cadastrada S.A.",
  indicator: null,
};

// Indicador com todos os campos, mas cache fresco e PARCIALMENTE ausente
// (o provedor não informa margem líquida pra alguns setores).
const INDICADOR_PARCIAL = {
  ticker: "ITSA4",
  name: "Itaúsa S.A.",
  indicator: {
    pl: new Prisma.Decimal("7.10"),
    pvp: null,
    dividendYield: new Prisma.Decimal("6.40"),
    roe: null,
    roa: null,
    margemLiquida: null,
    industria: "Banks - Regional",
    updatedAt: AGORA,
  },
};

describe("indicatorsService.getIndicadoresDaCarteira — mapeamento (cache fresco, sem refresh)", () => {
  it("converte Decimal para number nos indicadores presentes", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([COM_INDICADOR] as never);

    const [resultado] = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(resultado).toMatchObject({
      ticker: "WEGE3",
      pl: 28.4,
      pvp: 9.1,
      dividendYield: 1.2,
      roe: 32.5,
      roa: 12,
      margemLiquida: 15.8,
      setorBancario: false,
    });
    expect(buscarIndicadoresFundamentalistas).not.toHaveBeenCalled();
  });

  it("indicador parcial: cada campo ausente vira null individualmente, e banco marca setorBancario", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([
      INDICADOR_PARCIAL,
    ] as never);

    const [resultado] = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(resultado?.pl).toBe(7.1);
    expect(resultado?.pvp).toBeNull();
    expect(resultado?.roe).toBeNull();
    expect(resultado?.roa).toBeNull();
    expect(resultado?.margemLiquida).toBeNull();
    expect(resultado?.setorBancario).toBe(true);
  });

  it("carteira sem ações devolve lista vazia", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([] as never);

    const resultado = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(resultado).toEqual([]);
    expect(buscarIndicadoresFundamentalistas).not.toHaveBeenCalled();
  });
});

describe("indicatorsService.getIndicadoresDaCarteira — refresh preguiçoso", () => {
  it("indicador ausente: busca no provedor e grava antes de responder", async () => {
    // clone: getIndicadoresDaCarteira muta o objeto (asset.indicator = ...),
    // e SEM_INDICADOR é reaproveitado por outro teste abaixo
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([
      { ...SEM_INDICADOR },
    ] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 8.8,
      pvp: 1.3,
      roe: 30,
      roa: null,
      margemLiquida: 24,
      industria: "Oil & Gas Integrated",
      precoAtual: 48.5,
    });
    vi.mocked(indicatorsRepository.somaProventosUltimos12Meses).mockResolvedValue(4.34);
    vi.mocked(indicatorsRepository.upsert).mockResolvedValue({
      id: "id-1",
      assetId: "asset-1",
      pl: new Prisma.Decimal("8.8"),
      pvp: new Prisma.Decimal("1.3"),
      dividendYield: new Prisma.Decimal("8.95"),
      roe: new Prisma.Decimal("30"),
      roa: null,
      margemLiquida: new Prisma.Decimal("24"),
      industria: "Oil & Gas Integrated",
      updatedAt: new Date(),
    } as never);

    const [resultado] = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(buscarIndicadoresFundamentalistas).toHaveBeenCalledWith("RECM11");
    // DY calculado a partir dos Proventos (4.34 / 48.5 * 100), não da fonte de cotação
    expect(indicatorsRepository.upsert).toHaveBeenCalledWith(
      "asset-1",
      expect.objectContaining({ dividendYield: expect.closeTo(8.95, 1) }),
    );
    expect(resultado?.pl).toBe(8.8);
    expect(resultado?.dividendYield).toBeCloseTo(8.95, 1);
  });

  it("indicador vencido (mais de 24h) também dispara refresh", async () => {
    const vencido = {
      ...COM_INDICADOR,
      indicator: { ...COM_INDICADOR.indicator, updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    };
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([vencido] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 20,
      pvp: 5,
      roe: 10,
      roa: null,
      margemLiquida: 5,
      industria: null,
      precoAtual: 100,
    });
    vi.mocked(indicatorsRepository.somaProventosUltimos12Meses).mockResolvedValue(0);
    vi.mocked(indicatorsRepository.upsert).mockResolvedValue({
      ...vencido.indicator,
      pl: new Prisma.Decimal("20"),
      updatedAt: new Date(),
    } as never);

    await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(buscarIndicadoresFundamentalistas).toHaveBeenCalledWith("WEGE3");
  });

  it("provedor fora do ar: mantém o cache anterior e não derruba a leitura", async () => {
    const vencido = {
      ...COM_INDICADOR,
      indicator: { ...COM_INDICADOR.indicator, updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    };
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([vencido] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue(null);

    const [resultado] = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(indicatorsRepository.upsert).not.toHaveBeenCalled();
    // continua respondendo com o que já tinha em cache, não com null
    expect(resultado?.pl).toBe(28.4);
  });

  it("falha ao consultar Proventos (DB) não derruba a leitura da carteira", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([
      { ...SEM_INDICADOR },
    ] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 8.8,
      pvp: 1.3,
      roe: 30,
      roa: null,
      margemLiquida: 24,
      industria: null,
      precoAtual: 48.5,
    });
    vi.mocked(indicatorsRepository.somaProventosUltimos12Meses).mockRejectedValue(
      new Error("timeout do pool"),
    );

    const resultado = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.pl).toBeNull(); // upsert nunca rodou: fica no null anterior
  });
});

describe("industriaEhBanco", () => {
  it("reconhece variações de 'bank' na indústria", () => {
    expect(industriaEhBanco("Banks - Regional")).toBe(true);
    expect(industriaEhBanco("Banks - Diversified")).toBe(true);
  });

  it("não confunde outros setores financeiros com banco", () => {
    expect(industriaEhBanco("Insurance - Diversified")).toBe(false);
    expect(industriaEhBanco("Asset Management")).toBe(false);
  });

  it("indústria ausente não é banco", () => {
    expect(industriaEhBanco(null)).toBe(false);
  });
});

describe("calcularDividendYield", () => {
  it("soma dos proventos por cota ÷ preço atual, em pontos percentuais", () => {
    // BBAS3: ~0.645 em proventos/cota nos últimos 12 meses, preço 23.2 → ~2.78%
    expect(calcularDividendYield(0.645, 23.2)).toBeCloseTo(2.78, 1);
  });

  it("nenhum provento sincronizado no período: DY zero, não null", () => {
    expect(calcularDividendYield(0, 23.2)).toBe(0);
  });

  it("preço ausente ou zero: devolve null, não divide por zero", () => {
    expect(calcularDividendYield(0.645, null)).toBeNull();
    expect(calcularDividendYield(0.645, 0)).toBeNull();
  });
});
