import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buscarIndicadoresFundamentalistas, buscarProventosOuNulo } from "../quotes/quotes.provider.js";
import { indicatorsRepository } from "./indicators.repository.js";
import {
  calcularDividendYield,
  DY_CALCULADO_PELO_ATIVO_DESDE,
  estaDesatualizado,
  indicatorsService,
  industriaEhBanco,
  somarProventos,
} from "./indicators.service.js";

vi.mock("./indicators.repository.js", () => ({
  indicatorsRepository: {
    ativosAcaoDoUsuario: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("../quotes/quotes.provider.js", () => ({
  buscarIndicadoresFundamentalistas: vi.fn(),
  buscarProventosOuNulo: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(buscarIndicadoresFundamentalistas).mockReset();
  vi.mocked(buscarProventosOuNulo).mockReset();
  // padrão: o Yahoo respondeu e o ativo não pagou nada. Os testes de proventos sobrescrevem.
  vi.mocked(buscarProventosOuNulo).mockResolvedValue([]);
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
    dividaEbitda: new Prisma.Decimal("1.30"),
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
    dividaEbitda: null,
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
      dividaEbitda: 1.3,
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
    expect(resultado?.dividaEbitda).toBeNull();
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
  const dataEx = new Date("2026-03-20");

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
      dividaEbitda: 1.1,
      industria: "Oil & Gas Integrated",
      precoAtual: 48.5,
    });
    // dois proventos de R$ 2,17 por cota nos últimos 12 meses = R$ 4,34
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([
      { dataEx, valorPorCota: 2.17 },
      { dataEx, valorPorCota: 2.17 },
    ]);
    vi.mocked(indicatorsRepository.upsert).mockResolvedValue({
      id: "id-1",
      assetId: "asset-1",
      pl: new Prisma.Decimal("8.8"),
      pvp: new Prisma.Decimal("1.3"),
      dividendYield: new Prisma.Decimal("8.95"),
      roe: new Prisma.Decimal("30"),
      roa: null,
      margemLiquida: new Prisma.Decimal("24"),
      dividaEbitda: new Prisma.Decimal("1.10"),
      industria: "Oil & Gas Integrated",
      updatedAt: new Date(),
    } as never);

    const [resultado] = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(buscarIndicadoresFundamentalistas).toHaveBeenCalledWith("RECM11");
    // os proventos são os do ATIVO, pedidos ao Yahoo — não os que um usuário importou
    expect(buscarProventosOuNulo).toHaveBeenCalledWith("RECM11", expect.any(Date));
    // DY = 4,34 ÷ 48,5 × 100
    expect(indicatorsRepository.upsert).toHaveBeenCalledWith(
      "asset-1",
      expect.objectContaining({ dividendYield: expect.closeTo(8.95, 1), dividaEbitda: 1.1 }),
    );
    expect(resultado?.pl).toBe(8.8);
    expect(resultado?.dividendYield).toBeCloseTo(8.95, 1);
    expect(resultado?.dividaEbitda).toBe(1.1);
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
      dividaEbitda: null,
      industria: null,
      precoAtual: 100,
    });
    vi.mocked(indicatorsRepository.upsert).mockResolvedValue({
      ...vencido.indicator,
      pl: new Prisma.Decimal("20"),
      updatedAt: new Date(),
    } as never);

    await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(buscarIndicadoresFundamentalistas).toHaveBeenCalledWith("WEGE3");
  });

  it("empresa que não pagou proventos em 12 meses: DY é 0, e não ausente", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([
      { ...SEM_INDICADOR },
    ] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 12,
      pvp: 2,
      roe: 15,
      roa: null,
      margemLiquida: 8,
      dividaEbitda: null,
      industria: null,
      precoAtual: 50,
    });
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([]); // o Yahoo respondeu: nada pago
    vi.mocked(indicatorsRepository.upsert).mockResolvedValue({ updatedAt: new Date() } as never);

    await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(indicatorsRepository.upsert).toHaveBeenCalledWith(
      "asset-1",
      expect.objectContaining({ dividendYield: 0 }),
    );
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
    expect(buscarProventosOuNulo).not.toHaveBeenCalled();
    // continua respondendo com o que já tinha em cache, não com null
    expect(resultado?.pl).toBe(28.4);
  });

  it("consulta de proventos que falhou: grava o resto e NÃO toca no DY (nem zera, nem apaga)", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([
      { ...SEM_INDICADOR },
    ] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 8.8,
      pvp: 1.3,
      roe: 30,
      roa: null,
      margemLiquida: 24,
      dividaEbitda: null,
      industria: null,
      precoAtual: 48.5,
    });
    vi.mocked(buscarProventosOuNulo).mockResolvedValue(null); // timeout, rede ou ticker desconhecido
    vi.mocked(indicatorsRepository.upsert).mockResolvedValue({ updatedAt: new Date() } as never);

    await indicatorsService.getIndicadoresDaCarteira("user-1");

    const gravado = vi.mocked(indicatorsRepository.upsert).mock.calls[0]?.[1];
    expect(gravado).toMatchObject({ pl: 8.8, pvp: 1.3 });
    // a chave nem existe: o Prisma ignora campo ausente e preserva o valor gravado
    expect(gravado).not.toHaveProperty("dividendYield");
  });

  it("Yahoo respondeu os fundamentos mas sem preço: o DY não é calculável e o gravado é preservado", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([{ ...SEM_INDICADOR }] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 8.8,
      pvp: 1.3,
      roe: 30,
      roa: null,
      margemLiquida: 24,
      dividaEbitda: null,
      industria: null,
      precoAtual: null, // o módulo price do quoteSummary veio vazio
    });
    vi.mocked(buscarProventosOuNulo).mockResolvedValue([{ dataEx, valorPorCota: 2 }]);
    vi.mocked(indicatorsRepository.upsert).mockResolvedValue({ updatedAt: new Date() } as never);

    await indicatorsService.getIndicadoresDaCarteira("user-1");

    const gravado = vi.mocked(indicatorsRepository.upsert).mock.calls[0]?.[1];
    expect(gravado).toMatchObject({ pl: 8.8 });
    expect(gravado).not.toHaveProperty("dividendYield");
  });

  it("falha ao gravar o indicador (banco) não derruba a leitura da carteira", async () => {
    vi.mocked(indicatorsRepository.ativosAcaoDoUsuario).mockResolvedValue([
      { ...SEM_INDICADOR },
    ] as never);
    vi.mocked(buscarIndicadoresFundamentalistas).mockResolvedValue({
      pl: 8.8,
      pvp: 1.3,
      roe: 30,
      roa: null,
      margemLiquida: 24,
      dividaEbitda: null,
      industria: null,
      precoAtual: 48.5,
    });
    vi.mocked(indicatorsRepository.upsert).mockRejectedValue(new Error("timeout do pool"));

    const resultado = await indicatorsService.getIndicadoresDaCarteira("user-1");

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.pl).toBeNull(); // upsert nunca concluiu: fica no null anterior
  });
});

describe("estaDesatualizado", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("indicador gravado antes do cálculo novo do DY vale como vencido, mesmo com menos de 24h", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T01:00:00.000Z"));

    // duas horas atrás, ainda dentro das 24h, mas gravado pelo cálculo antigo (que dava 0,00%)
    const gravadoAntes = { updatedAt: new Date("2026-10-11T23:00:00.000Z") };

    expect(estaDesatualizado(gravadoAntes)).toBe(true);
  });

  it("gravado depois do corte e dentro de 24h: em dia", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T01:00:00.000Z"));

    expect(estaDesatualizado({ updatedAt: new Date("2026-10-12T00:30:00.000Z") })).toBe(false);
  });

  it("gravado depois do corte mas há mais de 24h: vencido", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T01:00:00.000Z"));

    expect(estaDesatualizado({ updatedAt: new Date("2026-10-12T00:30:00.000Z") })).toBe(true);
  });

  it("nunca calculado: vencido", () => {
    expect(estaDesatualizado(null)).toBe(true);
  });

  it("o corte é a data do deploy desta mudança", () => {
    expect(DY_CALCULADO_PELO_ATIVO_DESDE.toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
});

describe("somarProventos", () => {
  it("soma em Decimal: 0,1 + 0,2 é exatamente 0,3", () => {
    expect(somarProventos([{ valorPorCota: 0.1 }, { valorPorCota: 0.2 }])).toBe(0.3);
  });

  it("lista vazia soma zero", () => {
    expect(somarProventos([])).toBe(0);
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
