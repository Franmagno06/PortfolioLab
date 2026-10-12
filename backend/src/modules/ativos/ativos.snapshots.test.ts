import type { SnapshotType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ativosRepository } from "./ativos.repository.js";
import { aguardarFilaPesada, limparBuscasEmVoo, obterFotografia, VALIDADE_DO_SNAPSHOT_MS } from "./ativos.snapshots.js";

vi.mock("./ativos.repository.js", () => ({
  ativosRepository: { findSnapshot: vi.fn(), saveSnapshot: vi.fn() },
}));

const loja = new Map<string, { dados: unknown; atualizadoEm: Date }>();
const minutosAtras = (m: number) => new Date(Date.now() - m * 60 * 1000);
const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  loja.clear();
  limparBuscasEmVoo();
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  vi.mocked(ativosRepository.findSnapshot).mockImplementation(((assetId: string, tipo: SnapshotType) => {
    const guardada = loja.get(`${assetId}:${tipo}`);
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
    loja.set(`${assetId}:${tipo}`, { dados, atualizadoEm });
    return Promise.resolve({});
  }) as never);
});

describe("obterFotografia: o que está guardado", () => {
  it("dentro da validade: devolve o guardado e não busca nada", async () => {
    loja.set("a:CVM_RESULTS", { dados: [1, 2], atualizadoEm: minutosAtras(60) });
    const buscar = vi.fn(async () => [9]);

    const f = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });

    expect(f).toMatchObject({ dados: [1, 2], estado: "ok" });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("cada tipo tem a sua validade: 40 minutos vencem as notícias (30), mas não os resultados da CVM (24h)", async () => {
    loja.set("a:NEWS", { dados: ["velha"], atualizadoEm: minutosAtras(40) });
    loja.set("a:CVM_RESULTS", { dados: ["valida"], atualizadoEm: minutosAtras(40) });
    const buscar = vi.fn(async () => ["nova"]);

    const noticias = await obterFotografia({ assetId: "a", tipo: "NEWS", buscar });
    const resultados = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });

    expect(noticias.dados).toEqual(["nova"]);
    expect(resultados.dados).toEqual(["valida"]);
    expect(VALIDADE_DO_SNAPSHOT_MS.NEWS).toBe(30 * 60 * 1000);
    expect(VALIDADE_DO_SNAPSHOT_MS.CVM_RESULTS).toBe(24 * 60 * 60 * 1000);
    expect(VALIDADE_DO_SNAPSHOT_MS.CVM_FUND_REPORT).toBe(6 * 60 * 60 * 1000);
  });
});

describe("obterFotografia: buscando", () => {
  it("nada guardado e a fonte respondeu: grava e devolve", async () => {
    const f = await obterFotografia({ assetId: "a", tipo: "CVM_FUND_REPORT", buscar: async () => ({ competencia: "2026-08" }) });

    expect(f).toMatchObject({ dados: { competencia: "2026-08" }, estado: "ok" });
    expect(f.atualizadoEm).toBeInstanceOf(Date);
    expect(loja.get("a:CVM_FUND_REPORT")?.dados).toEqual({ competencia: "2026-08" });
  });

  it("vencido e a fonte respondeu: substitui o guardado", async () => {
    loja.set("a:CVM_RESULTS", { dados: ["antigo"], atualizadoEm: minutosAtras(60 * 30) });

    const f = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar: async () => ["novo"] });

    expect(f).toMatchObject({ dados: ["novo"], estado: "ok" });
    expect(loja.get("a:CVM_RESULTS")?.dados).toEqual(["novo"]);
  });

  it("lista vazia é um resultado válido: é gravada e vale pela validade inteira", async () => {
    const buscar = vi.fn(async () => [] as string[]);

    await obterFotografia({ assetId: "a", tipo: "NEWS", buscar });
    const segunda = await obterFotografia({ assetId: "a", tipo: "NEWS", buscar });

    expect(segunda).toMatchObject({ dados: [], estado: "ok" });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("vencido e a fonte falhou (null): devolve o antigo, marcado como desatualizado, e não grava", async () => {
    const antigo = minutosAtras(60 * 30);
    loja.set("a:CVM_RESULTS", { dados: ["antigo"], atualizadoEm: antigo });

    const f = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar: async () => null });

    expect(f).toMatchObject({ dados: ["antigo"], estado: "desatualizado", atualizadoEm: antigo });
    expect(ativosRepository.saveSnapshot).not.toHaveBeenCalled();
  });

  it("nada guardado e a fonte falhou: indisponível", async () => {
    const f = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar: async () => null });

    expect(f).toEqual({ dados: null, atualizadoEm: null, estado: "indisponivel" });
  });

  it("a fonte lançou erro: tratado como falha, registrado, e nunca vaza para a ficha", async () => {
    const f = await obterFotografia({
      assetId: "a",
      tipo: "CVM_RESULTS",
      buscar: async () => {
        throw new Error("zip corrompido");
      },
    });

    expect(f.estado).toBe("indisponivel");
    expect(console.error).toHaveBeenCalled();
  });

  it("o banco falhou ao gravar: a ficha não quebra, e o dado que acabou de chegar não é apresentado como guardado", async () => {
    vi.mocked(ativosRepository.saveSnapshot).mockRejectedValue(new Error("timeout do pool"));

    const f = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar: async () => ["novo"] });

    expect(f.estado).toBe("indisponivel");
  });
});

describe("obterFotografia: espera após falha", () => {
  it("depois de uma falha, a fonte não é consultada de novo por 30 minutos, mesmo em visitas seguidas", async () => {
    const buscar = vi.fn(async () => null);

    await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });
    await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });
    const terceira = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(terceira.estado).toBe("indisponivel");
  });

  it("durante a espera, o último dado bom continua sendo servido, marcado como desatualizado", async () => {
    loja.set("a:CVM_RESULTS", { dados: ["antigo"], atualizadoEm: minutosAtras(60 * 30) });
    const buscar = vi.fn(async () => null);

    await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });
    const segunda = await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(segunda).toMatchObject({ dados: ["antigo"], estado: "desatualizado" });
  });

  it("passados os 30 minutos, tenta de novo", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const buscar = vi.fn(async () => null);

    await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar });
    vi.useRealTimers();

    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("a espera é por ativo e tipo: a falha de um não segura os outros", async () => {
    const falha = vi.fn(async () => null);
    const boa = vi.fn(async () => ["ok"]);

    await obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar: falha });
    const outroAtivo = await obterFotografia({ assetId: "b", tipo: "CVM_RESULTS", buscar: boa });
    const outroTipo = await obterFotografia({ assetId: "a", tipo: "NEWS", buscar: boa });

    expect(outroAtivo.estado).toBe("ok");
    expect(outroTipo.estado).toBe("ok");
  });

  it("um sucesso apaga a falha anterior da memória", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const buscar = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(["ok"]);

    await obterFotografia({ assetId: "a", tipo: "NEWS", buscar });
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    const depois = await obterFotografia({ assetId: "a", tipo: "NEWS", buscar });
    vi.useRealTimers();

    expect(depois.estado).toBe("ok");
  });
});

describe("obterFotografia: demora e concorrência", () => {
  it("a fonte passou do tempo da ficha: responde sem ela, e quando a busca termina ela grava para a próxima visita", async () => {
    const f = await obterFotografia({
      assetId: "a",
      tipo: "NEWS",
      esperaMaximaMs: 20,
      buscar: async () => {
        await pausa(80);
        return ["chegou tarde"];
      },
    });

    expect(f.estado).toBe("indisponivel");
    expect(loja.has("a:NEWS")).toBe(false);

    await pausa(120);

    expect(loja.get("a:NEWS")?.dados).toEqual(["chegou tarde"]);
    const proxima = await obterFotografia({ assetId: "a", tipo: "NEWS", buscar: async () => ["não deveria buscar"] });
    expect(proxima).toMatchObject({ dados: ["chegou tarde"], estado: "ok" });
  });

  it("visitas simultâneas ao mesmo ativo e tipo dividem uma busca só", async () => {
    const buscar = vi.fn(async () => {
      await pausa(30);
      return ["x"];
    });

    const resultados = await Promise.all([
      obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar }),
      obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar }),
      obterFotografia({ assetId: "a", tipo: "CVM_RESULTS", buscar }),
    ]);

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(resultados.every((r) => r.estado === "ok")).toBe(true);
  });

  it("as renovações da CVM de ativos diferentes rodam uma de cada vez (CPU síncrona não se empilha)", async () => {
    let simultaneas = 0;
    let maximo = 0;
    const buscar = async () => {
      simultaneas++;
      maximo = Math.max(maximo, simultaneas);
      await pausa(20);
      simultaneas--;
      return ["x"];
    };

    await Promise.all(
      ["a", "b", "c", "d"].map((assetId) =>
        obterFotografia({ assetId, tipo: "CVM_RESULTS", buscar, esperaMaximaMs: 5_000 }),
      ),
    );
    await aguardarFilaPesada();

    expect(maximo).toBe(1);
    expect(loja.size).toBe(4);
  });

  it("as notícias são leves e não esperam na fila da CVM: duas rodam juntas", async () => {
    let simultaneas = 0;
    let maximo = 0;
    const buscar = async () => {
      simultaneas++;
      maximo = Math.max(maximo, simultaneas);
      await pausa(30);
      simultaneas--;
      return [];
    };

    await Promise.all(
      ["a", "b"].map((assetId) => obterFotografia({ assetId, tipo: "NEWS", buscar, esperaMaximaMs: 5_000 })),
    );

    expect(maximo).toBe(2);
  });

  it("uma renovação pesada que falha não trava as da fila", async () => {
    const [ruim, boa] = await Promise.all([
      obterFotografia({
        assetId: "a",
        tipo: "CVM_RESULTS",
        buscar: async () => {
          throw new Error("quebrou");
        },
        esperaMaximaMs: 5_000,
      }),
      obterFotografia({ assetId: "b", tipo: "CVM_RESULTS", buscar: async () => ["ok"], esperaMaximaMs: 5_000 }),
    ]);

    expect(ruim.estado).toBe("indisponivel");
    expect(boa).toMatchObject({ dados: ["ok"], estado: "ok" });
  });
});
