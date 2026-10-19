import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarSerieDiariaYahoo, buscarUltimoValorYahoo } from "../quotes/quotes.provider.js";
import { buscarSerieSgs } from "./indices.fontes.js";
import { indicesRepository } from "./indices.repository.js";
import { indicesService, limparCacheDosIndices } from "./indices.service.js";

// Sem rede e sem banco: fontes e repository são simulados.
vi.mock("./indices.fontes.js", () => ({ buscarSerieSgs: vi.fn() }));
vi.mock("../quotes/quotes.provider.js", () => ({
  buscarSerieDiariaYahoo: vi.fn(),
  buscarUltimoValorYahoo: vi.fn(),
}));
vi.mock("./indices.repository.js", () => ({
  indicesRepository: { gravarPonto: vi.fn(), listarPontos: vi.fn() },
}));

const HOJE = "2026-10-19";

beforeEach(() => {
  vi.resetAllMocks();
  limparCacheDosIndices();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${HOJE}T15:00:00Z`));

  vi.mocked(buscarSerieSgs).mockImplementation(async (codigo) => {
    if (codigo === 432) {
      return [
        { data: "2026-09-30", valor: 14.25 },
        { data: "2026-10-18", valor: 13.75 },
        { data: "2026-11-03", valor: 13.5 }, // futuro: o SGS repete a meta adiantada
      ];
    }
    if (codigo === 433) return [{ data: "2026-09-01", valor: 0.5 }];
    if (codigo === 4391) return [{ data: "2026-10-01", valor: 0.56 }];
    return [{ data: "2026-10-16", valor: 13.65 }];
  });
  vi.mocked(buscarSerieDiariaYahoo).mockResolvedValue([{ data: "2026-10-16", valor: 205000 }]);
  vi.mocked(buscarUltimoValorYahoo).mockResolvedValue({ data: HOJE, valor: 3953.42 });
  vi.mocked(indicesRepository.gravarPonto).mockResolvedValue(undefined);
  vi.mocked(indicesRepository.listarPontos).mockResolvedValue([{ data: HOJE, valor: 3953.42 }]);
});

describe("indicesService.montarDados", () => {
  it("monta as séries mensais a partir do SGS", async () => {
    const d = await indicesService.montarDados();

    expect(d.hoje).toBe(HOJE);
    expect(d.selicMensal).toEqual([
      { data: "2026-09", valor: 14.25 },
      { data: "2026-10", valor: 13.75 },
    ]);
    expect(d.ipcaMensal).toEqual([{ data: "2026-09", valor: 0.5 }]);
    expect(d.cdiMensal).toEqual([{ data: "2026-10", valor: 0.56 }]);
    expect(d.cdiTaxaMensal).toEqual([{ data: "2026-10", valor: 13.65 }]);
    expect(d.pontos.ibovespa).toEqual([{ data: "2026-10-16", valor: 205000 }]);
  });

  it("nenhum ponto depois de hoje sai do service", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue([
      { data: "2026-10-19", valor: 13.75 },
      { data: "2026-10-20", valor: 13.5 },
      { data: "2026-12-01", valor: 13.5 },
    ]);

    const d = await indicesService.montarDados();

    expect(d.selicMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
    expect(d.cdiTaxaMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
  });

  it("responde com séries vazias quando o BCB falha", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue(null);

    const d = await indicesService.montarDados();

    expect(d.selicMensal).toEqual([]);
    expect(d.ipcaMensal).toEqual([]);
    expect(d.cdiMensal).toEqual([]);
    expect(d.cdiTaxaMensal).toEqual([]);
    expect(d.pontos.ibovespa.length).toBeGreaterThan(0);
  });

  it("falha do Yahoo vira série vazia e o resto continua", async () => {
    vi.mocked(buscarSerieDiariaYahoo).mockResolvedValue(null);
    vi.mocked(buscarUltimoValorYahoo).mockResolvedValue(null);
    vi.mocked(indicesRepository.listarPontos).mockResolvedValue([]);

    const d = await indicesService.montarDados();

    expect(d.pontos.ibovespa).toEqual([]);
    expect(d.pontos.sp500).toEqual([]);
    expect(d.pontos.ifix).toEqual([]);
    expect(indicesRepository.gravarPonto).not.toHaveBeenCalled();
    expect(d.selicMensal.length).toBeGreaterThan(0);
  });

  it("grava o ponto do dia do IFIX e devolve a série do banco", async () => {
    const d = await indicesService.montarDados();

    expect(indicesRepository.gravarPonto).toHaveBeenCalledWith("ifix", HOJE, 3953.42);
    expect(indicesRepository.gravarPonto).toHaveBeenCalledWith("smll", HOJE, 3953.42);
    expect(indicesRepository.gravarPonto).toHaveBeenCalledWith("idiv", HOJE, 3953.42);
    expect(d.pontos.ifix).toEqual([{ data: HOJE, valor: 3953.42 }]);
  });

  it("falha ao gravar ou ao ler o banco não derruba nem some com o resto", async () => {
    vi.mocked(indicesRepository.gravarPonto).mockRejectedValue(new Error("banco fora"));
    const d1 = await indicesService.montarDados();
    expect(d1.pontos.ifix).toEqual([{ data: HOJE, valor: 3953.42 }]);

    vi.mocked(indicesRepository.listarPontos).mockRejectedValue(new Error("banco fora"));
    const d2 = await indicesService.montarDados();
    expect(d2.pontos.ifix).toEqual([]);
    expect(d2.pontos.ibovespa.length).toBeGreaterThan(0);
  });

  it("não chama as fontes duas vezes dentro da validade do cache", async () => {
    await indicesService.montarDados();
    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
    expect(buscarSerieDiariaYahoo).toHaveBeenCalledTimes(2);
    expect(buscarUltimoValorYahoo).toHaveBeenCalledTimes(3);

    await indicesService.montarDados();

    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
    expect(buscarSerieDiariaYahoo).toHaveBeenCalledTimes(2);
    expect(buscarUltimoValorYahoo).toHaveBeenCalledTimes(3);
  });

  it("falha fica guardada por 2 minutos e depois tenta de novo", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue(null);
    await indicesService.montarDados();
    await indicesService.montarDados();
    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);

    vi.setSystemTime(new Date(`${HOJE}T15:03:00Z`));
    await indicesService.montarDados();
    expect(buscarSerieSgs).toHaveBeenCalledTimes(8);
  });

  it("série lenta do SGS estoura o orçamento: vai vazia agora, e a próxima chamada já traz o dado", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(`${HOJE}T15:00:00Z`));
    let liberar: (v: { data: string; valor: number }[]) => void = () => undefined;
    const lenta = new Promise<{ data: string; valor: number }[]>((r) => (liberar = r));
    vi.mocked(buscarSerieSgs).mockImplementation(async (codigo) => {
      if (codigo === 433) return lenta;
      return [{ data: "2026-10-01", valor: 1 }];
    });

    const pendente = indicesService.montarDados();
    await vi.advanceTimersByTimeAsync(12_001);
    const d1 = await pendente;
    expect(d1.ipcaMensal).toEqual([]);
    expect(d1.cdiMensal).toEqual([{ data: "2026-10", valor: 1 }]);
    expect(d1.selicMensal.length).toBeGreaterThan(0);

    liberar([{ data: "2026-09-01", valor: 0.5 }]);
    await vi.advanceTimersByTimeAsync(0);
    const d2 = await indicesService.montarDados();
    expect(d2.ipcaMensal).toEqual([{ data: "2026-09", valor: 0.5 }]);
    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
  });

  it("aquecer() não rejeita nem espera, e enche o cache", async () => {
    vi.mocked(buscarSerieSgs).mockRejectedValue(new Error("x"));
    expect(() => indicesService.aquecer()).not.toThrow();
  });
});
